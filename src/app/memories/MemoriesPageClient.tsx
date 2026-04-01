"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type PersonaOption = {
  id: string;
  name: string;
};

type CharacterOption = {
  id: string;
  name: string;
};

type PersonalMemory = {
  id: string;
  content: string;
  memory_type: string;
  persona_id: string;
  persona_name: string;
  character_id: string | null;
  source_session_id: string | null;
  created_at: string | null;
  updated_at: string | null;
};

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

export default function MemoriesPageClient({
  personas,
  characters,
}: {
  personas: PersonaOption[];
  characters: CharacterOption[];
}) {
  const [items, setItems] = useState<PersonalMemory[]>([]);
  const [selectedPersonaId, setSelectedPersonaId] = useState("all");
  const [selectedCharacterId, setSelectedCharacterId] = useState("all");
  const [selectedType, setSelectedType] = useState("all");
  const [keyword, setKeyword] = useState("");
  const [debouncedKeyword, setDebouncedKeyword] = useState("");
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // 300ms 防抖，避免每次击键都触发请求
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedKeyword(keyword);
      setPage(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [keyword]);

  const pageSize = 50;

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    params.set("limit", String(pageSize));
    params.set("offset", String(page * pageSize));
    if (selectedPersonaId !== "all") params.set("persona_id", selectedPersonaId);
    if (selectedCharacterId !== "all") params.set("character_id", selectedCharacterId);
    if (selectedType !== "all") params.set("memory_type", selectedType);
    if (debouncedKeyword.trim()) params.set("q", debouncedKeyword.trim());
    return params.toString();
  }, [debouncedKeyword, page, selectedPersonaId, selectedCharacterId, selectedType]);

  const loadMemories = useCallback(async () => {
    setIsLoading(true);
    setErrorText(null);

    try {
      const response = await fetch(`/api/memories?${queryString}`);
      const json = (await response.json()) as {
        success: boolean;
        data:
          | {
              memories: PersonalMemory[];
              total_count: number;
              has_more: boolean;
            }
          | null;
        error: { message: string } | null;
      };

      if (!json.success || !json.data) {
        throw new Error(json.error?.message || "读取个人记忆失败");
      }

      setItems(json.data.memories);
      setTotalCount(json.data.total_count);
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "读取个人记忆失败");
    } finally {
      setIsLoading(false);
    }
  }, [queryString]);

  async function handleDelete(memoryId: string) {
    setDeletingId(memoryId);
    setErrorText(null);

    try {
      const response = await fetch(`/api/memories/${memoryId}`, {
        method: "DELETE",
      });
      const json = (await response.json()) as {
        success: boolean;
        error: { message: string } | null;
      };

      if (!json.success) {
        throw new Error(json.error?.message || "删除记忆失败");
      }

      await loadMemories();
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "删除记忆失败");
    } finally {
      setDeletingId(null);
    }
  }

  useEffect(() => {
    void loadMemories();
  }, [loadMemories]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-10">
      <section className="rounded-[30px] border border-white/60 bg-white/88 p-6 shadow-[0_18px_50px_rgba(46,69,58,0.08)]">
        <h1 className="text-2xl font-semibold text-[#1f2f28]">我的记忆</h1>
        <p className="mt-2 text-sm leading-7 text-[#6d6257]">
          这里可以看到系统当前保存的长期记忆，也可以把不想保留的内容删掉。
        </p>

        <div className="mt-5 grid gap-3 md:grid-cols-[1.1fr_0.7fr_0.7fr_0.7fr_auto]">
          <input
            value={keyword}
            onChange={(event) => {
              setKeyword(event.target.value);
            }}
            placeholder="搜索记忆内容"
            className="rounded-2xl border border-[#d7e6df] bg-white px-4 py-3 outline-none"
          />

          <select
            value={selectedPersonaId}
            onChange={(event) => {
              setSelectedPersonaId(event.target.value);
              setPage(0);
            }}
            className="rounded-2xl border border-[#d7e6df] bg-white px-4 py-3 outline-none"
          >
            <option value="all">全部人设</option>
            {personas.map((persona) => (
              <option key={persona.id} value={persona.id}>
                {persona.name}
              </option>
            ))}
          </select>

          <select
            value={selectedCharacterId}
            onChange={(event) => {
              setSelectedCharacterId(event.target.value);
              setPage(0);
            }}
            className="rounded-2xl border border-[#d7e6df] bg-white px-4 py-3 outline-none"
          >
            <option value="all">全部角色</option>
            {characters.map((character) => (
              <option key={character.id} value={character.id}>
                {character.name}
              </option>
            ))}
          </select>

          <select
            value={selectedType}
            onChange={(event) => {
              setSelectedType(event.target.value);
              setPage(0);
            }}
            className="rounded-2xl border border-[#d7e6df] bg-white px-4 py-3 outline-none"
          >
            <option value="all">全部类型</option>
            <option value="user_fact">user_fact</option>
            <option value="persona_fact">persona_fact</option>
            <option value="shared_event">shared_event</option>
            <option value="relationship">relationship</option>
            <option value="session_summary">session_summary</option>
          </select>

          <div className="rounded-2xl border border-[#d7e6df] bg-[#f8fbfa] px-4 py-3 text-sm text-[#52675d]">
            共 {totalCount} 条
          </div>
        </div>

        {errorText ? (
          <div className="mt-4 rounded-2xl border border-[#efd7d7] bg-[#fff5f5] px-4 py-3 text-sm text-[#a23d3d]">
            {errorText}
          </div>
        ) : null}
      </section>

      <section className="rounded-[30px] border border-[#dde8e2] bg-white/90 p-6 shadow-[0_18px_50px_rgba(46,69,58,0.08)]">
        <div className="flex items-center justify-between gap-4 pb-4 border-b border-[#ebf0ec]">
          <div>
            <h2 className="text-xl font-semibold text-[#1f2f28]">记忆列表</h2>
            <p className="mt-1 text-sm text-[#6d6257]">
              当前页 {items.length} 条，共 {totalCount} 条记忆
            </p>
          </div>
          {isLoading && (
            <div className="rounded-full bg-[#f3f8f5] px-3 py-1 text-xs text-[#50665b]">
              加载中...
            </div>
          )}
        </div>

        <div className="mt-5 max-h-[calc(100vh-26rem)] space-y-4 overflow-y-auto pr-2">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="h-32 animate-pulse rounded-[28px] border border-[#e7efe9] bg-white/75"
              />
            ))
          ) : items.length > 0 ? (
            items.map((memory) => (
              <article
                key={memory.id}
                className="rounded-[28px] border border-[#e7eee9] bg-[#fcfefd] p-6 shadow-sm transition hover:shadow-md"
              >
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-full bg-[#edf7f2] px-3 py-1 text-[#2d6754]">
                    {memory.memory_type}
                  </span>
                  <span className="rounded-full bg-[#fff7ea] px-3 py-1 text-[#8f6122]">
                    {memory.persona_name}
                  </span>
                  <span className="text-[#7b6d5f]">更新于 {formatDate(memory.updated_at)}</span>
                </div>

                <div className="mt-4 whitespace-pre-wrap text-sm leading-7 text-[#355246]">
                  {memory.content}
                </div>

                <div className="mt-4 flex items-center justify-between gap-4">
                  <div className="text-xs text-[#7b6d5f]">
                    来源会话：{memory.source_session_id ? memory.source_session_id.slice(0, 8) : "暂无"}
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleDelete(memory.id)}
                    disabled={deletingId === memory.id}
                    className="rounded-full border border-[#eddada] bg-[#fff8f8] px-4 py-2 text-sm text-[#9a4d4d] transition hover:bg-[#fff0f0] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {deletingId === memory.id ? "删除中..." : "删除记忆"}
                  </button>
                </div>
              </article>
            ))
          ) : (
            <div className="rounded-[28px] border border-dashed border-[#d8e8e0] px-6 py-12 text-center text-sm text-[#648174]">
              目前没有符合筛选条件的记忆。
            </div>
          )}
        </div>
      </section>

      <div className="flex items-center justify-between rounded-[24px] border border-[#dde8e2] bg-white/90 px-6 py-4 shadow-sm">
        <button
          type="button"
          onClick={() => setPage((current) => Math.max(0, current - 1))}
          disabled={page === 0}
          className="rounded-full border border-[#d7e6df] bg-white px-5 py-2.5 text-sm text-[#31574a] transition hover:bg-[#f7fbf8] disabled:cursor-not-allowed disabled:opacity-50"
        >
          上一页
        </button>
        <div className="text-sm text-[#648174]">
          第 {page + 1} 页 · 共 {totalCount} 条记忆
        </div>
        <button
          type="button"
          onClick={() => setPage((current) => current + 1)}
          disabled={(page + 1) * pageSize >= totalCount}
          className="rounded-full bg-[#1f6b50] px-5 py-2.5 text-sm text-white transition hover:bg-[#17563f] disabled:cursor-not-allowed disabled:opacity-50"
        >
          下一页
        </button>
      </div>
    </div>
  );
}
