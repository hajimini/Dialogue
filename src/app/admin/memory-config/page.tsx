"use client";

import { useEffect, useState } from "react";

type MemoryConfig = {
  MEMORY_PROVIDER: string;
  EMBEDDING_PROVIDER: string;
  EMBEDDING_MODEL: string;
  RERANKER_PROVIDER: string;
  MEMORY_RETRIEVAL_LIMIT: string;
  MEMORY_CONTEXT_CACHE_ENABLED: string;
};

type ConfigHistory = {
  id: string;
  config: Record<string, unknown>;
  changed_by: string;
  changed_at: string;
};

export default function MemoryConfigPage() {
  const [config, setConfig] = useState<MemoryConfig | null>(null);
  const [history, setHistory] = useState<ConfigHistory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [testingProvider, setTestingProvider] = useState<string | null>(null);
  const [messageText, setMessageText] = useState<string | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);

  async function loadConfig() {
    setIsLoading(true);
    setErrorText(null);

    try {
      const response = await fetch("/api/admin/memory-config");
      const json = (await response.json()) as {
        success: boolean;
        data: { current: MemoryConfig; history: ConfigHistory[] } | null;
        error: { message: string } | null;
      };

      if (!json.success || !json.data) {
        throw new Error(json.error?.message || "读取记忆配置失败");
      }

      setConfig(json.data.current);
      setHistory(json.data.history);
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "读取记忆配置失败");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSave() {
    if (!config) return;

    setIsSaving(true);
    setErrorText(null);
    setMessageText(null);

    try {
      const response = await fetch("/api/admin/memory-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config }),
      });
      const json = (await response.json()) as {
        success: boolean;
        data: { requiresRestart: boolean } | null;
        error: { message: string } | null;
      };

      if (!json.success) {
        throw new Error(json.error?.message || "保存配置失败");
      }

      setMessageText(json.data?.requiresRestart ? "已保存，建议重启应用使配置完全生效。" : "已保存。");
      await loadConfig();
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "保存配置失败");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleTest(provider: "embedding" | "reranker") {
    if (!config) return;

    setTestingProvider(provider);
    setErrorText(null);
    setMessageText(null);

    try {
      const response = await fetch("/api/admin/memory-config/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          config,
        }),
      });
      const json = (await response.json()) as {
        success: boolean;
        data: { isValid: boolean; message: string } | null;
        error: { message: string } | null;
      };

      if (!json.success || !json.data) {
        throw new Error(json.error?.message || "连接测试失败");
      }

      setMessageText(json.data.message);
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "连接测试失败");
    } finally {
      setTestingProvider(null);
    }
  }

  useEffect(() => {
    void loadConfig();
  }, []);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-10">
      <section className="rounded-[30px] border border-white/60 bg-white/88 p-6 shadow-[0_18px_50px_rgba(46,69,58,0.08)]">
        <h1 className="text-2xl font-semibold">记忆系统配置</h1>
        <p className="mt-2 text-sm leading-7 text-[#6d6257]">
          这里可以查看当前启用的 embedding / reranker 配置，并做运行时覆盖测试。
        </p>

        {messageText ? (
          <div className="mt-4 rounded-2xl border border-[#d7eadf] bg-[#f3fbf7] px-4 py-3 text-sm text-[#2f6f55]">
            {messageText}
          </div>
        ) : null}

        {errorText ? (
          <div className="mt-4 rounded-2xl border border-[#efd7d7] bg-[#fff5f5] px-4 py-3 text-sm text-[#a23d3d]">
            {errorText}
          </div>
        ) : null}
      </section>

      <section className="rounded-[30px] border border-white/60 bg-white/88 p-6 shadow-[0_18px_50px_rgba(46,69,58,0.08)]">
        {isLoading || !config ? (
          <div className="text-sm text-[#6d6257]">加载中...</div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-sm font-medium text-[#385548]">
              Memory Provider
              <select
                value={config.MEMORY_PROVIDER}
                onChange={(event) =>
                  setConfig((current) =>
                    current ? { ...current, MEMORY_PROVIDER: event.target.value } : current,
                  )
                }
                className="mt-2 w-full rounded-2xl border border-[#d7e6df] bg-white px-4 py-3 outline-none"
              >
                <option value="mem0">mem0</option>
                <option value="letta">letta</option>
              </select>
            </label>

            <label className="text-sm font-medium text-[#385548]">
              Embedding Provider
              <select
                value={config.EMBEDDING_PROVIDER}
                onChange={(event) =>
                  setConfig((current) =>
                    current ? { ...current, EMBEDDING_PROVIDER: event.target.value } : current,
                  )
                }
                className="mt-2 w-full rounded-2xl border border-[#d7e6df] bg-white px-4 py-3 outline-none"
              >
                <option value="openai">openai</option>
                <option value="nvidia">nvidia</option>
                <option value="bge-m3">bge-m3</option>
              </select>
            </label>

            <label className="text-sm font-medium text-[#385548]">
              Embedding Model
              <input
                value={config.EMBEDDING_MODEL}
                onChange={(event) =>
                  setConfig((current) =>
                    current ? { ...current, EMBEDDING_MODEL: event.target.value } : current,
                  )
                }
                className="mt-2 w-full rounded-2xl border border-[#d7e6df] bg-white px-4 py-3 outline-none"
              />
            </label>

            <label className="text-sm font-medium text-[#385548]">
              Reranker Provider
              <select
                value={config.RERANKER_PROVIDER}
                onChange={(event) =>
                  setConfig((current) =>
                    current ? { ...current, RERANKER_PROVIDER: event.target.value } : current,
                  )
                }
                className="mt-2 w-full rounded-2xl border border-[#d7e6df] bg-white px-4 py-3 outline-none"
              >
                <option value="jina">jina</option>
                <option value="cohere">cohere</option>
                <option value="none">none</option>
              </select>
            </label>

            <label className="text-sm font-medium text-[#385548]">
              Retrieval Limit
              <input
                value={config.MEMORY_RETRIEVAL_LIMIT}
                onChange={(event) =>
                  setConfig((current) =>
                    current
                      ? { ...current, MEMORY_RETRIEVAL_LIMIT: event.target.value }
                      : current,
                  )
                }
                className="mt-2 w-full rounded-2xl border border-[#d7e6df] bg-white px-4 py-3 outline-none"
              />
            </label>

            <label className="text-sm font-medium text-[#385548]">
              Context Cache
              <select
                value={config.MEMORY_CONTEXT_CACHE_ENABLED}
                onChange={(event) =>
                  setConfig((current) =>
                    current
                      ? { ...current, MEMORY_CONTEXT_CACHE_ENABLED: event.target.value }
                      : current,
                  )
                }
                className="mt-2 w-full rounded-2xl border border-[#d7e6df] bg-white px-4 py-3 outline-none"
              >
                <option value="true">true</option>
                <option value="false">false</option>
              </select>
            </label>
          </div>
        )}

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => void handleTest("embedding")}
            disabled={testingProvider !== null || !config}
            className="rounded-full border border-[#d5e8e0] bg-white px-4 py-2 text-sm text-[#31574a] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {testingProvider === "embedding" ? "测试中..." : "测试 Embedding"}
          </button>
          <button
            type="button"
            onClick={() => void handleTest("reranker")}
            disabled={testingProvider !== null || !config}
            className="rounded-full border border-[#d5e8e0] bg-white px-4 py-2 text-sm text-[#31574a] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {testingProvider === "reranker" ? "测试中..." : "测试 Reranker"}
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={isSaving || !config}
            className="rounded-full bg-[#1f8a5b] px-5 py-2 text-sm font-medium text-white transition hover:bg-[#22764f] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? "保存中..." : "保存配置"}
          </button>
        </div>
      </section>

      <section className="rounded-[30px] border border-white/60 bg-white/88 p-6 shadow-[0_18px_50px_rgba(46,69,58,0.08)]">
        <h2 className="text-xl font-semibold">最近配置历史</h2>
        <div className="mt-4 space-y-3">
          {history.length > 0 ? (
            history.map((item) => (
              <div
                key={item.id}
                className="rounded-2xl border border-[#dcebe4] bg-white/80 p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-[#59766b]">
                  <div>{item.changed_by}</div>
                  <div>{new Date(item.changed_at).toLocaleString("zh-CN")}</div>
                </div>
                <pre className="mt-3 overflow-x-auto rounded-2xl bg-[#f7fbf9] p-4 text-xs text-[#355246]">
                  {JSON.stringify(item.config, null, 2)}
                </pre>
              </div>
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-[#d8e8e0] px-4 py-8 text-sm text-[#648174]">
              还没有配置修改记录。
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
