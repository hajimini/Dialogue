"use client";

import { useState } from "react";
import type { PromptVersionRecord } from "@/lib/supabase/types";

export default function PromptVersionsClient({
  initialVersions,
}: {
  initialVersions: PromptVersionRecord[];
}) {
  const [versions, setVersions] = useState(initialVersions);
  const [label, setLabel] = useState("");
  const [instructions, setInstructions] = useState("");
  const [notes, setNotes] = useState("");
  const [errorText, setErrorText] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function refreshVersions() {
    const response = await fetch("/api/admin/prompt-versions");
    const json = (await response.json()) as {
      success: boolean;
      data: PromptVersionRecord[] | null;
      error: { message: string } | null;
    };

    if (!json.success || !json.data) {
      throw new Error(json.error?.message || "读取 Prompt 版本失败");
    }

    setVersions(json.data);
  }

  async function handleCreate() {
    setErrorText(null);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/admin/prompt-versions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label, instructions, notes }),
      });
      const json = (await response.json()) as {
        success: boolean;
        error: { message: string } | null;
      };

      if (!json.success) {
        throw new Error(json.error?.message || "创建 Prompt 版本失败");
      }

      setLabel("");
      setInstructions("");
      setNotes("");
      await refreshVersions();
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "创建 Prompt 版本失败");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleActivate(id: string) {
    setErrorText(null);

    try {
      const response = await fetch(`/api/admin/prompt-versions/${id}/activate`, {
        method: "POST",
      });
      const json = (await response.json()) as {
        success: boolean;
        error: { message: string } | null;
      };

      if (!json.success) {
        throw new Error(json.error?.message || "切换 Prompt 版本失败");
      }

      await refreshVersions();
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "切换 Prompt 版本失败");
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-10">
      <section className="rounded-[30px] border border-white/60 bg-white/88 p-6 shadow-[0_18px_50px_rgba(46,69,58,0.08)]">
        <h1 className="text-2xl font-semibold">Prompt 版本管理</h1>
        <p className="mt-2 text-sm leading-7 text-[#6d6257]">
          记录系统 Prompt 的迭代版本，方便切换、对比和回滚。
        </p>

        <div className="mt-6 grid gap-3">
          <input
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            className="rounded-2xl border border-[#d7e6df] bg-white px-4 py-3 outline-none"
            placeholder="版本名，例如 v2 更克制的口语风格"
          />
          <textarea
            value={instructions}
            onChange={(event) => setInstructions(event.target.value)}
            rows={6}
            className="rounded-2xl border border-[#d7e6df] bg-white px-4 py-3 outline-none"
            placeholder="补充的 System Prompt 指令"
          />
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={3}
            className="rounded-2xl border border-[#d7e6df] bg-white px-4 py-3 outline-none"
            placeholder="这个版本想解决什么问题，可选"
          />

          {errorText ? (
            <div className="rounded-2xl border border-[#efd7d7] bg-[#fff5f5] px-4 py-3 text-sm text-[#a23d3d]">
              {errorText}
            </div>
          ) : null}

          <div>
            <button
              type="button"
              onClick={() => void handleCreate()}
              disabled={isSubmitting}
              className="rounded-full bg-[#1f8a5b] px-5 py-3 text-sm font-medium text-white transition hover:bg-[#22764f] disabled:opacity-60"
            >
              {isSubmitting ? "创建中..." : "创建新版本"}
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-[30px] border border-white/60 bg-white/88 p-6 shadow-[0_18px_50px_rgba(46,69,58,0.08)]">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">已保存的版本</h2>
            <p className="mt-1 text-sm text-[#6d6257]">
              当前激活的版本会用于正式聊天和测试面板。
            </p>
          </div>
          <div className="rounded-full bg-[#edf7f2] px-3 py-1 text-sm text-[#315b49]">
            共 {versions.length} 个版本
          </div>
        </div>

        <div className="mt-6 space-y-4">
          {versions.map((version) => (
            <div
              key={version.id}
              className="rounded-2xl border border-[#ece6dc] bg-[#fffdf9] p-5"
            >
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="text-lg font-semibold">{version.label}</div>
                    {version.is_active ? (
                      <span className="rounded-full bg-[#e8f7ef] px-3 py-1 text-xs text-[#1f724d]">
                        当前激活
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-2 text-xs text-[#867562]">
                    创建于 {version.created_at}
                  </div>
                </div>

                {!version.is_active ? (
                  <button
                    type="button"
                    onClick={() => void handleActivate(version.id)}
                    className="rounded-full border border-[#d8e5df] bg-white px-4 py-2 text-sm text-[#33584a]"
                  >
                    设为当前版本
                  </button>
                ) : null}
              </div>

              <div className="mt-4 whitespace-pre-wrap rounded-2xl border border-[#e9eee9] bg-[#f9fcfa] p-4 text-sm leading-7 text-[#456055]">
                {version.instructions}
              </div>

              {version.notes ? (
                <div className="mt-3 rounded-2xl border border-[#eee3d5] bg-[#fff7ec] p-4 text-sm leading-7 text-[#6c5942]">
                  {version.notes}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
