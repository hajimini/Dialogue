"use client";

import { useMemo, useState } from "react";

export type MemoryContextItem = {
  id: string;
  content: string;
  memory_type: string;
  similarity_score: number;
  reranker_score?: number | null;
  final_rank?: number | null;
};

type MemoryContextPanelProps = {
  memories: MemoryContextItem[];
  userProfile: string | null;
  isLoading: boolean;
  onFeedback: (memoryId: string) => Promise<void> | void;
  pendingMemoryId?: string | null;
};

function formatScore(value: number | null | undefined) {
  if (typeof value !== "number" || Number.isNaN(value)) return "0.00";
  return value.toFixed(2);
}

export function MemoryContextPanel({
  memories,
  userProfile,
  isLoading,
  onFeedback,
  pendingMemoryId = null,
}: MemoryContextPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const memoryCount = memories.length;
  const statusText = useMemo(() => {
    if (isLoading) return "正在检索相关记忆...";
    if (memoryCount === 0 && !userProfile) return "这次没有命中长期记忆，会用基础上下文继续聊。";
    return `已加载 ${memoryCount} 条相关记忆`;
  }, [isLoading, memoryCount, userProfile]);

  return (
    <section className="rounded-[24px] border border-[#d9eee6] bg-[linear-gradient(180deg,_rgba(247,252,249,0.96),_rgba(238,248,243,0.92))] p-4">
      <button
        type="button"
        onClick={() => setExpanded((current) => !current)}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <div>
          <div className="text-sm font-semibold text-[#244f41]">记忆上下文</div>
          <div className="mt-1 text-xs text-[#5d7c71]">{statusText}</div>
        </div>
        <div className="rounded-full border border-[#d2e7de] bg-white px-3 py-1 text-xs text-[#3c6858]">
          {expanded ? "收起" : "展开"}
        </div>
      </button>

      {expanded ? (
        <div className="mt-4 space-y-3">
          {userProfile ? (
            <div className="rounded-2xl border border-[#dbece4] bg-white/85 p-3">
              <div className="text-xs font-medium uppercase tracking-[0.2em] text-[#6a8379]">
                用户画像摘要
              </div>
              <div className="mt-2 text-sm leading-7 text-[#315246]">{userProfile}</div>
            </div>
          ) : null}

          {memories.length > 0 ? (
            memories.map((memory) => (
              <div
                key={memory.id}
                className="rounded-2xl border border-[#dbece4] bg-white/85 p-3"
              >
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-full bg-[#edf7f2] px-2 py-1 text-[#2d6754]">
                    {memory.memory_type}
                  </span>
                  <span className="rounded-full bg-[#fff6e8] px-2 py-1 text-[#8c6125]">
                    相似度 {formatScore(memory.similarity_score)}
                  </span>
                  {typeof memory.reranker_score === "number" ? (
                    <span className="rounded-full bg-[#eef3ff] px-2 py-1 text-[#3157a6]">
                      重排 {formatScore(memory.reranker_score)}
                    </span>
                  ) : null}
                </div>

                <div className="mt-3 text-sm leading-7 text-[#335246]">{memory.content}</div>

                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    onClick={() => void onFeedback(memory.id)}
                    disabled={pendingMemoryId === memory.id}
                    className="rounded-full border border-[#ead7d7] bg-[#fff8f8] px-3 py-1.5 text-xs text-[#975252] transition hover:bg-[#fff0f0] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {pendingMemoryId === memory.id ? "提交中..." : "这条记忆不准确"}
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-[#d8e8e0] px-4 py-6 text-sm text-[#648174]">
              还没有可展示的命中记忆。
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}
