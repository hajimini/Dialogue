"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  AppUserRecord,
  MemoryRecord,
  Persona,
  SessionRecord,
  UserProfilePerPersonaRecord,
  UserCharacterRecord,
} from "@/lib/supabase/types";

type PersonaOption = Pick<Persona, "id" | "name" | "occupation" | "city">;
type CharacterOption = Pick<UserCharacterRecord, "id" | "name">;
type MemoryScopeOption = {
  userId: string;
  userNickname: string | null;
  userEmail: string | null;
  personaId: string;
  personaName: string;
  personaOccupation: string | null;
  personaCity: string | null;
  personaIsActive: boolean;
  characterId: string;
  characterName: string;
  characterIsActive: boolean;
  memoryCount: number;
  sessionCount: number;
  lastActivityAt: string | null;
};

type EnhancedMemoryRecord = MemoryRecord & {
  embedding_provider?: string | null;
  embedding_model?: string | null;
  embedding_dimension?: number | null;
  vector_preview?: number[];
  feedback_count_accurate?: number;
  feedback_count_inaccurate?: number;
  retrieval_count?: number;
  needs_review?: boolean;
};

type MemorySnapshot = {
  memories: EnhancedMemoryRecord[];
  profile: UserProfilePerPersonaRecord | null;
  summaries: SessionRecord[];
  total_count: number;
  has_more: boolean;
  config?: {
    EMBEDDING_PROVIDER: string;
    EMBEDDING_MODEL: string;
  };
};

type SearchResult = {
  memory: EnhancedMemoryRecord;
  similarity_score: number;
  reranker_score?: number;
  final_rank: number;
};

const PAGE_SIZE = 40;

const MEMORY_TYPES: MemoryRecord["memory_type"][] = [
  "user_fact",
  "persona_fact",
  "shared_event",
  "relationship",
  "session_summary",
];

const MEMORY_TYPE_LABELS: Record<MemoryRecord["memory_type"], string> = {
  user_fact: "用户事实",
  persona_fact: "人设事实",
  shared_event: "共同经历",
  relationship: "关系状态",
  session_summary: "会话摘要",
};

function normalizeVectorPreview(input: unknown) {
  if (Array.isArray(input)) {
    return input
      .map((value) => (typeof value === "number" ? value : Number(value)))
      .filter((value) => Number.isFinite(value));
  }

  if (typeof input === "string") {
    const trimmed = input.trim();
    const normalized =
      trimmed.startsWith("[") && trimmed.endsWith("]")
        ? trimmed.slice(1, -1)
        : trimmed;

    return normalized
      .split(",")
      .map((value) => Number(value.trim()))
      .filter((value) => Number.isFinite(value));
  }

  return [];
}

function formatDate(value: string | null) {
  if (!value) return "暂无";

  try {
    return new Intl.DateTimeFormat("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function formatDuration(value: number) {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}s`;
  }

  return `${Math.round(value)}ms`;
}

function formatRangeStart(page: number) {
  return page * PAGE_SIZE + 1;
}

function uniqueById<T extends { id: string }>(items: T[]) {
  const seen = new Set<string>();
  const result: T[] = [];

  for (const item of items) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    result.push(item);
  }

  return result;
}

export default function MemoriesClient({
  users,
  personas,
  characters,
  scopes,
}: {
  users: AppUserRecord[];
  personas: PersonaOption[];
  characters: CharacterOption[];
  scopes: MemoryScopeOption[];
}) {
  // 初始值不读 localStorage，避免 hydration mismatch
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedPersonaId, setSelectedPersonaId] = useState("");
  const [selectedCharacterId, setSelectedCharacterId] = useState("");

  // 挂载后从 localStorage 恢复上次选择
  useEffect(() => {
    const savedUserId = localStorage.getItem("admin_memories_selected_user_id");
    if (savedUserId) {
      setSelectedUserId(savedUserId);
    }

    const savedPersonaId = localStorage.getItem("admin_memories_selected_persona_id");
    if (savedPersonaId) {
      setSelectedPersonaId(savedPersonaId);
    }

    const savedCharacterId = localStorage.getItem("admin_memories_selected_character_id");
    if (savedCharacterId) {
      setSelectedCharacterId(savedCharacterId);
    }
  }, []);

  // 保存选择到 localStorage
  useEffect(() => {
    if (selectedUserId) {
      localStorage.setItem("admin_memories_selected_user_id", selectedUserId);
    }
  }, [selectedUserId]);

  useEffect(() => {
    if (selectedPersonaId) {
      localStorage.setItem("admin_memories_selected_persona_id", selectedPersonaId);
    }
  }, [selectedPersonaId]);

  useEffect(() => {
    if (selectedCharacterId) {
      localStorage.setItem("admin_memories_selected_character_id", selectedCharacterId);
    }
  }, [selectedCharacterId]);

  const [snapshot, setSnapshot] = useState<MemorySnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [queryInput, setQueryInput] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");
  const [memoryTypeFilter, setMemoryTypeFilter] = useState<"" | MemoryRecord["memory_type"]>("");
  const [reloadNonce, setReloadNonce] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftContent, setDraftContent] = useState("");
  const [draftType, setDraftType] = useState<MemoryRecord["memory_type"]>("user_fact");
  const [draftImportance, setDraftImportance] = useState("0.6");
  const [newContent, setNewContent] = useState("");
  const [newType, setNewType] = useState<MemoryRecord["memory_type"]>("user_fact");
  const [newImportance, setNewImportance] = useState("0.6");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchMetrics, setSearchMetrics] = useState<{
    embedding_time: number;
    search_time: number;
    rerank_time: number;
    total_time: number;
  } | null>(null);
  const [selectedMemoryIds, setSelectedMemoryIds] = useState<Set<string>>(new Set());
  const [batchAction, setBatchAction] = useState<"" | "delete" | "update_type" | "update_importance">("");
  const [batchType, setBatchType] = useState<MemoryRecord["memory_type"]>("user_fact");
  const [batchImportance, setBatchImportance] = useState("0.6");
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);
  const [duplicates, setDuplicates] = useState<Array<{
    group_id: string;
    memories: Array<{
      id: string;
      content: string;
      memory_type: string;
      importance: number;
      created_at: string;
      similarity: number;
    }>;
    max_similarity: number;
  }>>([]);
  const [isDetectingDuplicates, setIsDetectingDuplicates] = useState(false);
  const [duplicateThreshold, setDuplicateThreshold] = useState("0.95");

  const scopedUsers = useMemo(() => {
    if (scopes.length === 0) {
      return users;
    }

    const items = scopes.map((scope) => {
      const existing = users.find((user) => user.id === scope.userId);
      if (existing) return existing;

      return {
        id: scope.userId,
        email: scope.userEmail ?? "",
        nickname: scope.userNickname ?? scope.userEmail ?? scope.userId,
        role: "user" as const,
        created_at: null,
        last_login_at: null,
      };
    });

    return uniqueById(items);
  }, [scopes, users]);

  const scopedPersonas = useMemo(() => {
    const source =
      scopes.length > 0
        ? scopes.filter((scope) => scope.userId === selectedUserId)
        : [];

    if (source.length === 0) {
      return personas;
    }

    const items = source.map((scope) => {
      const existing = personas.find((persona) => persona.id === scope.personaId);
      if (existing) return existing;

      return {
        id: scope.personaId,
        name: scope.personaName,
        occupation: scope.personaOccupation,
        city: scope.personaCity,
      };
    });

    return uniqueById(items);
  }, [personas, scopes, selectedUserId]);

  const scopedCharacters = useMemo(() => {
    const source =
      scopes.length > 0
        ? scopes.filter(
            (scope) =>
              scope.userId === selectedUserId &&
              scope.personaId === selectedPersonaId,
          )
        : [];

    if (source.length === 0) {
      return characters;
    }

    const items = source.map((scope) => {
      const existing = characters.find((character) => character.id === scope.characterId);
      if (existing) return existing;

      return {
        id: scope.characterId,
        name: scope.characterName,
      };
    });

    return uniqueById(items);
  }, [characters, scopes, selectedPersonaId, selectedUserId]);

  useEffect(() => {
    const nextUserId =
      scopedUsers.find((user) => user.id === selectedUserId)?.id ??
      scopedUsers[0]?.id ??
      "";
    const nextPersonaId =
      scopedPersonas.find((persona) => persona.id === selectedPersonaId)?.id ??
      scopedPersonas[0]?.id ??
      "";
    const nextCharacterId =
      scopedCharacters.find((character) => character.id === selectedCharacterId)?.id ??
      scopedCharacters[0]?.id ??
      "";

    if (
      nextUserId === selectedUserId &&
      nextPersonaId === selectedPersonaId &&
      nextCharacterId === selectedCharacterId
    ) {
      return;
    }

    if (page !== 0) {
      setPage(0);
    }
    if (nextUserId !== selectedUserId) {
      setSelectedUserId(nextUserId);
    }
    if (nextPersonaId !== selectedPersonaId) {
      setSelectedPersonaId(nextPersonaId);
    }
    if (nextCharacterId !== selectedCharacterId) {
      setSelectedCharacterId(nextCharacterId);
    }
  }, [
    page,
    scopedCharacters,
    scopedPersonas,
    scopedUsers,
    selectedCharacterId,
    selectedPersonaId,
    selectedUserId,
  ]);

  const selectedUser = useMemo(
    () => scopedUsers.find((item) => item.id === selectedUserId) ?? null,
    [scopedUsers, selectedUserId],
  );
  const selectedPersona = useMemo(
    () => scopedPersonas.find((item) => item.id === selectedPersonaId) ?? null,
    [scopedPersonas, selectedPersonaId],
  );

  const totalCount = snapshot?.total_count ?? 0;
  const memories = snapshot?.memories ?? [];
  const needsReviewCount = memories.filter((memory) => memory.needs_review).length;
  const highSignalCount = memories.filter((memory) => Number(memory.importance) >= 0.8).length;
  const retrievedCount = memories.filter((memory) => (memory.retrieval_count ?? 0) > 0).length;
  const pageStart = totalCount === 0 ? 0 : formatRangeStart(page);
  const pageEnd = totalCount === 0 ? 0 : Math.min(page * PAGE_SIZE + memories.length, totalCount);
  const profileData = snapshot?.profile?.profile_data ?? null;
  const canGoPrev = page > 0;
  const canGoNext = Boolean(snapshot?.has_more);

  useEffect(() => {
    let cancelled = false;

    async function loadSnapshot() {
      if (!selectedUserId || !selectedPersonaId || !selectedCharacterId) {
        setSnapshot(null);
        return;
      }

      setIsLoading(true);
      setErrorText(null);

      try {
        const params = new URLSearchParams({
          userId: selectedUserId,
          personaId: selectedPersonaId,
          characterId: selectedCharacterId,
          limit: String(PAGE_SIZE),
          offset: String(page * PAGE_SIZE),
        });

        if (appliedQuery.trim()) {
          params.set("q", appliedQuery.trim());
        }

        if (memoryTypeFilter) {
          params.set("memoryType", memoryTypeFilter);
        }

        const response = await fetch(`/api/admin/memories?${params.toString()}`);
        const json = (await response.json()) as {
          success: boolean;
          data: MemorySnapshot | null;
          error: { message: string } | null;
        };

        if (!json.success || !json.data) {
          throw new Error(json.error?.message || "读取记忆数据失败");
        }

        if (cancelled) return;

        setSnapshot({
          ...json.data,
          memories: json.data.memories.map((memory) => ({
            ...memory,
            embedding: normalizeVectorPreview(memory.embedding),
            vector_preview: normalizeVectorPreview(memory.vector_preview),
          })),
        });
      } catch (error) {
        if (cancelled) return;
        setErrorText(error instanceof Error ? error.message : "读取记忆数据失败");
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadSnapshot();

    return () => {
      cancelled = true;
    };
  }, [
    appliedQuery,
    memoryTypeFilter,
    page,
    reloadNonce,
    selectedPersonaId,
    selectedUserId,
    selectedCharacterId,
  ]);

  useEffect(() => {
    setSearchResults([]);
    setSearchMetrics(null);
    setSearchQuery("");
    setEditingId(null);
    setSelectedMemoryIds(new Set());
  }, [selectedPersonaId, selectedUserId, selectedCharacterId]);

  async function handleCreateMemory() {
    if (!selectedUserId || !selectedPersonaId || !selectedCharacterId || !newContent.trim()) return;

    setErrorText(null);

    try {
      const response = await fetch("/api/admin/memories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: selectedUserId,
          personaId: selectedPersonaId,
          characterId: selectedCharacterId,
          memoryType: newType,
          content: newContent,
          importance: Number(newImportance),
        }),
      });
      const json = (await response.json()) as {
        success: boolean;
        error: { message: string } | null;
      };

      if (!json.success) {
        throw new Error(json.error?.message || "创建记忆失败");
      }

      setNewContent("");
      setNewType("user_fact");
      setNewImportance("0.6");
      setPage(0);
      setReloadNonce((value) => value + 1);
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "创建记忆失败");
    }
  }

  async function handleSaveMemory(memoryId: string) {
    try {
      const response = await fetch(`/api/admin/memories/${memoryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memoryType: draftType,
          content: draftContent,
          importance: Number(draftImportance),
        }),
      });
      const json = (await response.json()) as {
        success: boolean;
        error: { message: string } | null;
      };

      if (!json.success) {
        throw new Error(json.error?.message || "保存记忆失败");
      }

      setEditingId(null);
      setReloadNonce((value) => value + 1);
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "保存记忆失败");
    }
  }

  async function handleDeleteMemory(memoryId: string) {
    try {
      const response = await fetch(`/api/admin/memories/${memoryId}`, {
        method: "DELETE",
      });
      const json = (await response.json()) as {
        success: boolean;
        error: { message: string } | null;
      };

      if (!json.success) {
        throw new Error(json.error?.message || "删除记忆失败");
      }

      if (memories.length === 1 && page > 0) {
        setPage((current) => Math.max(0, current - 1));
      } else {
        setReloadNonce((value) => value + 1);
      }
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "删除记忆失败");
    }
  }

  async function handleTestSearch() {
    if (!selectedUserId || !selectedPersonaId || !selectedCharacterId || !searchQuery.trim()) return;

    setIsSearching(true);
    setErrorText(null);

    try {
      const response = await fetch("/api/admin/memories/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: selectedUserId,
          persona_id: selectedPersonaId,
          character_id: selectedCharacterId,
          query: searchQuery.trim(),
          limit: 5,
        }),
      });
      const json = (await response.json()) as {
        success: boolean;
        data:
          | {
              memories: SearchResult[];
              embedding_time: number;
              search_time: number;
              rerank_time: number;
              total_time: number;
            }
          | null;
        error: { message: string } | null;
      };

      if (!json.success || !json.data) {
        throw new Error(json.error?.message || "测试检索失败");
      }

      setSearchResults(json.data.memories);
      setSearchMetrics({
        embedding_time: json.data.embedding_time,
        search_time: json.data.search_time,
        rerank_time: json.data.rerank_time,
        total_time: json.data.total_time,
      });
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "测试检索失败");
    } finally {
      setIsSearching(false);
    }
  }

  function applyFilters() {
    setPage(0);
    setAppliedQuery(queryInput.trim());
    setReloadNonce((value) => value + 1);
  }

  function resetFilters() {
    setQueryInput("");
    setAppliedQuery("");
    setMemoryTypeFilter("");
    setPage(0);
    setReloadNonce((value) => value + 1);
  }

  function toggleMemorySelection(memoryId: string) {
    setSelectedMemoryIds((prev) => {
      const next = new Set(prev);
      if (next.has(memoryId)) {
        next.delete(memoryId);
      } else {
        next.add(memoryId);
      }
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedMemoryIds.size === memories.length) {
      setSelectedMemoryIds(new Set());
    } else {
      setSelectedMemoryIds(new Set(memories.map((m) => m.id)));
    }
  }

  async function handleBatchOperation() {
    if (selectedMemoryIds.size === 0 || !batchAction) return;

    setIsBatchProcessing(true);
    setErrorText(null);

    try {
      const body: {
        action: "delete" | "update_type" | "update_importance";
        memoryIds: string[];
        memoryType?: string;
        importance?: number;
      } = {
        action: batchAction as "delete" | "update_type" | "update_importance",
        memoryIds: Array.from(selectedMemoryIds),
      };

      if (batchAction === "update_type") {
        body.memoryType = batchType;
      } else if (batchAction === "update_importance") {
        body.importance = Number(batchImportance);
      }

      const response = await fetch("/api/admin/memories/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const json = (await response.json()) as {
        success: boolean;
        data?: { deleted_count?: number; updated_count?: number };
        error: { message: string } | null;
      };

      if (!json.success) {
        throw new Error(json.error?.message || "批量操作失败");
      }

      setSelectedMemoryIds(new Set());
      setBatchAction("");
      setPage(0);
      setReloadNonce((value) => value + 1);
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "批量操作失败");
    } finally {
      setIsBatchProcessing(false);
    }
  }

  async function handleDetectDuplicates() {
    if (!selectedUserId || !selectedPersonaId || !selectedCharacterId) return;

    setIsDetectingDuplicates(true);
    setErrorText(null);

    try {
      const response = await fetch("/api/admin/memories/duplicates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: selectedUserId,
          personaId: selectedPersonaId,
          characterId: selectedCharacterId,
          threshold: Number(duplicateThreshold),
        }),
      });

      const json = (await response.json()) as {
        success: boolean;
        data?: {
          duplicates: Array<{
            group_id: string;
            memories: Array<{
              id: string;
              content: string;
              memory_type: string;
              importance: number;
              created_at: string;
              similarity: number;
            }>;
            max_similarity: number;
          }>;
          total_groups: number;
          total_duplicates: number;
        };
        error: { message: string } | null;
      };

      if (!json.success || !json.data) {
        throw new Error(json.error?.message || "去重检测失败");
      }

      setDuplicates(json.data.duplicates);
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "去重检测失败");
    } finally {
      setIsDetectingDuplicates(false);
    }
  }

  function handleExport(format: "json" | "csv") {
    if (!selectedUserId || !selectedPersonaId) return;

    const url = `/api/admin/memories/export?userId=${encodeURIComponent(selectedUserId)}&personaId=${encodeURIComponent(selectedPersonaId)}&format=${format}`;
    window.open(url, "_blank");
  }

  return (
    <div className="mx-auto flex w-full max-w-[1640px] flex-col gap-6 px-6 py-8">
      <section className="overflow-hidden rounded-[32px] border border-[#d9e6df] bg-[radial-gradient(circle_at_top_left,_rgba(43,111,83,0.15),_transparent_38%),linear-gradient(135deg,_rgba(255,252,247,0.98),_rgba(244,250,247,0.96))] p-6 shadow-[0_20px_60px_rgba(35,63,52,0.08)]">
        <div className="grid gap-8 xl:grid-cols-[1.2fr_0.8fr]">
          <div>
            <div className="text-xs uppercase tracking-[0.26em] text-[#718079]">
              Memory Workspace
            </div>
            <h1 className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight text-[#173128]">
              记忆管理现在按用户、人设和分页视角收束，不再让整页靠长滚动硬撑。
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-[#5f6f67]">
              左侧专注筛选、补录和检索验证，右侧固定看画像与会话摘要。记忆再多，也能先看结构，再看细节。
            </p>

            <div className="mt-6 flex flex-wrap gap-3 text-sm text-[#5c6d65]">
              {selectedUser ? (
                <div className="rounded-full border border-[#d5e4dc] bg-white/82 px-4 py-2">
                  用户：{selectedUser.nickname}
                </div>
              ) : null}
              {selectedPersona ? (
                <div className="rounded-full border border-[#d5e4dc] bg-white/82 px-4 py-2">
                  人设：{selectedPersona.name}
                </div>
              ) : null}
              {scopes.length > 0 ? (
                <div className="rounded-full border border-[#d5e4dc] bg-white/82 px-4 py-2">
                  已自动对齐真实对话链路
                </div>
              ) : null}
              {snapshot?.config ? (
                <div className="rounded-full border border-[#d5e4dc] bg-white/82 px-4 py-2">
                  {snapshot.config.EMBEDDING_PROVIDER} / {snapshot.config.EMBEDDING_MODEL}
                </div>
              ) : null}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <label className="rounded-[24px] border border-white/60 bg-white/78 p-4 text-sm text-[#395a4c]">
              <div className="text-xs uppercase tracking-[0.16em] text-[#75847d]">
                User
              </div>
              <select
                value={selectedUserId}
                onChange={(event) => {
                  setSelectedUserId(event.target.value);
                  setPage(0);
                }}
                className="mt-3 w-full rounded-2xl border border-[#d7e6df] bg-white px-4 py-3 outline-none"
              >
                {scopedUsers.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.nickname} / {user.email}
                  </option>
                ))}
              </select>
            </label>

            <label className="rounded-[24px] border border-white/60 bg-white/78 p-4 text-sm text-[#395a4c]">
              <div className="text-xs uppercase tracking-[0.16em] text-[#75847d]">
                Persona
              </div>
              <select
                value={selectedPersonaId}
                onChange={(event) => {
                  setSelectedPersonaId(event.target.value);
                  setPage(0);
                }}
                className="mt-3 w-full rounded-2xl border border-[#d7e6df] bg-white px-4 py-3 outline-none"
              >
                {scopedPersonas.map((persona) => (
                  <option key={persona.id} value={persona.id}>
                    {persona.name}
                    {persona.occupation ? ` / ${persona.occupation}` : ""}
                  </option>
                ))}
              </select>
            </label>

            <label className="rounded-[24px] border border-white/60 bg-white/78 p-4 text-sm text-[#395a4c]">
              <div className="text-xs uppercase tracking-[0.16em] text-[#75847d]">
                Character
              </div>
              <select
                value={selectedCharacterId}
                onChange={(event) => {
                  setSelectedCharacterId(event.target.value);
                  setPage(0);
                }}
                className="mt-3 w-full rounded-2xl border border-[#d7e6df] bg-white px-4 py-3 outline-none"
              >
                {scopedCharacters.map((character) => (
                  <option key={character.id} value={character.id}>
                    {character.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {errorText ? (
          <div className="mt-6 rounded-[22px] border border-[#efd7d7] bg-[#fff5f5] px-4 py-3 text-sm text-[#a23d3d]">
            {errorText}
          </div>
        ) : null}
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "当前页记忆",
            value: memories.length,
            note: totalCount > 0 ? `第 ${page + 1} 页，范围 ${pageStart}-${pageEnd}` : "当前没有可展示的记忆",
          },
          {
            label: "筛选后总量",
            value: totalCount,
            note: appliedQuery ? `关键词：${appliedQuery}` : "未启用关键词筛选",
          },
          {
            label: "待复核",
            value: needsReviewCount,
            note: "当前页反馈不佳或需人工复核的条目",
          },
          {
            label: "高信号记忆",
            value: highSignalCount,
            note: `${retrievedCount} 条已有检索命中记录`,
          },
        ].map((item) => (
          <div
            key={item.label}
            className="rounded-[26px] border border-[#dde8e2] bg-white/88 px-5 py-5 shadow-[0_16px_40px_rgba(43,62,53,0.06)]"
          >
            <div className="text-sm text-[#73827b]">{item.label}</div>
            <div className="mt-2 text-3xl font-semibold text-[#173128]">{item.value}</div>
            <div className="mt-2 text-xs leading-6 text-[#66766f]">{item.note}</div>
          </div>
        ))}
      </section>

      {/* 导出功能 */}
      <section className="rounded-[26px] border border-[#dde8e2] bg-white/88 p-4 shadow-[0_16px_40px_rgba(43,62,53,0.06)]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-sm font-medium text-[#173128]">数据导出</div>
            <div className="mt-1 text-xs text-[#66766f]">
              导出当前用户和人设的所有记忆数据
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => handleExport("json")}
              className="rounded-full border border-[#d7e6df] bg-white px-4 py-2 text-sm text-[#35584a] transition hover:bg-[#f7fbf8]"
            >
              导出 JSON
            </button>
            <button
              type="button"
              onClick={() => handleExport("csv")}
              className="rounded-full border border-[#d7e6df] bg-white px-4 py-2 text-sm text-[#35584a] transition hover:bg-[#f7fbf8]"
            >
              导出 CSV
            </button>
          </div>
        </div>
      </section>

      {/* 分析工具导航 */}
      <section className="rounded-[26px] border border-[#dde8e2] bg-white/88 p-4 shadow-[0_16px_40px_rgba(43,62,53,0.06)]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-sm font-medium text-[#173128]">分析工具</div>
            <div className="mt-1 text-xs text-[#66766f]">
              查看记忆统计、时间线、关系图和质量评分
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <a
              href="/admin/memories/stats"
              className="rounded-full border border-[#d7e6df] bg-white px-4 py-2 text-sm text-[#35584a] transition hover:bg-[#f7fbf8]"
            >
              📊 统计仪表板
            </a>
            <a
              href="/admin/memories/timeline"
              className="rounded-full border border-[#d7e6df] bg-white px-4 py-2 text-sm text-[#35584a] transition hover:bg-[#f7fbf8]"
            >
              📅 时间线
            </a>
            <a
              href="/admin/memories/graph"
              className="rounded-full border border-[#d7e6df] bg-white px-4 py-2 text-sm text-[#35584a] transition hover:bg-[#f7fbf8]"
            >
              🕸️ 关系图
            </a>
            <a
              href="/admin/memories/quality"
              className="rounded-full border border-[#d7e6df] bg-white px-4 py-2 text-sm text-[#35584a] transition hover:bg-[#f7fbf8]"
            >
              ⭐ 质量评分
            </a>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.12fr)_360px]">
        <div className="space-y-6">
          <section className="rounded-[30px] border border-[#dde8e2] bg-white/90 p-6 shadow-[0_18px_50px_rgba(46,69,58,0.08)]">
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_420px]">
              <div>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-semibold text-[#173128]">记忆筛选台</h2>
                    <p className="mt-1 text-sm text-[#66766f]">
                      先锁定范围，再进入编辑和复核，避免一次加载过多记录。
                    </p>
                  </div>
                  {isLoading ? (
                    <div className="rounded-full bg-[#f3f8f5] px-3 py-1 text-xs text-[#50665b]">
                      加载中...
                    </div>
                  ) : null}
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_190px_auto_auto]">
                  <input
                    value={queryInput}
                    onChange={(event) => setQueryInput(event.target.value)}
                    className="rounded-2xl border border-[#d7e6df] bg-white px-4 py-3 outline-none"
                    placeholder="搜索记忆内容，例如：展览、加班、家里那只猫"
                  />
                  <select
                    value={memoryTypeFilter}
                    onChange={(event) =>
                      setMemoryTypeFilter(
                        event.target.value as "" | MemoryRecord["memory_type"],
                      )
                    }
                    className="rounded-2xl border border-[#d7e6df] bg-white px-4 py-3 outline-none"
                  >
                    <option value="">全部类型</option>
                    {MEMORY_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {MEMORY_TYPE_LABELS[type]}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={applyFilters}
                    className="rounded-full bg-[#1f6b50] px-5 py-3 text-sm font-medium text-white transition hover:bg-[#18543f]"
                  >
                    应用筛选
                  </button>
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="rounded-full border border-[#d7e6df] bg-white px-5 py-3 text-sm font-medium text-[#35584a] transition hover:bg-[#f7fbf8]"
                  >
                    重置
                  </button>
                </div>

                <div className="mt-4 flex flex-wrap gap-2 text-xs text-[#657770]">
                  <span className="rounded-full bg-[#f4f8f6] px-3 py-1">
                    展示范围：{pageStart}-{pageEnd} / {totalCount || 0}
                  </span>
                  <span className="rounded-full bg-[#f4f8f6] px-3 py-1">
                    类型：{memoryTypeFilter ? MEMORY_TYPE_LABELS[memoryTypeFilter] : "全部"}
                  </span>
                  <span className="rounded-full bg-[#f4f8f6] px-3 py-1">
                    画像锚点：{profileData?.anchors?.length ?? 0}
                  </span>
                </div>
              </div>

              <div className="rounded-[24px] border border-dashed border-[#d8e6df] bg-[#fbfefc] p-4">
                <div className="text-sm font-medium text-[#345949]">补录一条记忆</div>
                <div className="mt-3 grid gap-3">
                  <select
                    value={newType}
                    onChange={(event) =>
                      setNewType(event.target.value as MemoryRecord["memory_type"])
                    }
                    className="rounded-2xl border border-[#d7e6df] bg-white px-4 py-3 outline-none"
                  >
                    {MEMORY_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {MEMORY_TYPE_LABELS[type]}
                      </option>
                    ))}
                  </select>
                  <input
                    value={newImportance}
                    onChange={(event) => setNewImportance(event.target.value)}
                    className="rounded-2xl border border-[#d7e6df] bg-white px-4 py-3 outline-none"
                    placeholder="重要度 0-1"
                  />
                  <textarea
                    value={newContent}
                    onChange={(event) => setNewContent(event.target.value)}
                    rows={4}
                    className="rounded-2xl border border-[#d7e6df] bg-white px-4 py-3 outline-none"
                    placeholder="输入需要长期保存的记忆内容"
                  />
                  <button
                    type="button"
                    onClick={() => void handleCreateMemory()}
                    className="rounded-full bg-[#214f42] px-5 py-3 text-sm font-medium text-white transition hover:bg-[#183c32]"
                  >
                    写入记忆
                  </button>
                </div>
              </div>
            </div>
          </section>
          <section className="rounded-[30px] border border-[#dde8e2] bg-white/90 p-6 shadow-[0_18px_50px_rgba(46,69,58,0.08)]">
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_360px]">
              <div className="min-w-0">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-semibold text-[#173128]">记忆列表</h2>
                    <p className="mt-1 text-sm text-[#66766f]">
                      仅把当前页放进滚动容器里，编辑和浏览都不会拖垮整页操作。
                    </p>
                  </div>
                  <div className="rounded-full bg-[#f4f8f6] px-3 py-1 text-xs text-[#50665b]">
                    每页 {PAGE_SIZE} 条
                  </div>
                </div>

                {/* 批量操作工具栏 */}
                {selectedMemoryIds.size > 0 && (
                  <div className="mt-4 rounded-[22px] border border-[#d4e3db] bg-[#edf7f2] p-4">
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="text-sm font-medium text-[#2f684f]">
                        已选择 {selectedMemoryIds.size} 条记忆
                      </div>
                      <select
                        value={batchAction}
                        onChange={(event) => setBatchAction(event.target.value as "" | "delete" | "update_type" | "update_importance")}
                        className="rounded-full border border-[#d7e6df] bg-white px-4 py-2 text-sm outline-none"
                      >
                        <option value="">选择操作</option>
                        <option value="delete">批量删除</option>
                        <option value="update_type">批量修改类型</option>
                        <option value="update_importance">批量修改重要度</option>
                      </select>

                      {batchAction === "update_type" && (
                        <select
                          value={batchType}
                          onChange={(event) => setBatchType(event.target.value as MemoryRecord["memory_type"])}
                          className="rounded-full border border-[#d7e6df] bg-white px-4 py-2 text-sm outline-none"
                        >
                          {MEMORY_TYPES.map((type) => (
                            <option key={type} value={type}>
                              {MEMORY_TYPE_LABELS[type]}
                            </option>
                          ))}
                        </select>
                      )}

                      {batchAction === "update_importance" && (
                        <input
                          type="number"
                          min="0"
                          max="1"
                          step="0.1"
                          value={batchImportance}
                          onChange={(event) => setBatchImportance(event.target.value)}
                          className="w-24 rounded-full border border-[#d7e6df] bg-white px-4 py-2 text-sm outline-none"
                          placeholder="0.0-1.0"
                        />
                      )}

                      <button
                        type="button"
                        onClick={() => void handleBatchOperation()}
                        disabled={!batchAction || isBatchProcessing}
                        className="rounded-full bg-[#1f6b50] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#17563f] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isBatchProcessing ? "处理中..." : "执行"}
                      </button>

                      <button
                        type="button"
                        onClick={() => setSelectedMemoryIds(new Set())}
                        className="rounded-full border border-[#d7e6df] bg-white px-4 py-2 text-sm text-[#35584a] transition hover:bg-[#f7fbf8]"
                      >
                        取消选择
                      </button>
                    </div>
                  </div>
                )}

                <div className="mt-4 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={toggleSelectAll}
                    className="rounded-full border border-[#d7e6df] bg-white px-4 py-2 text-sm text-[#35584a] transition hover:bg-[#f7fbf8]"
                  >
                    {selectedMemoryIds.size === memories.length ? "取消全选" : "全选当前页"}
                  </button>
                  <div className="text-xs text-[#657770]">
                    {selectedMemoryIds.size > 0 && `已选择 ${selectedMemoryIds.size} 条`}
                  </div>
                </div>

                <div className="mt-5 max-h-[calc(100vh-22rem)] space-y-4 overflow-y-auto pr-1">
                  {memories.length > 0 ? (
                    memories.map((memory) => {
                      const isEditing = editingId === memory.id;
                      const fullEmbedding = normalizeVectorPreview(memory.embedding);
                      const normalizedVectorPreview = normalizeVectorPreview(
                        memory.vector_preview,
                      );
                      const vectorPreview =
                        normalizedVectorPreview.length > 0
                          ? normalizedVectorPreview
                          : fullEmbedding.slice(0, 8);

                      return (
                        <article
                          key={memory.id}
                          className="rounded-[24px] border border-[#e7eee9] bg-[#fcfefd] p-5"
                        >
                          <div className="flex items-start gap-3">
                            <input
                              type="checkbox"
                              checked={selectedMemoryIds.has(memory.id)}
                              onChange={() => toggleMemorySelection(memory.id)}
                              className="mt-1 h-4 w-4 cursor-pointer rounded border-[#d7e6df] text-[#1f6b50] focus:ring-[#1f6b50]"
                            />
                            <div className="flex-1">
                              <div className="flex flex-wrap items-center gap-2 text-xs">
                                <span className="rounded-full bg-[#edf7f2] px-3 py-1 text-[#305f4c]">
                                  {MEMORY_TYPE_LABELS[memory.memory_type]}
                                </span>
                                <span className="rounded-full bg-[#fff5e8] px-3 py-1 text-[#8b6127]">
                                  importance {Number(memory.importance).toFixed(2)}
                                </span>
                                <span className="rounded-full bg-white px-3 py-1 text-[#536961]">
                                  retrieval {memory.retrieval_count ?? 0}
                                </span>
                                <span className="rounded-full bg-white px-3 py-1 text-[#536961]">
                                  准确 {memory.feedback_count_accurate ?? 0} / 不准{" "}
                                  {memory.feedback_count_inaccurate ?? 0}
                                </span>
                                {memory.needs_review ? (
                                  <span className="rounded-full bg-[#fff0ef] px-3 py-1 text-[#b05545]">
                                    需要复核
                                  </span>
                                ) : null}
                                <span className="ml-auto text-[#7e7062]">
                                  更新于 {formatDate(memory.updated_at)}
                                </span>
                              </div>

                          {isEditing ? (
                            <div className="mt-4 space-y-3">
                              <div className="grid gap-3 md:grid-cols-[180px_140px_minmax(0,1fr)]">
                                <select
                                  value={draftType}
                                  onChange={(event) =>
                                    setDraftType(
                                      event.target.value as MemoryRecord["memory_type"],
                                    )
                                  }
                                  className="rounded-2xl border border-[#d7e6df] bg-white px-4 py-3 outline-none"
                                >
                                  {MEMORY_TYPES.map((type) => (
                                    <option key={type} value={type}>
                                      {MEMORY_TYPE_LABELS[type]}
                                    </option>
                                  ))}
                                </select>
                                <input
                                  value={draftImportance}
                                  onChange={(event) => setDraftImportance(event.target.value)}
                                  className="rounded-2xl border border-[#d7e6df] bg-white px-4 py-3 outline-none"
                                />
                                <textarea
                                  value={draftContent}
                                  onChange={(event) => setDraftContent(event.target.value)}
                                  rows={4}
                                  className="rounded-2xl border border-[#d7e6df] bg-white px-4 py-3 outline-none"
                                />
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={() => void handleSaveMemory(memory.id)}
                                  className="rounded-full bg-[#1f8a5b] px-4 py-2 text-sm text-white"
                                >
                                  保存
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingId(null)}
                                  className="rounded-full border border-[#dadfd8] px-4 py-2 text-sm text-[#52675d]"
                                >
                                  取消
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="mt-4 whitespace-pre-wrap text-sm leading-7 text-[#3d544a]">
                                {memory.content}
                              </div>

                              <div className="mt-4 grid gap-2 text-xs text-[#5d7469] md:grid-cols-2">
                                <div className="rounded-2xl bg-[#f6fbf8] px-3 py-2">
                                  {memory.embedding_provider ?? "unknown"} /{" "}
                                  {memory.embedding_model ?? "unknown"} / dim{" "}
                                  {memory.embedding_dimension ?? fullEmbedding.length}
                                </div>
                                <div className="rounded-2xl bg-[#f6fbf8] px-3 py-2">
                                  向量预览：
                                  {vectorPreview.length > 0
                                    ? vectorPreview
                                        .map((value) => value.toFixed(3))
                                        .join(", ")
                                    : "暂无"}
                                </div>
                              </div>

                              <div className="mt-4 flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingId(memory.id);
                                    setDraftType(memory.memory_type);
                                    setDraftContent(memory.content);
                                    setDraftImportance(String(memory.importance));
                                  }}
                                  className="rounded-full border border-[#d7e5de] bg-white px-4 py-2 text-sm text-[#31574a]"
                                >
                                  编辑
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void handleDeleteMemory(memory.id)}
                                  className="rounded-full border border-[#efd8d8] bg-[#fff7f7] px-4 py-2 text-sm text-[#a04b4b]"
                                >
                                  删除
                                </button>
                              </div>
                            </>
                          )}
                            </div>
                          </div>
                        </article>
                      );
                    })
                  ) : (
                    <div className="rounded-[24px] border border-dashed border-[#d9e4de] bg-[#fbfdfc] px-4 py-10 text-sm text-[#72827b]">
                      当前筛选范围内还没有可展示的记忆。
                    </div>
                  )}
                </div>

                <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[#ebf0ec] pt-4 text-sm text-[#66766f]">
                  <div>
                    当前显示 {pageStart}-{pageEnd}，共 {totalCount} 条
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setPage((current) => Math.max(0, current - 1))}
                      disabled={!canGoPrev}
                      className="rounded-full border border-[#d7e6df] bg-white px-4 py-2 text-[#35584a] disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      上一页
                    </button>
                    <button
                      type="button"
                      onClick={() => setPage((current) => current + 1)}
                      disabled={!canGoNext}
                      className="rounded-full bg-[#204f42] px-4 py-2 text-white disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      下一页
                    </button>
                  </div>
                </div>
              </div>

              <aside className="min-w-0 space-y-4">
                <div className="rounded-[24px] border border-dashed border-[#d8e6df] bg-[#fbfefc] p-4">
                  <div className="text-sm font-medium text-[#345949]">检索演练</div>
                  <p className="mt-1 text-xs leading-6 text-[#66766f]">
                    用一句自然表达测试当前用户和人设下的记忆召回效果。
                  </p>
                  <textarea
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    rows={4}
                    className="mt-3 w-full rounded-2xl border border-[#d7e6df] bg-white px-4 py-3 outline-none"
                    placeholder="例如：我上次说的那个展你还记得吗？"
                  />
                  <button
                    type="button"
                    onClick={() => void handleTestSearch()}
                    className="mt-3 w-full rounded-full bg-[#214f42] px-5 py-3 text-sm font-medium text-white transition hover:bg-[#183c32]"
                  >
                    {isSearching ? "检索中..." : "运行检索测试"}
                  </button>

                  {searchMetrics ? (
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-[#5f766c]">
                      <span className="rounded-full bg-white px-3 py-1">
                        embedding {formatDuration(searchMetrics.embedding_time)}
                      </span>
                      <span className="rounded-full bg-white px-3 py-1">
                        search {formatDuration(searchMetrics.search_time)}
                      </span>
                      <span className="rounded-full bg-white px-3 py-1">
                        rerank {formatDuration(searchMetrics.rerank_time)}
                      </span>
                      <span className="rounded-full bg-white px-3 py-1">
                        total {formatDuration(searchMetrics.total_time)}
                      </span>
                    </div>
                  ) : null}

                  <div className="mt-4 max-h-[420px] space-y-3 overflow-y-auto pr-1">
                    {searchResults.length > 0 ? (
                      searchResults.map((result) => (
                        <div
                          key={`${result.memory.id}-${result.final_rank}`}
                          className="rounded-[20px] border border-[#e7eee9] bg-white p-4"
                        >
                          <div className="flex flex-wrap gap-2 text-xs">
                            <span className="rounded-full bg-[#edf7f2] px-3 py-1 text-[#2d6754]">
                              rank {result.final_rank}
                            </span>
                            <span className="rounded-full bg-[#fff6e8] px-3 py-1 text-[#8c6125]">
                              相似度 {result.similarity_score.toFixed(2)}
                            </span>
                            {typeof result.reranker_score === "number" ? (
                              <span className="rounded-full bg-[#eef3ff] px-3 py-1 text-[#3157a6]">
                                重排 {result.reranker_score.toFixed(2)}
                              </span>
                            ) : null}
                          </div>
                          <div className="mt-3 text-sm leading-7 text-[#39554a]">
                            {result.memory.content}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-[20px] border border-dashed border-[#d9e4de] bg-white px-4 py-8 text-sm text-[#72827b]">
                        还没有检索结果。
                      </div>
                    )}
                  </div>
                </div>

                {/* 去重检测面板 */}
                <div className="rounded-[24px] border border-dashed border-[#d8e6df] bg-[#fbfefc] p-4">
                  <div className="text-sm font-medium text-[#345949]">记忆去重检测</div>
                  <p className="mt-1 text-xs leading-6 text-[#66766f]">
                    检测相似或重复的记忆，帮助清理冗余数据。
                  </p>
                  <div className="mt-3 flex items-center gap-2">
                    <label className="text-xs text-[#66766f]">相似度阈值</label>
                    <input
                      type="number"
                      min="0.5"
                      max="1"
                      step="0.05"
                      value={duplicateThreshold}
                      onChange={(event) => setDuplicateThreshold(event.target.value)}
                      className="w-20 rounded-full border border-[#d7e6df] bg-white px-3 py-1 text-sm outline-none"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleDetectDuplicates()}
                    disabled={isDetectingDuplicates}
                    className="mt-3 w-full rounded-full bg-[#214f42] px-5 py-3 text-sm font-medium text-white transition hover:bg-[#183c32] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isDetectingDuplicates ? "检测中..." : "开始检测"}
                  </button>

                  {duplicates.length > 0 && (
                    <div className="mt-4">
                      <div className="mb-2 text-xs text-[#66766f]">
                        发现 {duplicates.length} 组重复记忆，共 {duplicates.reduce((sum, g) => sum + g.memories.length, 0)} 条
                      </div>
                      <div className="max-h-[420px] space-y-3 overflow-y-auto pr-1">
                        {duplicates.map((group) => (
                          <div
                            key={group.group_id}
                            className="rounded-[20px] border border-[#f0ddd8] bg-[#fff8f6] p-4"
                          >
                            <div className="mb-2 flex items-center justify-between text-xs">
                              <span className="font-medium text-[#7b3d33]">
                                相似度 {(group.max_similarity * 100).toFixed(0)}%
                              </span>
                              <span className="text-[#9d6b61]">{group.memories.length} 条</span>
                            </div>
                            <div className="space-y-2">
                              {group.memories.map((memory) => (
                                <div
                                  key={memory.id}
                                  className="rounded-lg border border-[#e7eee9] bg-white p-3"
                                >
                                  <div className="flex items-center gap-2 text-xs">
                                    <input
                                      type="checkbox"
                                      checked={selectedMemoryIds.has(memory.id)}
                                      onChange={() => toggleMemorySelection(memory.id)}
                                      className="h-3 w-3 cursor-pointer rounded border-[#d7e6df] text-[#1f6b50]"
                                    />
                                    <span className="rounded-full bg-[#edf7f2] px-2 py-0.5 text-[#305f4c]">
                                      {MEMORY_TYPE_LABELS[memory.memory_type as MemoryRecord["memory_type"]]}
                                    </span>
                                    <span className="text-[#7a6c5d]">
                                      {formatDate(memory.created_at)}
                                    </span>
                                  </div>
                                  <div className="mt-2 text-sm leading-6 text-[#39554a]">
                                    {memory.content.slice(0, 100)}
                                    {memory.content.length > 100 ? "..." : ""}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {duplicates.length === 0 && !isDetectingDuplicates && (
                    <div className="mt-4 rounded-[20px] border border-dashed border-[#d9e4de] bg-white px-4 py-8 text-sm text-[#72827b]">
                      还没有检测结果。
                    </div>
                  )}
                </div>
              </aside>
            </div>
          </section>
        </div>
        <div className="space-y-6">
          <section className="rounded-[30px] border border-[#dde8e2] bg-white/90 p-6 shadow-[0_18px_50px_rgba(46,69,58,0.08)]">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-[#173128]">用户画像</h2>
                <p className="mt-1 text-sm text-[#66766f]">
                  这里固定展示关系阶段和高频锚点，不用在记忆列表里来回找。
                </p>
              </div>
              {snapshot?.profile ? (
                <div className="rounded-full bg-[#fff5e8] px-3 py-1 text-xs text-[#8b6127]">
                  {snapshot.profile.relationship_stage} / {snapshot.profile.total_messages} 条消息
                </div>
              ) : null}
            </div>

            {snapshot?.profile && profileData ? (
              <div className="mt-5 space-y-4 text-sm text-[#455c53]">
                <div className="rounded-[22px] border border-[#e8efe9] bg-[#f9fcfa] p-4 leading-7">
                  {profileData.summary || "暂无画像摘要"}
                </div>

                {(
                  [
                    ["事实", profileData.facts],
                    ["偏好", profileData.preferences],
                    ["关系备注", profileData.relationship_notes],
                    ["近期话题", profileData.recent_topics],
                    ["记忆锚点", profileData.anchors],
                  ] as const
                ).map(([label, items]) => (
                  <div key={label}>
                    <div className="text-sm font-medium text-[#31584a]">{label}</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {items.length > 0 ? (
                        items.map((item) => (
                          <span
                            key={`${label}-${item}`}
                            className="rounded-full border border-[#d8e8e0] bg-white px-3 py-1 text-xs text-[#466458]"
                          >
                            {item}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-[#7a6c5d]">暂无</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-5 rounded-[22px] border border-dashed border-[#d9e4de] bg-[#fbfdfc] px-4 py-10 text-sm text-[#72827b]">
                当前用户和人设还没有生成画像。
              </div>
            )}
          </section>

          <section className="rounded-[30px] border border-[#dde8e2] bg-white/90 p-6 shadow-[0_18px_50px_rgba(46,69,58,0.08)]">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-[#173128]">会话摘要</h2>
                <p className="mt-1 text-sm text-[#66766f]">
                  把当前人设下最近的总结固定在侧栏，方便对照记忆是否衔接正确。
                </p>
              </div>
              <div className="rounded-full bg-[#f4f8f6] px-3 py-1 text-xs text-[#50665b]">
                {snapshot?.summaries.length ?? 0} 条
              </div>
            </div>

            <div className="mt-5 max-h-[calc(100vh-20rem)] space-y-3 overflow-y-auto pr-1">
              {snapshot?.summaries.length ? (
                snapshot.summaries.map((session) => (
                  <div
                    key={session.id}
                    className="rounded-[22px] border border-[#e7eee9] bg-[#fcfefd] p-4"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="text-sm font-medium text-[#35584a]">
                        Session {session.id.slice(0, 8)}
                      </div>
                      <div className="text-xs text-[#8b7a69]">
                        {formatDate(session.last_message_at)}
                      </div>
                    </div>
                    <div className="mt-3 text-sm leading-7 text-[#4d655b]">
                      {session.summary}
                    </div>
                    {session.topics && session.topics.length > 0 ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {session.topics.map((topic) => (
                          <span
                            key={topic}
                            className="rounded-full border border-[#d8e8e0] bg-white px-3 py-1 text-xs text-[#466458]"
                          >
                            {topic}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))
              ) : (
                <div className="rounded-[22px] border border-dashed border-[#d9e4de] bg-[#fbfdfc] px-4 py-10 text-sm text-[#72827b]">
                  还没有会话摘要。
                </div>
              )}
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}
