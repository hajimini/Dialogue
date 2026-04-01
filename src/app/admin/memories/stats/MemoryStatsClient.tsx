"use client";

import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type MemoryStats = {
  total_count: number;
  type_distribution: Array<{
    type: string;
    count: number;
    avg_importance: number;
  }>;
  importance_distribution: Array<{
    label: string;
    count: number;
  }>;
  retrieval_stats: {
    total_retrievals: number;
    avg_retrievals: number;
    most_retrieved: Array<{
      id: string;
      content: string;
      retrieval_count: number;
      memory_type: string;
    }>;
  };
  feedback_stats: {
    total_accurate: number;
    total_inaccurate: number;
    accuracy_rate: number;
  };
  growth_trend: Array<{
    month: string;
    count: number;
  }>;
  quality_score: number;
};

const TYPE_COLORS: Record<string, string> = {
  user_fact: "#2f7a5b",
  persona_fact: "#3b82f6",
  shared_event: "#8b5cf6",
  relationship: "#ef4444",
  session_summary: "#f59e0b",
};

const TYPE_LABELS: Record<string, string> = {
  user_fact: "用户事实",
  persona_fact: "人设事实",
  shared_event: "共同经历",
  relationship: "关系状态",
  session_summary: "会话摘要",
};

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; payload?: { type?: string } }>;
}) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-[#dde8e2] bg-white/98 p-3 shadow-xl backdrop-blur-sm">
      <div className="text-sm font-semibold text-[#173127]">{payload[0].name}</div>
      <div className="mt-1 text-lg font-bold text-[#173127]">{payload[0].value}</div>
    </div>
  );
}

export default function MemoryStatsClient({
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
  const [stats, setStats] = useState<MemoryStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  useEffect(() => {
    async function loadStats() {
      if (!selectedUserId || !selectedPersonaId) return;

      setIsLoading(true);
      setErrorText(null);

      try {
        const params = new URLSearchParams({
          userId: selectedUserId,
          personaId: selectedPersonaId,
        });

        if (selectedCharacterId && selectedCharacterId !== "all") {
          params.append("characterId", selectedCharacterId);
        }

        const response = await fetch(`/api/admin/memories/stats?${params.toString()}`);
        const json = (await response.json()) as {
          success: boolean;
          data: MemoryStats | null;
          error: { message: string } | null;
        };

        if (!json.success || !json.data) {
          throw new Error(json.error?.message || "读取统计数据失败");
        }

        setStats(json.data);
      } catch (error) {
        setErrorText(error instanceof Error ? error.message : "读取统计数据失败");
      } finally {
        setIsLoading(false);
      }
    }

    void loadStats();
  }, [selectedUserId, selectedPersonaId, selectedCharacterId]);

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

      {/* 头部 */}
      <section className="overflow-hidden rounded-[32px] border border-[#d9e6df] bg-[radial-gradient(circle_at_top_left,_rgba(43,111,83,0.15),_transparent_38%),linear-gradient(135deg,_rgba(255,252,247,0.98),_rgba(244,250,247,0.96))] p-6 shadow-[0_20px_60px_rgba(35,63,52,0.08)]">
        <div className="grid gap-8 xl:grid-cols-[1.2fr_0.8fr]">
          <div>
            <div className="text-xs uppercase tracking-[0.26em] text-[#718079]">
              Memory Analytics
            </div>
            <h1 className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight text-[#173128]">
              记忆统计仪表板：数据洞察与质量分析
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-[#5f6f67]">
              通过可视化图表分析记忆的类型分布、检索效果、反馈质量和增长趋势。
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

          <div className="grid gap-4 md:grid-cols-2">
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
      ) : stats ? (
        <>
          {/* 关键指标卡片 */}
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-[26px] border border-[#dde8e2] bg-gradient-to-br from-white to-[#f8faf9] p-5 shadow-[0_16px_40px_rgba(43,62,53,0.06)]">
              <div className="text-sm text-[#73827b]">记忆总量</div>
              <div className="mt-2 text-3xl font-semibold text-[#173128]">
                {stats.total_count}
              </div>
              <div className="mt-2 text-xs text-[#66766f]">所有类型记忆</div>
            </div>

            <div className="rounded-[26px] border border-[#dde8e2] bg-gradient-to-br from-white to-[#f8faf9] p-5 shadow-[0_16px_40px_rgba(43,62,53,0.06)]">
              <div className="text-sm text-[#73827b]">质量评分</div>
              <div className="mt-2 text-3xl font-semibold text-[#173128]">
                {stats.quality_score.toFixed(0)}
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#eaf1ec]">
                <div
                  className={`h-full rounded-full transition-all ${
                    stats.quality_score >= 80
                      ? "bg-gradient-to-r from-[#2f7a5b] to-[#3d9b73]"
                      : stats.quality_score >= 60
                        ? "bg-gradient-to-r from-[#f59e0b] to-[#fb923c]"
                        : "bg-gradient-to-r from-[#ef4444] to-[#f87171]"
                  }`}
                  style={{ width: `${stats.quality_score}%` }}
                />
              </div>
            </div>

            <div className="rounded-[26px] border border-[#dde8e2] bg-gradient-to-br from-white to-[#f8faf9] p-5 shadow-[0_16px_40px_rgba(43,62,53,0.06)]">
              <div className="text-sm text-[#73827b]">反馈准确率</div>
              <div className="mt-2 text-3xl font-semibold text-[#173128]">
                {(stats.feedback_stats.accuracy_rate * 100).toFixed(0)}%
              </div>
              <div className="mt-2 text-xs text-[#66766f]">
                准确 {stats.feedback_stats.total_accurate} / 不准{" "}
                {stats.feedback_stats.total_inaccurate}
              </div>
            </div>

            <div className="rounded-[26px] border border-[#dde8e2] bg-gradient-to-br from-white to-[#f8faf9] p-5 shadow-[0_16px_40px_rgba(43,62,53,0.06)]">
              <div className="text-sm text-[#73827b]">平均检索次数</div>
              <div className="mt-2 text-3xl font-semibold text-[#173128]">
                {stats.retrieval_stats.avg_retrievals.toFixed(1)}
              </div>
              <div className="mt-2 text-xs text-[#66766f]">
                总检索 {stats.retrieval_stats.total_retrievals} 次
              </div>
            </div>
          </section>

          {/* 图表区域 */}
          <section className="grid gap-6 lg:grid-cols-2">
            {/* 类型分布饼图 */}
            <div className="rounded-[30px] border border-[#dde8e2] bg-white/90 p-6 shadow-[0_18px_50px_rgba(46,69,58,0.08)]">
              <h2 className="text-xl font-semibold text-[#173128]">记忆类型分布</h2>
              <p className="mt-1 text-sm text-[#66766f]">各类型记忆的数量占比</p>

              <ResponsiveContainer width="100%" height={320}>
                <PieChart>
                  <Pie
                    data={stats.type_distribution}
                    dataKey="count"
                    nameKey="type"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={(props) => {
                      const entry = props as unknown as { type: string; count: number };
                      return `${TYPE_LABELS[entry.type]} (${entry.count})`;
                    }}
                    isAnimationActive={false}
                  >
                    {stats.type_distribution.map((entry) => (
                      <Cell
                        key={entry.type}
                        fill={TYPE_COLORS[entry.type] || "#94a3b8"}
                      />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* 重要度分布柱状图 */}
            <div className="rounded-[30px] border border-[#dde8e2] bg-white/90 p-6 shadow-[0_18px_50px_rgba(46,69,58,0.08)]">
              <h2 className="text-xl font-semibold text-[#173128]">重要度分布</h2>
              <p className="mt-1 text-sm text-[#66766f]">记忆重要度的区间分布</p>

              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={stats.importance_distribution}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e7eee9" vertical={false} />
                  <XAxis
                    dataKey="label"
                    stroke="#7a6c5d"
                    tick={{ fontSize: 11 }}
                    axisLine={{ stroke: "#d7e6df" }}
                  />
                  <YAxis
                    stroke="#7a6c5d"
                    tick={{ fontSize: 11 }}
                    axisLine={{ stroke: "#d7e6df" }}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar
                    dataKey="count"
                    fill="url(#importanceGradient)"
                    radius={[8, 8, 0, 0]}
                    isAnimationActive={false}
                  />
                  <defs>
                    <linearGradient id="importanceGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#2f7a5b" stopOpacity={0.9} />
                      <stop offset="100%" stopColor="#2f7a5b" stopOpacity={0.6} />
                    </linearGradient>
                  </defs>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* 增长趋势 */}
          <section className="rounded-[30px] border border-[#dde8e2] bg-white/90 p-6 shadow-[0_18px_50px_rgba(46,69,58,0.08)]">
            <h2 className="text-xl font-semibold text-[#173128]">记忆增长趋势</h2>
            <p className="mt-1 text-sm text-[#66766f]">按月统计的记忆增长情况</p>

            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={stats.growth_trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e7eee9" vertical={false} />
                <XAxis
                  dataKey="month"
                  stroke="#7a6c5d"
                  tick={{ fontSize: 11 }}
                  axisLine={{ stroke: "#d7e6df" }}
                />
                <YAxis
                  stroke="#7a6c5d"
                  tick={{ fontSize: 11 }}
                  axisLine={{ stroke: "#d7e6df" }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke="#2f7a5b"
                  strokeWidth={3}
                  dot={{ fill: "#2f7a5b", r: 4 }}
                  name="新增记忆"
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </section>

          {/* 最常检索的记忆 */}
          <section className="rounded-[30px] border border-[#dde8e2] bg-white/90 p-6 shadow-[0_18px_50px_rgba(46,69,58,0.08)]">
            <h2 className="text-xl font-semibold text-[#173128]">最常检索的记忆 Top 5</h2>
            <p className="mt-1 text-sm text-[#66766f]">检索次数最多的记忆内容</p>

            <div className="mt-5 space-y-3">
              {stats.retrieval_stats.most_retrieved.length > 0 ? (
                stats.retrieval_stats.most_retrieved.map((memory, index) => (
                  <div
                    key={memory.id}
                    className="rounded-[24px] border border-[#e7eee9] bg-[#fcfefd] p-5"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#edf7f2] text-sm font-semibold text-[#2f684f]">
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 text-xs">
                          <span className="rounded-full bg-[#edf7f2] px-3 py-1 text-[#305f4c]">
                            {TYPE_LABELS[memory.memory_type]}
                          </span>
                          <span className="rounded-full bg-[#fff5e8] px-3 py-1 text-[#8b6127]">
                            检索 {memory.retrieval_count} 次
                          </span>
                        </div>
                        <div className="mt-3 text-sm leading-7 text-[#3d544a]">
                          {memory.content}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-[24px] border border-dashed border-[#d9e4de] bg-[#fbfdfc] px-4 py-10 text-sm text-[#72827b]">
                  还没有被检索过的记忆。
                </div>
              )}
            </div>
          </section>
        </>
      ) : (
        <div className="flex h-96 items-center justify-center rounded-[30px] border border-[#dde8e2] bg-white/90">
          <div className="text-sm text-[#72827b]">请选择用户和人设查看统计数据</div>
        </div>
      )}
    </div>
  );
}
