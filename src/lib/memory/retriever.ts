/**
 * Memory Retriever
 * 
 * Refactored to use MemoryGateway for memory operations.
 * Preserves backward compatibility by maintaining the same exports and function signatures.
 */

import { getMemoryGateway } from './factory';
import { memoryContextCache } from '@/lib/memory/memory-context-cache';
import { filterConflictingPersonaMemories } from '@/lib/persona/identity';
import type { Persona } from '@/lib/supabase/types';

type MemoryContextInput = {
  userId: string;
  personaId: string;
  characterId: string;
  persona: Persona;
  query: string;
  limit?: number;
};

/**
 * Continuation cue regex - detects referential patterns in Chinese queries
 * Preserved for backward compatibility (also exists in mem0-adapter.ts)
 */
export const CONTINUATION_CUE_REGEX =
  /还记得|不是说过|上次|之前|后来|结果|最后|又来了|又|还|那个|那只|那家|那次|那场|那段|那件|那位|这次|这样/;

/**
 * Continuation anchor regex - extracts specific referential anchors
 * Preserved for backward compatibility (also exists in mem0-adapter.ts)
 */
const CONTINUATION_ANCHOR_REGEX =
  /(那(?:个|只|家|次|场|段|件|位)?|这(?:个|只|家|次|场|段|件|位)?)([\u4e00-\u9fa5A-Za-z0-9]{1,8})/g;

/**
 * Anchor suffix markers to trim from extracted anchors
 * Preserved for backward compatibility (also exists in mem0-adapter.ts)
 */
const ANCHOR_SUFFIX_MARKERS = [
  '今天',
  '后来',
  '结果',
  '最后',
  '又',
  '还',
  '就',
  '都',
  '终于',
  '一下',
  '真的',
  '还是',
  '现在',
  '刚才',
  '昨天',
  '前天',
  '然后',
];

/**
 * Helper function to trim anchor suffix markers
 */
function trimAnchorSuffix(anchor: string): string {
  let value = anchor.trim();

  for (const marker of ANCHOR_SUFFIX_MARKERS) {
    const markerIndex = value.indexOf(marker);
    if (markerIndex > 0) {
      value = value.slice(0, markerIndex);
    }
  }

  return value.trim();
}

/**
 * Helper function to get unique strings from array
 */
function uniqueStrings(items: Array<string | null | undefined>, limit = 24): string[] {
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

/**
 * Extract query anchors from text
 * Preserved for backward compatibility (also exists in mem0-adapter.ts)
 */
export function extractQueryAnchors(text: string): string[] {
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
 * Convert MemoryResult to MemoryRecord format
 * Helper function to maintain compatibility with filterConflictingPersonaMemories
 */
function memoryResultToRecord(result: import('./gateway').MemoryResult): import('@/lib/supabase/types').MemoryRecord {
  return {
    id: result.id,
    user_id: result.userId,
    persona_id: result.personaId,
    memory_type: result.memoryType,
    content: result.content,
    embedding: result.embedding ?? null,
    importance: result.importance,
    source_session_id: result.sourceSessionId,
    similarity_score: result.similarityScore,
    reranker_score: result.rerankerScore,
    final_rank: result.finalRank,
    created_at: result.createdAt,
    updated_at: result.updatedAt,
  };
}

function compareFallbackMemories(
  left: import("./gateway").MemoryResult,
  right: import("./gateway").MemoryResult,
  sessionId?: string,
) {
  const leftCurrent = sessionId && left.sourceSessionId === sessionId ? 1 : 0;
  const rightCurrent = sessionId && right.sourceSessionId === sessionId ? 1 : 0;

  if (leftCurrent !== rightCurrent) {
    return rightCurrent - leftCurrent;
  }

  return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
}

/**
 * Get memory context for prompt building
 * 
 * Refactored to use MemoryGateway instead of direct local JSON access.
 * Maintains the same input/output interface for backward compatibility.
 */
export async function getMemoryContext(input: MemoryContextInput & { sessionId?: string; messageCount?: number }) {
  // 有 sessionId + messageCount 时先查缓存
  if (input.sessionId !== undefined && input.messageCount !== undefined) {
    const cached = memoryContextCache.get(input.sessionId, input.messageCount, input.characterId);
    if (cached) {
      // 缓存命中：仍需过滤，保证与未命中路径语义一致
      const alignedMemories = filterConflictingPersonaMemories(
        cached.relevantMemories,
        input.persona,
      );
      return {
        userProfile: cached.userProfile,
        recentSummaries: cached.recentSummaries,
        relevantMemories: alignedMemories,
        fromCache: true,
      };
    }
  }

  const gateway = getMemoryGateway();
  const memoryContext = await gateway.getMemoryContext({
    userId: input.userId,
    personaId: input.personaId,
    characterId: input.characterId,
    persona: input.persona,
    query: input.query,
    limit: input.limit ?? 5,
    sessionId: input.sessionId,
    messageCount: input.messageCount,
  });
  let relevantMemories = memoryContext.relevantMemories;

  if (relevantMemories.length === 0 && input.sessionId) {
    const fallbackSearch = await gateway.search({
      userId: input.userId,
      personaId: input.personaId,
      characterId: input.characterId,
      query: "",
      limit: Math.max(input.limit ?? 5, 10),
    });

    relevantMemories = fallbackSearch.memories
      .sort((left, right) => compareFallbackMemories(left, right, input.sessionId))
      .slice(0, input.limit ?? 5);
  }

  const memoryRecords = relevantMemories.map(memoryResultToRecord);
  const alignedMemories = filterConflictingPersonaMemories(memoryRecords, input.persona);

  const result = {
    userProfile: memoryContext.userProfile,
    recentSummaries: memoryContext.recentSummaries,
    relevantMemories: alignedMemories,
    fromCache: false,
  };

  // 写入缓存
  if (input.sessionId !== undefined && input.messageCount !== undefined) {
    memoryContextCache.set({
      sessionId: input.sessionId,
      messageCount: input.messageCount,
      userId: input.userId,
      personaId: input.personaId,
      characterId: input.characterId,
      context: {
        userProfile: result.userProfile,
        recentSummaries: result.recentSummaries,
        relevantMemories: memoryRecords, // 缓存过滤前的原始数据，每次命中时重新过滤
      },
    });
  }

  return result;
}
