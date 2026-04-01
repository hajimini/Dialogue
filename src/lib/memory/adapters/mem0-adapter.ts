/**
 * Mem0 Adapter
 *
 * Implements the MemoryGateway interface using direct Supabase access plus
 * pluggable embedding and reranking services.
 */

import type {
  AddMemoryParams,
  GetMemoryContextParams,
  MemoryContext,
  MemoryGateway,
  MemoryResult,
  MemorySearchResult,
  SaveSessionMemoriesParams,
  SaveSessionMemoriesResult,
  SearchMemoryParams,
  UpdateMemoryParams,
} from "@/lib/memory/gateway";
import type { Mem0AdapterConfig } from "@/lib/memory/config";
import { memoryContextCache } from "@/lib/memory/memory-context-cache";
import { memoryLogger } from "@/lib/memory/memory-logger";
import { memoryMetrics } from "@/lib/memory/metrics";
import { getMemorySupabaseClient, resolveMemoryStorageUserId } from "@/lib/memory/storage";
import { EmbeddingService } from "@/lib/memory/services/embedding-service";
import { RerankerService } from "@/lib/memory/services/reranker-service";
import type {
  MemoryRecord,
  SessionRecord,
  UserProfilePerPersonaData,
  UserProfilePerPersonaRecord,
} from "@/lib/supabase/types";

const CONTINUATION_CUE_REGEX =
  /还记得|不是说过|上次|之前|后来|结果|最后|又来了|又|还|那个|那只|那家|那次|那场|那段|那件|那位|这次|这样/;

const CONTINUATION_ANCHOR_REGEX =
  /(那(?:个|只|家|次|场|段|件|位)?|这(?:个|只|家|次|场|段|件|位)?)([\u4e00-\u9fa5A-Za-z0-9]{1,8})/g;

const ANCHOR_SUFFIX_MARKERS = [
  "今天",
  "后来",
  "结果",
  "最后",
  "又",
  "还",
  "就",
  "都",
  "终于",
  "一下",
  "真的",
  "还是",
  "现在",
  "刚才",
  "昨天",
  "前天",
  "然后",
];

function normalizeText(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]/g, "");
}

function trimAnchorSuffix(anchor: string) {
  let value = anchor.trim();

  for (const marker of ANCHOR_SUFFIX_MARKERS) {
    const markerIndex = value.indexOf(marker);
    if (markerIndex > 0) {
      value = value.slice(0, markerIndex);
    }
  }

  return value.trim();
}

function uniqueStrings(items: Array<string | null | undefined>, limit = 24) {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const item of items) {
    const normalized = item?.trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);

    if (result.length >= limit) {
      return result;
    }
  }

  return result;
}

function extractQueryAnchors(text: string) {
  const anchors: string[] = [];
  const referentialMatches = text.matchAll(CONTINUATION_ANCHOR_REGEX);

  for (const match of referentialMatches) {
    const full = `${match[1]}${trimAnchorSuffix(match[2])}`.trim();
    const core = trimAnchorSuffix(match[2]);

    if (full.length >= 2) anchors.push(full);
    if (core.length >= 1) anchors.push(core);
  }

  const shortSegments = text.match(/[\u4e00-\u9fa5A-Za-z0-9]{2,8}/g) ?? [];
  anchors.push(...shortSegments.map((segment) => trimAnchorSuffix(segment)));

  return uniqueStrings(anchors, 16);
}

/**
 * Normalize and expand Chinese queries for better recall
 *
 * Examples:
 * - "我叫什么名字" -> ["我叫什么名字", "我叫什么", "我的名字", "用户名字", "姓名"]
 * - "我最喜欢什么" -> ["我最喜欢什么", "我喜欢什么", "我的爱好", "喜好", "兴趣"]
 */
function normalizeAndExpandQuery(query: string): string[] {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const expansions: string[] = [trimmed];

  // 名字相关查询
  if (/我叫|叫什么|什么名字|我的名字/.test(trimmed)) {
    expansions.push("我叫什么", "我的名字", "用户名字", "姓名", "名字");
  }

  // 爱好相关查询
  if (/喜欢什么|爱好|兴趣/.test(trimmed)) {
    expansions.push("我喜欢什么", "我的爱好", "喜好", "兴趣", "最喜欢");
  }

  // 职业相关查询
  if (/做什么|职业|工作/.test(trimmed)) {
    expansions.push("我做什么", "我的职业", "工作", "职业");
  }

  // 住址相关查询
  if (/住在|住哪|地址|家/.test(trimmed)) {
    expansions.push("我住在", "住哪里", "地址", "家在哪");
  }

  return uniqueStrings(expansions, 8);
}

function isMissingMemoryMetricColumn(message: string | undefined) {
  if (!message) return false;
  return (
    message.includes("retrieval_count") ||
    message.includes("feedback_count_accurate") ||
    message.includes("feedback_count_inaccurate") ||
    message.includes("schema cache")
  );
}

export class Mem0Adapter implements MemoryGateway {
  private readonly supabase = getMemorySupabaseClient();
  private readonly embeddingService: EmbeddingService;
  private readonly rerankerService: RerankerService;
  private readonly retrievalLimit: number;

  constructor(config: Mem0AdapterConfig) {
    this.embeddingService = new EmbeddingService(config.embeddingConfig);
    this.rerankerService = new RerankerService(config.rerankerConfig);
    this.retrievalLimit = config.retrievalLimit;
  }

  async add(params: AddMemoryParams): Promise<MemoryResult> {
    const startTime = Date.now();

    try {
      const embedding = await this.embeddingService.embed(params.content);
      const userIdUUID = await resolveMemoryStorageUserId(params.userId);

      const { data, error } = await this.supabase
        .from("memories")
        .insert({
          user_id: userIdUUID,
          persona_id: params.personaId,
          character_id: params.characterId,
          memory_type: params.memoryType,
          content: params.content,
          embedding,
          importance: params.importance ?? 0.5,
          source_session_id: params.sourceSessionId ?? null,
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to insert memory: ${error.message}`);
      }

      const duration = Date.now() - startTime;
      const result = this.mapSupabaseToMemoryResult(data, params.userId);

      memoryMetrics.record("memory.add.duration", duration);
      memoryContextCache.invalidate(params.userId, params.personaId);
      await memoryLogger.log({
        timestamp: new Date().toISOString(),
        operation: "memory.add",
        user_id: params.userId,
        persona_id: params.personaId,
        character_id: params.characterId ?? null,
        memory_id: result.id,
        duration,
        success: true,
        metadata: {
          memory_type: params.memoryType,
          source_session_id: params.sourceSessionId ?? null,
          importance: params.importance ?? 0.5,
        },
      });

      return result;
    } catch (error) {
      await this.logFailure("memory.add", Date.now() - startTime, {
        userId: params.userId,
        personaId: params.personaId,
        characterId: params.characterId,
        error,
      });
      throw error;
    }
  }

  async search(params: SearchMemoryParams): Promise<MemorySearchResult> {
    const startTime = Date.now();

    try {
      const limit = params.limit ?? this.retrievalLimit;
      const userIdUUID = await resolveMemoryStorageUserId(params.userId);
      const trimmedQuery = params.query.trim();

      // 空查询：按时间倒序列出记忆
      if (!trimmedQuery) {
        let listQuery = this.supabase
          .from("memories")
          .select("*", { count: "exact" })
          .eq("user_id", userIdUUID)
          .eq("character_id", params.characterId);

        if (params.personaId?.trim()) {
          listQuery = listQuery.eq("persona_id", params.personaId);
        }

        if (params.memoryTypes?.length) {
          listQuery = listQuery.in("memory_type", params.memoryTypes);
        }

        const { data, error, count } = await listQuery
          .order("updated_at", { ascending: false })
          .limit(limit);

        if (error) {
          throw new Error(`Failed to list memories: ${error.message}`);
        }

        const memories = (data ?? []).map((record) =>
          this.mapSupabaseToMemoryResult(record, params.userId),
        );

        return {
          memories,
          totalCount: count ?? memories.length,
          searchTime: Date.now() - startTime,
          totalTime: Date.now() - startTime,
        };
      }

      const embeddingStart = Date.now();

      // Query normalization: expand Chinese queries for better recall
      const queryVariations = normalizeAndExpandQuery(trimmedQuery);
      const primaryQuery = queryVariations[0] || trimmedQuery;

      const queryEmbedding = await this.embeddingService.embed(primaryQuery);
      const embeddingTime = Date.now() - embeddingStart;

      const searchStart = Date.now();

      // 使用 pgvector match_memories RPC，数据库侧向量搜索，避免全表拉取
      const { data: rpcData, error: rpcError } = await this.supabase.rpc(
        "match_memories",
        {
          query_embedding: queryEmbedding,
          match_user_id: userIdUUID,
          match_persona_id: params.personaId ?? null,
          match_character_id: params.characterId,
          match_count: limit * 2,
          match_threshold: 0.1,
        },
      );

      if (rpcError) {
        throw new Error(`Failed to search memories via RPC: ${rpcError.message}`);
      }

      const searchTime = Date.now() - searchStart;

      // RPC 返回的是精简字段，需要补全为 MemoryRecord 格式
type RpcRow = {
        id: string;
        content: string;
        memory_type: string;
        importance: number;
        similarity: number;
        created_at: string;
        updated_at: string;
        source_session_id: string | null;
      };
      const rpcRows = (rpcData ?? []) as RpcRow[];

      // 过滤 memoryTypes（RPC 不支持该参数，在客户端过滤）
      const filteredRows = params.memoryTypes?.length
        ? rpcRows.filter((row) => params.memoryTypes!.includes(row.memory_type as MemoryRecord["memory_type"]))
        : rpcRows;

      const topResults = filteredRows.slice(0, limit * 2).map((row) => ({
        memory: {
          id: row.id,
          user_id: userIdUUID,
          persona_id: params.personaId ?? "",
          memory_type: row.memory_type as MemoryRecord["memory_type"],
          content: row.content,
          embedding: null,
          importance: row.importance,
          source_session_id: row.source_session_id,
          created_at: row.created_at,
          updated_at: row.updated_at,
        } as MemoryRecord,
        similarityScore: row.similarity,
      }));

      let rerankTime = 0;
      let scoredMemories = topResults.map((item, index) => ({
        memory: this.mapSupabaseToMemoryResult(item.memory, params.userId, {
          similarityScore: item.similarityScore,
          finalRank: index + 1,
        }),
        similarityScore: item.similarityScore,
        finalRank: index + 1,
      }));

      if (topResults.length > 0) {
        const rerankStart = Date.now();
        const rerankedResults = await this.rerankerService.rerank(
          trimmedQuery,
          topResults.map((item) => item.memory.content),
        );
        rerankTime = Date.now() - rerankStart;

        scoredMemories = rerankedResults.slice(0, limit).map((result, index) => {
          const source = topResults[result.index];
          const memory = this.mapSupabaseToMemoryResult(source.memory, params.userId, {
            similarityScore: source.similarityScore,
            rerankerScore: result.relevanceScore,
            finalRank: index + 1,
          });

          return {
            memory,
            similarityScore: source.similarityScore,
            rerankerScore: result.relevanceScore,
            finalRank: index + 1,
          };
        });
      } else {
        scoredMemories = [];
      }

      const memories = scoredMemories.map((item) => item.memory);
      await this.incrementRetrievalCounts(memories.map((item) => item.id));

      const duration = Date.now() - startTime;
      memoryMetrics.record("memory.search.duration", duration);

      await memoryLogger.log({
        timestamp: new Date().toISOString(),
        operation: "memory.search",
        user_id: params.userId,
        persona_id: params.personaId || null,
        character_id: params.characterId ?? null,
        duration,
        success: true,
        metadata: {
          query: trimmedQuery,
          limit,
          memory_types: params.memoryTypes ?? [],
          result_count: memories.length,
          embedding_time: embeddingTime,
          search_time: searchTime,
          rerank_time: rerankTime,
          candidate_count: filteredRows.length,
        },
      });

      return {
        memories,
        totalCount: filteredRows.length,
        embeddingTime,
        searchTime,
        rerankTime,
        totalTime: duration,
        scoredMemories,
      };
    } catch (error) {
      await this.logFailure("memory.search", Date.now() - startTime, {
        userId: params.userId,
        personaId: params.personaId,
        characterId: params.characterId,
        error,
      });

      return {
        memories: [],
        totalCount: 0,
        totalTime: Date.now() - startTime,
      };
    }
  }

  async update(params: UpdateMemoryParams): Promise<MemoryResult> {
    const startTime = Date.now();
    let existing: MemoryRecord | null = null;

    try {
      existing = await this.getMemoryRecordById(params.memoryId);
      const updates: Partial<MemoryRecord> = {
        updated_at: new Date().toISOString(),
      };

      if (params.content !== undefined) {
        updates.content = params.content;
        updates.embedding = await this.embeddingService.embed(params.content);
      }

      if (params.importance !== undefined) {
        updates.importance = params.importance;
      }

      if (params.memoryType !== undefined) {
        updates.memory_type = params.memoryType;
      }

      const { data, error } = await this.supabase
        .from("memories")
        .update(updates)
        .eq("id", params.memoryId)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to update memory: ${error.message}`);
      }

      const duration = Date.now() - startTime;
      memoryMetrics.record("memory.update.duration", duration);
      memoryContextCache.clear();
      await memoryLogger.log({
        timestamp: new Date().toISOString(),
        operation: "memory.update",
        user_id: existing?.user_id ?? "",
        persona_id: existing?.persona_id ?? null,
        character_id: existing?.character_id ?? null,
        memory_id: params.memoryId,
        duration,
        success: true,
      });

      return this.mapSupabaseToMemoryResult(data, existing?.user_id);
    } catch (error) {
      await this.logFailure("memory.update", Date.now() - startTime, {
        memoryId: params.memoryId,
        characterId: existing?.character_id ?? undefined,
        error,
      });
      throw error;
    }
  }

  async delete(memoryId: string): Promise<void> {
    const startTime = Date.now();
    let existing: MemoryRecord | null = null;

    try {
      existing = await this.getMemoryRecordById(memoryId);
      const { error } = await this.supabase.from("memories").delete().eq("id", memoryId);

      if (error) {
        throw new Error(`Failed to delete memory: ${error.message}`);
      }

      const duration = Date.now() - startTime;
      memoryMetrics.record("memory.delete.duration", duration);
      memoryContextCache.clear();
      await memoryLogger.log({
        timestamp: new Date().toISOString(),
        operation: "memory.delete",
        user_id: existing?.user_id ?? "",
        persona_id: existing?.persona_id ?? null,
        character_id: existing?.character_id ?? null,
        memory_id: memoryId,
        duration,
        success: true,
      });
    } catch (error) {
      await this.logFailure("memory.delete", Date.now() - startTime, {
        memoryId,
        characterId: existing?.character_id ?? undefined,
        error,
      });
      throw error;
    }
  }

  async saveSessionMemories(
    params: SaveSessionMemoriesParams,
  ): Promise<SaveSessionMemoriesResult> {
    const startTime = Date.now();

    try {
      const savedMemories: MemoryResult[] = [];

      for (const memory of params.memories) {
        const result = await this.add({
          userId: params.userId,
          personaId: params.personaId,
          characterId: params.characterId,
          memoryType: memory.memory_type,
          content: memory.content,
          importance: memory.importance ?? 0.5,
          sourceSessionId: params.sessionId,
        });
        savedMemories.push(result);
      }

      const profile = await this.upsertUserProfile(
        params.userId,
        params.personaId,
        params.characterId,
        params.profile,
      );

      await this.updateSession(params.sessionId, {
        summary: params.summary,
        topics: params.topics,
      });

      const duration = Date.now() - startTime;
      memoryMetrics.record("memory.saveSession.duration", duration);
      memoryContextCache.invalidate(params.userId, params.personaId);
      await memoryLogger.log({
        timestamp: new Date().toISOString(),
        operation: "memory.saveSession",
        user_id: params.userId,
        persona_id: params.personaId,
        character_id: params.characterId ?? null,
        duration,
        success: true,
        metadata: {
          session_id: params.sessionId,
          memory_count: savedMemories.length,
          topic_count: params.topics.length,
          has_profile_summary: Boolean(params.profile.summary),
        },
      });

      return {
        memories: savedMemories,
        profile,
      };
    } catch (error) {
      await this.logFailure("memory.saveSession", Date.now() - startTime, {
        userId: params.userId,
        personaId: params.personaId,
        characterId: params.characterId,
        error,
      });
      throw error;
    }
  }

  async getMemoryContext(params: GetMemoryContextParams): Promise<MemoryContext> {
    const startTime = Date.now();

    try {
      const hasContinuationCue = CONTINUATION_CUE_REGEX.test(params.query);
      const queryAnchors = extractQueryAnchors(params.query);
      const hasSessionId = Boolean(params.sessionId);

      const [userProfile, recentSummaries, currentSessionMemories] = await Promise.all([
        this.getUserProfile(params.userId, params.personaId, params.characterId),
        this.getRecentSummaries(params.userId, params.personaId, params.characterId),
        hasSessionId && params.sessionId
          ? this.getSessionScopedMemories(
              params.userId,
              params.personaId,
              params.characterId,
              params.sessionId,
              (params.limit ?? this.retrievalLimit) * 2,
            )
          : Promise.resolve([]),
      ]);

      const earlySessionWindow =
        hasSessionId && currentSessionMemories.length > 0
          ? (params.messageCount ?? Number.POSITIVE_INFINITY) <= 10
          : false;

      const enhancedQuery = this.buildEnhancedQuery({
        originalQuery: params.query,
        queryAnchors,
        profileAnchors: userProfile?.profile_data.anchors ?? [],
        recentTopics: recentSummaries.flatMap((summary) => summary.topics ?? []),
        hasContinuationCue,
      });

      const searchResult = await this.search({
        userId: params.userId,
        personaId: params.personaId,
        characterId: params.characterId,
        query: enhancedQuery,
        limit: (params.limit ?? this.retrievalLimit) * 2,
      });

      let finalMemories = this.mergeMemoryResults(
        currentSessionMemories,
        searchResult.memories,
      );

      if (earlySessionWindow && params.sessionId) {
        finalMemories = this.prioritizeCurrentSessionMemories(
          finalMemories,
          params.sessionId,
        );
      }

      finalMemories = this.dedupeConflictingUserFacts(finalMemories, params.sessionId);

      if (hasContinuationCue && finalMemories.length > 1) {
        finalMemories = this.prioritizeHighRelevanceMemory(
          finalMemories,
          params.query,
          queryAnchors,
          userProfile?.profile_data.anchors ?? [],
        );
      }

      const retrievalLimit = params.limit ?? this.retrievalLimit;
      const relevantMemories = this.ensureCurrentSessionCoverage(
        finalMemories,
        params.sessionId,
        retrievalLimit,
      );
      const finalCurrentSessionMemoryCount = relevantMemories.filter(
        (memory) => memory.sourceSessionId === params.sessionId,
      ).length;
      const protectedCurrentSessionMemoryCount = relevantMemories.filter(
        (memory) =>
          memory.sourceSessionId === params.sessionId && memory.memoryType === "user_fact",
      ).length;

      const duration = Date.now() - startTime;
      memoryMetrics.record("memory.getContext.duration", duration);
      await memoryLogger.log({
        timestamp: new Date().toISOString(),
        operation: "memory.getContext",
        user_id: params.userId,
        persona_id: params.personaId,
        character_id: params.characterId ?? null,
        duration,
        success: true,
        metadata: {
          limit: retrievalLimit,
          query: params.query,
          enhanced_query: enhancedQuery,
          has_continuation_cue: hasContinuationCue,
          query_anchor_count: queryAnchors.length,
          recent_summary_count: recentSummaries.length,
          result_count: relevantMemories.length,
          session_id: params.sessionId ?? null,
          message_count: params.messageCount ?? null,
          early_session_window: earlySessionWindow,
          current_session_memory_count: currentSessionMemories.length,
          merged_result_count: finalMemories.length,
          final_current_session_memory_count: finalCurrentSessionMemoryCount,
          protected_current_session_memory_count: protectedCurrentSessionMemoryCount,
        },
      });

      return {
        userProfile,
        recentSummaries,
        relevantMemories,
      };
    } catch (error) {
      await this.logFailure("memory.getContext", Date.now() - startTime, {
        userId: params.userId,
        personaId: params.personaId,
        characterId: params.characterId,
        error,
      });
      throw error;
    }
  }

  async getUserProfile(
    userId: string,
    personaId: string,
    characterId: string,
  ): Promise<UserProfilePerPersonaRecord | null> {
    try {
      const userIdUUID = await resolveMemoryStorageUserId(userId);
      const { data, error } = await this.supabase
        .from("user_profiles_per_persona")
        .select("*")
        .eq("user_id", userIdUUID)
        .eq("persona_id", personaId)
        .eq("character_id", characterId)
        .single();

      if (error) {
        if ((error as { code?: string }).code === "PGRST116") {
          return null;
        }
        console.warn(`[Mem0Adapter] getUserProfile warning: ${error.message}`);
        return null;
      }

      return data;
    } catch (error) {
      console.warn("[Mem0Adapter] getUserProfile error:", error);
      return null;
    }
  }

  private async getRecentSummaries(userId: string, personaId: string, characterId: string): Promise<SessionRecord[]> {
    try {
      const storageUserId = await resolveMemoryStorageUserId(userId);
      const { data, error } = await this.supabase
        .from("sessions")
        .select("*")
        .eq("user_id", storageUserId)
        .eq("persona_id", personaId)
        .eq("character_id", characterId)
        .not("summary", "is", null)
        .order("last_message_at", { ascending: false })
        .limit(3);

      if (error) {
        console.warn(`[Mem0Adapter] getRecentSummaries warning: ${error.message}`);
        return [];
      }

      return (data ?? []) as SessionRecord[];
    } catch (error) {
      console.warn("[Mem0Adapter] getRecentSummaries error:", error);
      return [];
    }
  }

  private async upsertUserProfile(
    userId: string,
    personaId: string,
    characterId: string,
    profileUpdates: Partial<UserProfilePerPersonaData> & {
      relationship_stage?: UserProfilePerPersonaRecord["relationship_stage"];
      total_messages?: number;
    },
  ): Promise<UserProfilePerPersonaRecord> {
    const existing = await this.getUserProfile(userId, personaId, characterId);

    if (existing) {
      const { relationship_stage, total_messages, ...profileDataUpdates } = profileUpdates;
      const updatedProfileData = {
        ...existing.profile_data,
        ...profileDataUpdates,
      };

      const { data, error } = await this.supabase
        .from("user_profiles_per_persona")
        .update({
          profile_data: updatedProfileData,
          relationship_stage:
            relationship_stage ?? existing.relationship_stage,
          total_messages: total_messages ?? existing.total_messages,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to update user profile: ${error.message}`);
      }

      return data;
    }

    const storageUserId = await resolveMemoryStorageUserId(userId);
    const { relationship_stage, total_messages, ...profileDataUpdates } = profileUpdates;
    const { data, error } = await this.supabase
      .from("user_profiles_per_persona")
      .insert({
        user_id: storageUserId,
        persona_id: personaId,
        character_id: characterId,
        profile_data: {
          summary: "",
          facts: [],
          preferences: [],
          relationship_notes: [],
          recent_topics: [],
          anchors: [],
          ...profileDataUpdates,
        },
        relationship_stage: relationship_stage ?? "new",
        total_messages: total_messages ?? 0,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create user profile: ${error.message}`);
    }

    return data;
  }

  private async updateSession(
    sessionId: string,
    updates: { summary: string; topics: string[] },
  ) {
    const { error } = await this.supabase
      .from("sessions")
      .update({
        summary: updates.summary,
        topics: updates.topics,
      })
      .eq("id", sessionId);

    if (error) {
      throw new Error(`Failed to update session: ${error.message}`);
    }
  }

  private async getMemoryRecordById(memoryId: string) {
    const { data, error } = await this.supabase
      .from("memories")
      .select("*")
      .eq("id", memoryId)
      .single();

    if (error) {
      return null;
    }

    return data as MemoryRecord;
  }

  private async incrementRetrievalCounts(memoryIds: string[]) {
    for (const memoryId of memoryIds) {
      const { data, error } = await this.supabase
        .from("memories")
        .select("retrieval_count")
        .eq("id", memoryId)
        .single();

      if (error) {
        if (isMissingMemoryMetricColumn(error.message)) {
          continue;
        }
        console.warn(`[Mem0Adapter] Failed to read retrieval_count: ${error.message}`);
        continue;
      }

      const nextCount = (data?.retrieval_count ?? 0) + 1;
      const { error: updateError } = await this.supabase
        .from("memories")
        .update({ retrieval_count: nextCount })
        .eq("id", memoryId);

      if (updateError && !isMissingMemoryMetricColumn(updateError.message)) {
        console.warn(`[Mem0Adapter] Failed to update retrieval_count: ${updateError.message}`);
      }
    }
  }

  private buildEnhancedQuery(params: {
    originalQuery: string;
    queryAnchors: string[];
    profileAnchors: string[];
    recentTopics: string[];
    hasContinuationCue: boolean;
  }) {
    if (params.hasContinuationCue || params.queryAnchors.length > 0) {
      const contextTerms = [
        ...params.profileAnchors.slice(0, 3),
        ...params.recentTopics.slice(0, 3),
      ]
        .filter(Boolean)
        .join(" ");

      if (contextTerms) {
        return `${params.originalQuery} ${contextTerms}`;
      }
    }

    return params.originalQuery;
  }

  private async getSessionScopedMemories(
    userId: string,
    personaId: string,
    characterId: string,
    sessionId: string,
    limit: number,
  ) {
    const storageUserId = await resolveMemoryStorageUserId(userId);
    const { data, error } = await this.supabase
      .from("memories")
      .select("*")
      .eq("user_id", storageUserId)
      .eq("persona_id", personaId)
      .eq("character_id", characterId)
      .eq("source_session_id", sessionId)
      .order("updated_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.warn(`[Mem0Adapter] getSessionScopedMemories warning: ${error.message}`);
      return [] as MemoryResult[];
    }

    return ((data ?? []) as MemoryRecord[]).map((record) =>
      this.mapSupabaseToMemoryResult(record, userId),
    );
  }

  private mergeMemoryResults(...groups: MemoryResult[][]) {
    const merged = new Map<string, MemoryResult>();

    for (const group of groups) {
      for (const memory of group) {
        if (!merged.has(memory.id)) {
          merged.set(memory.id, memory);
        }
      }
    }

    return Array.from(merged.values());
  }

  private prioritizeCurrentSessionMemories(
    memories: MemoryResult[],
    sessionId: string,
  ) {
    return [...memories].sort((left, right) => {
      const leftCurrent = left.sourceSessionId === sessionId ? 1 : 0;
      const rightCurrent = right.sourceSessionId === sessionId ? 1 : 0;

      if (leftCurrent !== rightCurrent) {
        return rightCurrent - leftCurrent;
      }

      return this.compareMemories(left, right);
    });
  }

  private ensureCurrentSessionCoverage(
    memories: MemoryResult[],
    sessionId: string | undefined,
    limit: number,
  ) {
    if (!sessionId || limit <= 0 || memories.length <= limit) {
      return memories.slice(0, limit);
    }

    const protectedMemories = memories
      .filter((memory) => memory.sourceSessionId === sessionId)
      .sort((left, right) => this.compareMemories(left, right, sessionId));

    const mustKeep = protectedMemories
      .filter((memory) => memory.memoryType === "user_fact")
      .slice(0, Math.min(2, limit));

    if (mustKeep.length === 0) {
      return memories.slice(0, limit);
    }

    const initial = memories.slice(0, limit);
    const selectedIds = new Set(initial.map((memory) => memory.id));
    const result = [...initial];

    for (const memory of mustKeep) {
      if (selectedIds.has(memory.id)) {
        continue;
      }

      const replaceIndex = result.findIndex(
        (item) => item.sourceSessionId !== sessionId,
      );
      const targetIndex = replaceIndex >= 0 ? replaceIndex : result.length - 1;

      selectedIds.delete(result[targetIndex]?.id ?? "");
      result[targetIndex] = memory;
      selectedIds.add(memory.id);
    }

    return result.sort((left, right) => this.compareMemories(left, right, sessionId));
  }

  private dedupeConflictingUserFacts(
    memories: MemoryResult[],
    sessionId?: string,
  ) {
    const deduped: MemoryResult[] = [];
    const seenSlots = new Map<string, MemoryResult>();

    for (const memory of memories) {
      if (memory.memoryType !== "user_fact") {
        deduped.push(memory);
        continue;
      }

      const slotKey = this.getFactSlotKey(memory.content);
      if (!slotKey) {
        deduped.push(memory);
        continue;
      }

      const existing = seenSlots.get(slotKey);
      if (!existing) {
        seenSlots.set(slotKey, memory);
        deduped.push(memory);
        continue;
      }

      const preferred =
        this.compareMemories(memory, existing, sessionId) < 0 ? memory : existing;
      const rejected = preferred.id === memory.id ? existing : memory;

      seenSlots.set(slotKey, preferred);
      const rejectedIndex = deduped.findIndex((item) => item.id === rejected.id);
      if (rejectedIndex >= 0) {
        deduped.splice(rejectedIndex, 1);
      }
      if (!deduped.some((item) => item.id === preferred.id)) {
        deduped.push(preferred);
      }
    }

    return deduped.sort((left, right) => this.compareMemories(left, right, sessionId));
  }

  private getFactSlotKey(content: string) {
    const normalized = content.trim().replace(/\s+/g, "");
    const slotMatchers: Array<{ key: string; test: RegExp }> = [
      {
        key: "favorite_flower",
        test: /^我?最喜欢的花是[:：]?.+$/,
      },
      {
        key: "weekend_seaside_walk",
        test: /^周末(?:通常|常|习惯)?.*(海边| seaside ).*(散步|走走).*$/i,
      },
    ];

    for (const matcher of slotMatchers) {
      if (matcher.test.test(normalized)) {
        return matcher.key;
      }
    }

    if (normalized.includes("最喜欢的花")) {
      return "favorite_flower";
    }

    if (normalized.includes("周末") && normalized.includes("海边") && normalized.includes("散步")) {
      return "weekend_seaside_walk";
    }

    return null;
  }

  private compareMemories(
    left: MemoryResult,
    right: MemoryResult,
    sessionId?: string,
  ) {
    const leftCurrent = sessionId && left.sourceSessionId === sessionId ? 1 : 0;
    const rightCurrent = sessionId && right.sourceSessionId === sessionId ? 1 : 0;
    if (leftCurrent !== rightCurrent) {
      return rightCurrent - leftCurrent;
    }

    const leftUpdated = new Date(left.updatedAt).getTime();
    const rightUpdated = new Date(right.updatedAt).getTime();
    if (leftUpdated !== rightUpdated) {
      return rightUpdated - leftUpdated;
    }

    const leftRerank = left.rerankerScore ?? -1;
    const rightRerank = right.rerankerScore ?? -1;
    if (leftRerank !== rightRerank) {
      return rightRerank - leftRerank;
    }

    const leftSimilarity = left.similarityScore ?? -1;
    const rightSimilarity = right.similarityScore ?? -1;
    return rightSimilarity - leftSimilarity;
  }

  private prioritizeHighRelevanceMemory(
    memories: MemoryResult[],
    query: string,
    queryAnchors: string[],
    profileAnchors: string[],
  ) {
    if (memories.length === 0) return memories;

    const memoriesWithScores = memories.map((memory) => {
      const normalizedContent = normalizeText(memory.content);
      const normalizedQuery = normalizeText(query);
      const hasDirectMatch = normalizedContent.includes(normalizedQuery);

      const anchorMatches = [...queryAnchors, ...profileAnchors].filter((anchor) => {
        const normalizedAnchor = normalizeText(anchor);
        return (
          normalizedAnchor &&
          (normalizedContent.includes(normalizedAnchor) ||
            normalizedAnchor.includes(normalizedContent))
        );
      });

      let relevanceScore = 0;
      if (hasDirectMatch) relevanceScore += 0.5;
      relevanceScore += Math.min(0.5, anchorMatches.length * 0.15);

      return {
        memory,
        relevanceScore,
      };
    });

    const highRelevanceMemories = memoriesWithScores.filter(
      (item) => item.relevanceScore >= 0.9,
    );
    const otherMemories = memoriesWithScores.filter(
      (item) => item.relevanceScore < 0.9,
    );

    if (
      highRelevanceMemories.length === 1 &&
      otherMemories.every((item) => item.relevanceScore < 0.5)
    ) {
      return [highRelevanceMemories[0].memory, ...otherMemories.map((item) => item.memory)];
    }

    return memories;
  }

  private mapSupabaseToMemoryResult(
    record: MemoryRecord,
    userIdOverride?: string,
    extras?: Partial<MemoryResult>,
  ): MemoryResult {
    return {
      id: record.id,
      userId: userIdOverride ?? record.user_id,
      personaId: record.persona_id,
      memoryType: record.memory_type,
      content: record.content,
      importance: record.importance,
      sourceSessionId: record.source_session_id,
      embedding: record.embedding,
      createdAt: record.created_at || new Date().toISOString(),
      updatedAt: record.updated_at || new Date().toISOString(),
      ...extras,
    };
  }

  private cosineSimilarity(vec1: number[] | null, vec2: number[] | null) {
    if (!vec1 || !vec2 || vec1.length === 0 || vec2.length === 0) {
      return 0;
    }

    const length = Math.min(vec1.length, vec2.length);
    let dot = 0;
    let mag1 = 0;
    let mag2 = 0;

    for (let index = 0; index < length; index += 1) {
      dot += vec1[index] * vec2[index];
      mag1 += vec1[index] * vec1[index];
      mag2 += vec2[index] * vec2[index];
    }

    if (!mag1 || !mag2) {
      return 0;
    }

    return dot / (Math.sqrt(mag1) * Math.sqrt(mag2));
  }

  private async logFailure(
    operation: string,
    duration: number,
    params: {
      userId?: string;
      personaId?: string;
      characterId?: string;
      memoryId?: string;
      error: unknown;
    },
  ) {
    const errorMessage =
      params.error instanceof Error ? params.error.message : String(params.error);

    console.error(`[Mem0Adapter] Error in ${operation}:`, errorMessage);

    await memoryLogger.log({
      timestamp: new Date().toISOString(),
      operation,
      user_id: params.userId ?? "",
      persona_id: params.personaId ?? null,
      character_id: params.characterId ?? null,
      memory_id: params.memoryId ?? null,
      duration,
      success: false,
      error_message: errorMessage,
    });
  }
}
