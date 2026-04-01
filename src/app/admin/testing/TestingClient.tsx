"use client";

import { useMemo, useState } from "react";
import type {
  AppUserRecord,
  Persona,
  PromptVersionRecord,
} from "@/lib/supabase/types";

type PersonaOption = Pick<Persona, "id" | "name" | "occupation" | "city">;

type OverviewData = {
  total: number;
  metrics: Array<{
    key: string;
    label: string;
    average: number | null;
    count: number;
  }>;
  byPromptVersion: Array<{
    id: string;
    label: string;
    count: number;
    averages: Array<{ key: string; label: string; average: number | null }>;
  }>;
  feedback: {
    up: number;
    down: number;
    reasons: Array<{ reason: string; count: number }>;
  };
  sources: Array<{ source: string; count: number }>;
};

type EvaluationResponse = {
  overview: OverviewData;
  recentLogs: Array<{
    id: string;
    source: string | null;
    prompt_version: string | null;
    notes: string | null;
    created_at: string | null;
  }>;
};

type QuickResult = {
  reply: string;
  system: string;
  promptVersion: PromptVersionRecord;
  memoryStats: {
    summaries: number;
    memories: number;
    hasProfile: boolean;
  };
};

type BatchResult = {
  id: string;
  message: string;
  expected: string;
  reply: string;
  promptVersion: PromptVersionRecord;
};

type ScoreForm = {
  roleAdherence: number;
  naturalness: number;
  emotionalAccuracy: number;
  memoryAccuracy: number;
  antiAiScore: number;
  lengthAppropriate: number;
  notes: string;
};

const DEFAULT_SCORE_FORM: ScoreForm = {
  roleAdherence: 4,
  naturalness: 4,
  emotionalAccuracy: 4,
  memoryAccuracy: 4,
  antiAiScore: 4,
  lengthAppropriate: 4,
  notes: "",
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

function parseBatchInput(input: string) {
  const trimmed = input.trim();
  if (!trimmed) return [];

  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      return parsed
        .map((item, index) => ({
          id:
            typeof item?.id === "string" && item.id.trim()
              ? item.id.trim()
              : `Case-${index + 1}`,
          message:
            typeof item?.message === "string" ? item.message.trim() : "",
          expected:
            typeof item?.expected === "string" ? item.expected.trim() : "",
        }))
        .filter((item) => Boolean(item.message));
    }
  } catch {
    return trimmed
      .split(/\r?\n/)
      .map((line, index) => {
        const [message, expected = ""] = line.split("||");
        return {
          id: `Line-${index + 1}`,
          message: message?.trim() ?? "",
          expected: expected.trim(),
        };
      })
      .filter((item) => Boolean(item.message));
  }

  return [];
}

export default function TestingClient({
  personas,
  users,
  promptVersions,
  initialEvaluationData,
}: {
  personas: PersonaOption[];
  users: AppUserRecord[];
  promptVersions: PromptVersionRecord[];
  initialEvaluationData: EvaluationResponse;
}) {
  const [selectedPersonaId, setSelectedPersonaId] = useState(personas[0]?.id ?? "");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedPromptVersionId, setSelectedPromptVersionId] = useState(
    promptVersions.find((item) => item.is_active)?.id ?? promptVersions[0]?.id ?? "",
  );
  const [quickMessage, setQuickMessage] = useState("今天心情有点乱，你会怎么接我这句话？");
  const [batchInput, setBatchInput] = useState(
    JSON.stringify(
      [
        {
          id: "A01",
          message: "在吗",
          expected: "像熟悉的人自然接话，不要突然进入助手模式",
        },
        {
          id: "C01",
          message: "你还记得我上次说的面试吗",
          expected: "能自然衔接记忆，别像在背数据库",
        },
      ],
      null,
      2,
    ),
  );
  const [quickResult, setQuickResult] = useState<QuickResult | null>(null);
  const [batchResults, setBatchResults] = useState<BatchResult[]>([]);
  const [evaluationData, setEvaluationData] = useState(initialEvaluationData);
  const [scoreForm, setScoreForm] = useState(DEFAULT_SCORE_FORM);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [isRunningQuick, setIsRunningQuick] = useState(false);
  const [isRunningBatch, setIsRunningBatch] = useState(false);
  const [isSavingScore, setIsSavingScore] = useState(false);

  const activePromptVersion = useMemo(
    () =>
      promptVersions.find((item) => item.id === selectedPromptVersionId) ??
      promptVersions[0] ??
      null,
    [promptVersions, selectedPromptVersionId],
  );

  async function refreshEvaluationData() {
    const response = await fetch("/api/admin/evaluations");
    const json = (await response.json()) as {
      success: boolean;
      data: EvaluationResponse | null;
      error: { message: string } | null;
    };

    if (!json.success || !json.data) {
      throw new Error(json.error?.message || "读取评估报告失败");
    }

    setEvaluationData(json.data);
  }

  async function handleQuickRun() {
    setErrorText(null);
    setIsRunningQuick(true);

    try {
      const response = await fetch("/api/admin/testing/quick", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personaId: selectedPersonaId,
          userId: selectedUserId || undefined,
          promptVersionId: selectedPromptVersionId || undefined,
          message: quickMessage,
        }),
      });
      const json = (await response.json()) as {
        success: boolean;
        data: QuickResult | null;
        error: { message: string } | null;
      };

      if (!json.success || !json.data) {
        throw new Error(json.error?.message || "快速测试失败");
      }

      setQuickResult(json.data);
      setScoreForm(DEFAULT_SCORE_FORM);
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "快速测试失败");
    } finally {
      setIsRunningQuick(false);
    }
  }

  async function handleBatchRun() {
    setErrorText(null);
    setIsRunningBatch(true);

    try {
      const cases = parseBatchInput(batchInput);
      const response = await fetch("/api/admin/testing/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personaId: selectedPersonaId,
          userId: selectedUserId || undefined,
          promptVersionId: selectedPromptVersionId || undefined,
          cases,
        }),
      });
      const json = (await response.json()) as {
        success: boolean;
        data: { results: BatchResult[] } | null;
        error: { message: string } | null;
      };

      if (!json.success || !json.data) {
        throw new Error(json.error?.message || "批量测试失败");
      }

      setBatchResults(json.data.results);
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "批量测试失败");
    } finally {
      setIsRunningBatch(false);
    }
  }

  async function handleSaveScore() {
    if (!quickResult) return;

    setErrorText(null);
    setIsSavingScore(true);

    try {
      const response = await fetch("/api/admin/evaluations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personaId: selectedPersonaId,
          userId: selectedUserId || null,
          promptVersion: quickResult.promptVersion.id,
          source: "quick-test",
          ...scoreForm,
        }),
      });
      const json = (await response.json()) as {
        success: boolean;
        error: { message: string } | null;
      };

      if (!json.success) {
        throw new Error(json.error?.message || "保存评分失败");
      }

      await refreshEvaluationData();
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "保存评分失败");
    } finally {
      setIsSavingScore(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-10">
      <section className="rounded-[30px] border border-white/60 bg-white/88 p-6 shadow-[0_18px_50px_rgba(46,69,58,0.08)]">
        <h1 className="text-2xl font-semibold">测试与评估面板</h1>
        <p className="mt-2 text-sm leading-7 text-[#6d6257]">
          用来快速试 Prompt、批量跑案例，并把人工评分沉淀成可比较的报告。
        </p>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <label className="text-sm font-medium text-[#35584a]">
            人设
            <select
              value={selectedPersonaId}
              onChange={(event) => setSelectedPersonaId(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-[#d7e6df] bg-white px-4 py-3 outline-none"
            >
              {personas.map((persona) => (
                <option key={persona.id} value={persona.id}>
                  {persona.name}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm font-medium text-[#35584a]">
            用户记忆上下文
            <select
              value={selectedUserId}
              onChange={(event) => setSelectedUserId(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-[#d7e6df] bg-white px-4 py-3 outline-none"
            >
              <option value="">不带用户记忆</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.nickname} · {user.email}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm font-medium text-[#35584a]">
            Prompt 版本
            <select
              value={selectedPromptVersionId}
              onChange={(event) => setSelectedPromptVersionId(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-[#d7e6df] bg-white px-4 py-3 outline-none"
            >
              {promptVersions.map((version) => (
                <option key={version.id} value={version.id}>
                  {version.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {errorText ? (
          <div className="mt-5 rounded-2xl border border-[#efd7d7] bg-[#fff5f5] px-4 py-3 text-sm text-[#a23d3d]">
            {errorText}
          </div>
        ) : null}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-6">
          <div className="rounded-[30px] border border-white/60 bg-white/88 p-6 shadow-[0_18px_50px_rgba(46,69,58,0.08)]">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold">快速对话测试</h2>
                <p className="mt-1 text-sm text-[#6d6257]">
                  单条消息立即看回复，可切 Prompt 和记忆上下文。
                </p>
              </div>
              <button
                type="button"
                onClick={() => void handleQuickRun()}
                disabled={isRunningQuick}
                className="rounded-full bg-[#1f8a5b] px-5 py-3 text-sm font-medium text-white transition hover:bg-[#22764f] disabled:opacity-60"
              >
                {isRunningQuick ? "测试中..." : "运行快速测试"}
              </button>
            </div>

            <textarea
              value={quickMessage}
              onChange={(event) => setQuickMessage(event.target.value)}
              rows={5}
              className="mt-5 w-full rounded-2xl border border-[#d7e6df] bg-white px-4 py-3 outline-none"
            />

            {quickResult ? (
              <div className="mt-5 space-y-4">
                <div className="rounded-2xl border border-[#e8efe9] bg-[#f9fcfa] p-4">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-[#67796f]">
                    <span className="rounded-full bg-white px-3 py-1">
                      Prompt：{quickResult.promptVersion.label}
                    </span>
                    <span className="rounded-full bg-white px-3 py-1">
                      摘要 {quickResult.memoryStats.summaries}
                    </span>
                    <span className="rounded-full bg-white px-3 py-1">
                      记忆 {quickResult.memoryStats.memories}
                    </span>
                    <span className="rounded-full bg-white px-3 py-1">
                      画像 {quickResult.memoryStats.hasProfile ? "已命中" : "无"}
                    </span>
                  </div>
                  <div className="mt-4 whitespace-pre-wrap rounded-2xl border border-[#e6ece7] bg-white px-4 py-4 text-sm leading-7 text-[#365047]">
                    {quickResult.reply}
                  </div>
                </div>

                <div className="rounded-2xl border border-[#efe4d8] bg-[#fffaf3] p-4">
                  <div className="text-sm font-medium text-[#6b563c]">Prompt 预览</div>
                  <textarea
                    readOnly
                    value={quickResult.system}
                    className="mt-3 min-h-56 w-full rounded-2xl border border-[#eadfd2] bg-white px-4 py-3 text-xs leading-6 text-[#5c5248] outline-none"
                  />
                </div>

                <div className="rounded-2xl border border-[#ece6dc] bg-[#fffdf9] p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="text-sm font-semibold">人工评分</div>
                      <div className="mt-1 text-xs text-[#7a6c5d]">
                        打完分后会写入评估日志，报告会自动更新。
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleSaveScore()}
                      disabled={isSavingScore}
                      className="rounded-full border border-[#d7e4de] bg-white px-4 py-2 text-sm text-[#35584a] disabled:opacity-60"
                    >
                      {isSavingScore ? "保存中..." : "保存评分"}
                    </button>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {(
                      [
                        ["roleAdherence", "角色一致"],
                        ["naturalness", "自然度"],
                        ["emotionalAccuracy", "情绪准确"],
                        ["memoryAccuracy", "记忆衔接"],
                        ["antiAiScore", "去 AI 味"],
                        ["lengthAppropriate", "长度合适"],
                      ] as const
                    ).map(([key, label]) => (
                      <label key={key} className="text-sm font-medium text-[#35584a]">
                        {label}
                        <select
                          value={scoreForm[key]}
                          onChange={(event) =>
                            setScoreForm((current) => ({
                              ...current,
                              [key]: Number(event.target.value),
                            }))
                          }
                          className="mt-2 w-full rounded-2xl border border-[#d7e6df] bg-white px-4 py-3 outline-none"
                        >
                          {[1, 2, 3, 4, 5].map((value) => (
                            <option key={value} value={value}>
                              {value}
                            </option>
                          ))}
                        </select>
                      </label>
                    ))}
                  </div>

                  <textarea
                    value={scoreForm.notes}
                    onChange={(event) =>
                      setScoreForm((current) => ({ ...current, notes: event.target.value }))
                    }
                    rows={3}
                    className="mt-4 w-full rounded-2xl border border-[#d7e6df] bg-white px-4 py-3 outline-none"
                    placeholder="记录问题点，例如：回复过于解释型、角色口头禅不够明显"
                  />
                </div>
              </div>
            ) : null}
          </div>

          <div className="rounded-[30px] border border-white/60 bg-white/88 p-6 shadow-[0_18px_50px_rgba(46,69,58,0.08)]">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold">批量测试</h2>
                <p className="mt-1 text-sm text-[#6d6257]">
                  支持 JSON 数组，或每行 `message || expected` 的简写格式。
                </p>
              </div>
              <button
                type="button"
                onClick={() => void handleBatchRun()}
                disabled={isRunningBatch}
                className="rounded-full bg-[#c78f42] px-5 py-3 text-sm font-medium text-white transition hover:bg-[#b07d38] disabled:opacity-60"
              >
                {isRunningBatch ? "批量运行中..." : "运行批量测试"}
              </button>
            </div>

            <textarea
              value={batchInput}
              onChange={(event) => setBatchInput(event.target.value)}
              rows={12}
              className="mt-5 w-full rounded-2xl border border-[#e7dccd] bg-[#fffdf8] px-4 py-3 font-mono text-xs leading-6 outline-none"
            />

            <div className="mt-5 space-y-3">
              {batchResults.map((item) => (
                <div
                  key={item.id}
                  className="rounded-2xl border border-[#ece6dc] bg-[#fffdf9] p-4"
                >
                  <div className="text-sm font-semibold">
                    {item.id} · {item.promptVersion.label}
                  </div>
                  <div className="mt-3 text-sm text-[#35584a]">
                    <span className="font-medium">输入：</span> {item.message}
                  </div>
                  {item.expected ? (
                    <div className="mt-2 text-sm text-[#7d6544]">
                      <span className="font-medium">期望：</span> {item.expected}
                    </div>
                  ) : null}
                  <div className="mt-3 whitespace-pre-wrap rounded-2xl border border-[#e8eee9] bg-[#f9fcfa] px-4 py-3 text-sm leading-7 text-[#446157]">
                    {item.reply}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-[30px] border border-white/60 bg-white/88 p-6 shadow-[0_18px_50px_rgba(46,69,58,0.08)]">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold">评估报告</h2>
                <p className="mt-1 text-sm text-[#6d6257]">
                  当前累计 {evaluationData.overview.total} 条评估记录。
                </p>
              </div>
              <div className="rounded-full bg-[#edf7f2] px-3 py-1 text-sm text-[#315b49]">
                活动版本：{activePromptVersion?.label ?? "无"}
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {evaluationData.overview.metrics.map((metric) => (
                <div
                  key={metric.key}
                  className="rounded-2xl border border-[#ece6dc] bg-[#fffdf9] p-4"
                >
                  <div className="text-sm text-[#7a6c5d]">{metric.label}</div>
                  <div className="mt-2 text-3xl font-semibold text-[#244338]">
                    {metric.average ?? "-"}
                  </div>
                  <div className="mt-1 text-xs text-[#8a7a68]">
                    {metric.count} 次有效评分
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6">
              <div className="text-sm font-semibold text-[#35584a]">按 Prompt 版本对比</div>
              <div className="mt-3 space-y-3">
                {evaluationData.overview.byPromptVersion.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-2xl border border-[#e8efe9] bg-[#f9fcfa] p-4"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="font-medium">{item.label}</div>
                      <div className="text-xs text-[#7a6c5d]">{item.count} 条记录</div>
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {item.averages.map((average) => (
                        <div key={average.key} className="text-sm text-[#4b6359]">
                          {average.label}：{average.average ?? "-"}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-[#ece6dc] bg-[#fffdf9] p-4">
                <div className="text-sm font-semibold text-[#35584a]">用户反馈</div>
                <div className="mt-3 flex gap-3 text-sm">
                  <span className="rounded-full bg-[#edf7f2] px-3 py-1 text-[#315b49]">
                    👍 {evaluationData.overview.feedback.up}
                  </span>
                  <span className="rounded-full bg-[#fff1f1] px-3 py-1 text-[#9b4c4c]">
                    👎 {evaluationData.overview.feedback.down}
                  </span>
                </div>
                <div className="mt-4 space-y-2 text-sm text-[#576f65]">
                  {evaluationData.overview.feedback.reasons.map((reason) => (
                    <div key={reason.reason} className="flex justify-between gap-4">
                      <span>{reason.reason}</span>
                      <span>{reason.count}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-[#ece6dc] bg-[#fffdf9] p-4">
                <div className="text-sm font-semibold text-[#35584a]">来源分布</div>
                <div className="mt-4 space-y-2 text-sm text-[#576f65]">
                  {evaluationData.overview.sources.map((item) => (
                    <div key={item.source} className="flex justify-between gap-4">
                      <span>{item.source}</span>
                      <span>{item.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[30px] border border-white/60 bg-white/88 p-6 shadow-[0_18px_50px_rgba(46,69,58,0.08)]">
            <h2 className="text-xl font-semibold">最近评估记录</h2>
            <div className="mt-4 space-y-3">
              {evaluationData.recentLogs.map((log) => (
                <div
                  key={log.id}
                  className="rounded-2xl border border-[#ece6dc] bg-[#fffdf9] p-4"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="text-sm font-medium">
                      {log.source ?? "unknown"} · {log.prompt_version ?? "未记录版本"}
                    </div>
                    <div className="text-xs text-[#8a7a68]">
                      {formatDate(log.created_at)}
                    </div>
                  </div>
                  {log.notes ? (
                    <div className="mt-3 text-sm leading-7 text-[#4d655b]">{log.notes}</div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
