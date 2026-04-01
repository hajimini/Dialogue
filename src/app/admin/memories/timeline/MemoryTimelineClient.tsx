"use client";

import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type TimelineData = {
  timeline: Array<{
    timestamp: string;
    count: number;
    types: Record<string, number>;
    avg_importance: number;
  }>;
  events: Array<{
    id: string;
    timestamp: string;
    content: string;
    memory_type: string;
    importance: number;
    retrieval_count: number;
  }>;
};

const TYPE_LABELS: Record<string, string> = {
  user_fact: "用户事实",
  persona_fact: "人设事实",
  shared_event: "共同经历",
  relationship: "关系状态",
  session_summary: "会话摘要",
};

const TYPE_COLORS: Record<string, string> = {
  user_fact: "#2f7a5b",
  persona_fact: "#3b82f6",
  shared_event: "#8b5cf6",
  relationship: "#ef4444",
  session_summary: "#f59e0b",
};

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; payload?: { timestamp?: string } }>;
}) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-[#dde8e2] bg-white/98 p-3 shadow-xl backdrop-blur-sm">
      <div className="text-sm font-semibold text-[#173127]">{payload[0].payload?.timestamp}</div>
      <div className="mt-1 text-lg font-bold text-[#173127]">{payload[0].value}</div>
    </div>
  );
}

export default function MemoryTimelineClient({
  users,
  personas,
  characters,
}: {
  users: Array<{ id: string; nickname: string }>;
  personas: Array<{ id: string; name: string }>;
  characters: Array<{ id: string; name: string }>;
}) {
  const [selectedUserId, setSelectedUserId] = useState(users[0]?.id ?? "");
  const [selectedPersonaId, setSelectedPersonaId] = useState(personas[0]?.id ?? "");
  const [selectedCharacterId, setSelectedCharacterId] = useState<string>("all");
  const [groupBy, setGroupBy] = useState<"hour" | "day" | "week" | "month">("day");
  const [data, setData] = useState<TimelineData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  useEffect(() => {
    async function loadTimeline() {
      if (!selectedUserId || !selectedPersonaId) return;

      setIsLoading(true);
      setErrorText(null);

      try {
        const params = new URLSearchParams({
          userId: selectedUserId,
          personaId: selectedPersonaId,
          groupBy,
        });

        if (selectedCharacterId && selectedCharacterId !== "all") {
          params.append("characterId", selectedCharacterId);
        }

        const response = await fetch(`/api/admin/memories/timeline?${params.toString()}`);
        const json = (await response.json()) as {
          success: boolean;
          data: TimelineData | null;
          error: { message: string } | null;
        };

        if (!json.success || !json.data) {
          throw new Error(json.error?.message || "读取时间线失败");
        }

        setData(json.data);
      } catch (error) {
        setErrorText(error instanceof Error ? error.message : "读取时间线失败");
      } finally {
        setIsLoading(false);
      }
    }

    void loadTimeline();
  }, [selectedUserId, selectedPersonaId, selectedCharacterId, groupBy]);

  const selectedUser = users.find((u) => u.id === selectedUserId);
  const selectedPersona = personas.find((p) => p.id === selectedPersonaId);

  return (
    <div className="mx-auto flex w-full max-w-[1640px] flex-col gap-6 px-6 py-8">
      {/* 返回按钮 */}
      <div>
        <a
          href="/admin/memories"
          className="inline-flex items-center gap-2 rounded-full border border-[#d7e6df] bg-white px-4 py-2 text-sm text-[#35584a] transition hover:bg-[#f7fbf8]"
        >
          ← 返回记忆管理
        </a>
      </div>

      <section className="overflow-hidden rounded-[32px] border border-[#d9e6df] bg-[radial-gradient(circle_at_top_left,_rgba(43,111,83,0.15),_transparent_38%),linear-gradient(135deg,_rgba(255,252,247,0.98),_rgba(244,250,247,0.96))] p-6 shadow-[0_20px_60px_rgba(35,63,52,0.08)]">
        <div className="grid gap-8 xl:grid-cols-[1.2fr_0.8fr]">
          <div>
            <div className="text-xs uppercase tracking-[0.26em] text-[#718079]">
              Memory Timeline
            </div>
            <h1 className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight text-[#173128]">
              记忆时间线：追踪记忆的形成与演变
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-[#5f6f67]">
              可视化展示记忆随时间的增长趋势，以及重要事件的时间分布。
            </p>

            <div className="mt-6 flex flex-wrap gap-3 text-sm text-[#5c6d65]">
              {selectedUser && (
                <div className="rounded-full border border-[#d5e4dc] bg-white/82 px-4 py-2">
                  用户：{selectedUser.nickname}
                </div>
              )}
              {selectedPersona && (
                <div className="rounded-full border border-[#d5e4dc] bg-white/82 px-4 py-2">
                  人设：{selectedPersona.name}
                </div>
              )}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <label className="rounded-[24px] border border-white/60 bg-white/78 p-4 text-sm text-[#395a4c]">
              <div className="text-xs uppercase tracking-[0.16em] text-[#75847d]">User</div>
              <select
                value={selectedUserId}
                onChange={(event) => setSelectedUserId(event.target.value)}
                className="mt-3 w-full rounded-2xl border border-[#d7e6df] bg-white px-4 py-3 outline-none"
              >
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.nickname}
                  </option>
                ))}
              </select>
            </label>

            <label className="rounded-[24px] border border-white/60 bg-white/78 p-4 text-sm text-[#395a4c]">
              <div className="text-xs uppercase tracking-[0.16em] text-[#75847d]">Persona</div>
              <select
                value={selectedPersonaId}
                onChange={(event) => setSelectedPersonaId(event.target.value)}
                className="mt-3 w-full rounded-2xl border border-[#d7e6df] bg-white px-4 py-3 outline-none"
              >
                {personas.map((persona) => (
                  <option key={persona.id} value={persona.id}>
                    {persona.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="rounded-[24px] border border-white/60 bg-white/78 p-4 text-sm text-[#395a4c]">
              <div className="text-xs uppercase tracking-[0.16em] text-[#75847d]">Character</div>
              <select
                value={selectedCharacterId}
                onChange={(event) => setSelectedCharacterId(event.target.value)}
                className="mt-3 w-full rounded-2xl border border-[#d7e6df] bg-white px-4 py-3 outline-none"
              >
                <option value="all">全部角色</option>
                {characters.map((character) => (
                  <option key={character.id} value={character.id}>
                    {character.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div className="mt-6 flex gap-2">
          {(["hour", "day", "week", "month"] as const).map((option) => (
            <button
              key={option}
              onClick={() => setGroupBy(option)}
              className={`rounded-full px-4 py-2 text-sm transition-all ${
                groupBy === option
                  ? "border border-[#2f7a5b] bg-[#2f7a5b] text-white"
                  : "border border-[#d5e4dc] bg-white/82 text-[#5c6d65] hover:border-[#2f7a5b]"
              }`}
            >
              {option === "hour" && "按小时"}
              {option === "day" && "按天"}
              {option === "week" && "按周"}
              {option === "month" && "按月"}
            </button>
          ))}
        </div>

        {errorText && (
          <div className="mt-6 rounded-[22px] border border-[#efd7d7] bg-[#fff5f5] px-4 py-3 text-sm text-[#a23d3d]">
            {errorText}
          </div>
        )}
      </section>

      {isLoading ? (
        <div className="flex h-96 items-center justify-center rounded-[30px] border border-[#dde8e2] bg-white/90">
          <div className="text-sm text-[#6d6257]">加载中...</div>
        </div>
      ) : data ? (
        <>
          <section className="rounded-[30px] border border-[#dde8e2] bg-white/90 p-6 shadow-[0_18px_50px_rgba(46,69,58,0.08)]">
            <h2 className="text-xl font-semibold text-[#173128]">记忆增长趋势</h2>
            <p className="mt-1 text-sm text-[#66766f]">按时间段统计的记忆数量变化</p>

            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={data.timeline}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e7eee9" vertical={false} />
                <XAxis
                  dataKey="timestamp"
                  stroke="#7a6c5d"
                  tick={{ fontSize: 11 }}
                  axisLine={{ stroke: "#d7e6df" }}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis
                  stroke="#7a6c5d"
                  tick={{ fontSize: 11 }}
                  axisLine={{ stroke: "#d7e6df" }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar
                  dataKey="count"
                  fill="url(#timelineGradient)"
                  radius={[8, 8, 0, 0]}
                  isAnimationActive={false}
                />
                <defs>
                  <linearGradient id="timelineGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2f7a5b" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="#2f7a5b" stopOpacity={0.6} />
                  </linearGradient>
                </defs>
              </BarChart>
            </ResponsiveContainer>
          </section>

          <section className="rounded-[30px] border border-[#dde8e2] bg-white/90 p-6 shadow-[0_18px_50px_rgba(46,69,58,0.08)]">
            <h2 className="text-xl font-semibold text-[#173128]">重要事件</h2>
            <p className="mt-1 text-sm text-[#66766f]">
              高重要度（≥0.7）或高检索次数（≥5）的记忆
            </p>

            <div className="mt-5 space-y-3">
              {data.events.length > 0 ? (
                data.events.map((event) => (
                  <div
                    key={event.id}
                    className="rounded-[24px] border border-[#e7eee9] bg-[#fcfefd] p-5"
                  >
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0">
                        <div className="text-xs text-[#72827b]">
                          {new Date(event.timestamp).toLocaleString("zh-CN")}
                        </div>
                        <div className="mt-2 flex gap-2">
                          <span
                            className="rounded-full px-3 py-1 text-xs"
                            style={{
                              backgroundColor: `${TYPE_COLORS[event.memory_type]}20`,
                              color: TYPE_COLORS[event.memory_type],
                            }}
                          >
                            {TYPE_LABELS[event.memory_type]}
                          </span>
                          <span className="rounded-full bg-[#fff5e8] px-3 py-1 text-xs text-[#8b6127]">
                            重要度 {(event.importance * 100).toFixed(0)}%
                          </span>
                          {event.retrieval_count > 0 && (
                            <span className="rounded-full bg-[#edf7f2] px-3 py-1 text-xs text-[#305f4c]">
                              检索 {event.retrieval_count} 次
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex-1 text-sm leading-7 text-[#3d544a]">
                        {event.content}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-[24px] border border-dashed border-[#d9e4de] bg-[#fbfdfc] px-4 py-10 text-center text-sm text-[#72827b]">
                  暂无重要事件记录
                </div>
              )}
            </div>
          </section>
        </>
      ) : (
        <div className="flex h-96 items-center justify-center rounded-[30px] border border-[#dde8e2] bg-white/90">
          <div className="text-sm text-[#72827b]">请选择用户和人设查看时间线</div>
        </div>
      )}
    </div>
  );
}
