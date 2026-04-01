"use client";

import { useEffect, useState } from "react";
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

type QualityData = {
  scored_memories: Array<{
    id: string;
    content: string;
    memory_type: string;
    quality_score: number;
    grade: "A" | "B" | "C" | "D" | "F";
    breakdown: {
      importance: number;
      usage: number;
      accuracy: number;
      content: number;
      freshness: number;
    };
    suggestions: string[];
    created_at: string;
  }>;
  summary: {
    total_count: number;
    avg_score: number;
    grade_distribution: Record<string, number>;
    high_quality_count: number;
    low_quality_count: number;
    high_quality_rate: number;
    low_quality_rate: number;
  } | null;
};

const TYPE_LABELS: Record<string, string> = {
  user_fact: "用户事实",
  persona_fact: "人设事实",
  shared_event: "共同经历",
  relationship: "关系状态",
  session_summary: "会话摘要",
};

const GRADE_COLORS: Record<string, string> = {
  A: "#2f7a5b",
  B: "#3b82f6",
  C: "#f59e0b",
  D: "#fb923c",
  F: "#ef4444",
};

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number }>;
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

export default function MemoryQualityClient({
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
  const [data, setData] = useState<QualityData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [filterGrade, setFilterGrade] = useState<string>("all");

  useEffect(() => {
    async function loadQuality() {
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

        const response = await fetch(`/api/admin/memories/quality?${params.toString()}`);
        const json = (await response.json()) as {
          success: boolean;
          data: QualityData | null;
          error: { message: string } | null;
        };

        if (!json.success || !json.data) {
          throw new Error(json.error?.message || "读取质量评分失败");
        }

        setData(json.data);
      } catch (error) {
        setErrorText(error instanceof Error ? error.message : "读取质量评分失败");
      } finally {
        setIsLoading(false);
      }
    }

    void loadQuality();
  }, [selectedUserId, selectedPersonaId, selectedCharacterId]);

  const selectedUser = users.find((u) => u.id === selectedUserId);
  const selectedPersona = personas.find((p) => p.id === selectedPersonaId);

  const filteredMemories =
    filterGrade === "all"
      ? data?.scored_memories
      : data?.scored_memories.filter((m) => m.grade === filterGrade);

  const gradeChartData = data?.summary
    ? Object.entries(data.summary.grade_distribution).map(([grade, count]) => ({
        grade,
        count,
      }))
    : [];

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
              Quality Scoring
            </div>
            <h1 className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight text-[#173128]">
              记忆质量评分：多维度评估记忆价值
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-[#5f6f67]">
              基于重要度、使用频率、准确率、内容质量和时效性的综合评分系统。
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
      ) : data?.summary ? (
        <>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-[26px] border border-[#dde8e2] bg-gradient-to-br from-white to-[#f8faf9] p-5 shadow-[0_16px_40px_rgba(43,62,53,0.06)]">
              <div className="text-sm text-[#73827b]">平均质量分</div>
              <div className="mt-2 text-3xl font-semibold text-[#173128]">
                {data.summary.avg_score}
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#eaf1ec]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#2f7a5b] to-[#3d9b73]"
                  style={{ width: `${data.summary.avg_score}%` }}
                />
              </div>
            </div>

            <div className="rounded-[26px] border border-[#dde8e2] bg-gradient-to-br from-white to-[#f8faf9] p-5 shadow-[0_16px_40px_rgba(43,62,53,0.06)]">
              <div className="text-sm text-[#73827b]">高质量记忆</div>
              <div className="mt-2 text-3xl font-semibold text-[#173128]">
                {data.summary.high_quality_count}
              </div>
              <div className="mt-2 text-xs text-[#66766f]">
                占比 {data.summary.high_quality_rate.toFixed(1)}%
              </div>
            </div>

            <div className="rounded-[26px] border border-[#dde8e2] bg-gradient-to-br from-white to-[#f8faf9] p-5 shadow-[0_16px_40px_rgba(43,62,53,0.06)]">
              <div className="text-sm text-[#73827b]">低质量记忆</div>
              <div className="mt-2 text-3xl font-semibold text-[#173128]">
                {data.summary.low_quality_count}
              </div>
              <div className="mt-2 text-xs text-[#66766f]">
                占比 {data.summary.low_quality_rate.toFixed(1)}%
              </div>
            </div>

            <div className="rounded-[26px] border border-[#dde8e2] bg-gradient-to-br from-white to-[#f8faf9] p-5 shadow-[0_16px_40px_rgba(43,62,53,0.06)]">
              <div className="text-sm text-[#73827b]">记忆总数</div>
              <div className="mt-2 text-3xl font-semibold text-[#173128]">
                {data.summary.total_count}
              </div>
              <div className="mt-2 text-xs text-[#66766f]">已评分</div>
            </div>
          </section>

          <section className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-[30px] border border-[#dde8e2] bg-white/90 p-6 shadow-[0_18px_50px_rgba(46,69,58,0.08)]">
              <h2 className="text-xl font-semibold text-[#173128]">评级分布</h2>
              <p className="mt-1 text-sm text-[#66766f]">各评级的记忆数量</p>

              <ResponsiveContainer width="100%" height={320}>
                <PieChart>
                  <Pie
                    data={gradeChartData}
                    dataKey="count"
                    nameKey="grade"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={(props) => {
                      const entry = props as unknown as { grade: string; count: number };
                      return `${entry.grade} (${entry.count})`;
                    }}
                    isAnimationActive={false}
                  >
                    {gradeChartData.map((entry) => (
                      <Cell key={entry.grade} fill={GRADE_COLORS[entry.grade] || "#94a3b8"} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="rounded-[30px] border border-[#dde8e2] bg-white/90 p-6 shadow-[0_18px_50px_rgba(46,69,58,0.08)]">
              <h2 className="text-xl font-semibold text-[#173128]">评分说明</h2>
              <p className="mt-1 text-sm text-[#66766f]">质量评分的计算维度</p>

              <div className="mt-5 space-y-3">
                <div className="rounded-[20px] border border-[#e7eee9] bg-[#fcfefd] p-4">
                  <div className="text-sm font-semibold text-[#173128]">重要度 (30%)</div>
                  <div className="mt-1 text-xs text-[#66766f]">记忆的重要性评分</div>
                </div>
                <div className="rounded-[20px] border border-[#e7eee9] bg-[#fcfefd] p-4">
                  <div className="text-sm font-semibold text-[#173128]">使用频率 (25%)</div>
                  <div className="mt-1 text-xs text-[#66766f]">检索次数反映实际价值</div>
                </div>
                <div className="rounded-[20px] border border-[#e7eee9] bg-[#fcfefd] p-4">
                  <div className="text-sm font-semibold text-[#173128]">准确率 (20%)</div>
                  <div className="mt-1 text-xs text-[#66766f]">用户反馈的准确性</div>
                </div>
                <div className="rounded-[20px] border border-[#e7eee9] bg-[#fcfefd] p-4">
                  <div className="text-sm font-semibold text-[#173128]">内容质量 (15%)</div>
                  <div className="mt-1 text-xs text-[#66766f]">内容长度和结构合理性</div>
                </div>
                <div className="rounded-[20px] border border-[#e7eee9] bg-[#fcfefd] p-4">
                  <div className="text-sm font-semibold text-[#173128]">时效性 (10%)</div>
                  <div className="mt-1 text-xs text-[#66766f]">记忆的新鲜程度</div>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-[30px] border border-[#dde8e2] bg-white/90 p-6 shadow-[0_18px_50px_rgba(46,69,58,0.08)]">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-[#173128]">记忆详情</h2>
                <p className="mt-1 text-sm text-[#66766f]">
                  查看每条记忆的质量评分和改进建议
                </p>
              </div>
              <select
                value={filterGrade}
                onChange={(e) => setFilterGrade(e.target.value)}
                className="rounded-2xl border border-[#d7e6df] bg-white px-4 py-2 text-sm outline-none"
              >
                <option value="all">全部评级</option>
                <option value="A">A 级</option>
                <option value="B">B 级</option>
                <option value="C">C 级</option>
                <option value="D">D 级</option>
                <option value="F">F 级</option>
              </select>
            </div>

            <div className="mt-5 space-y-3">
              {filteredMemories && filteredMemories.length > 0 ? (
                filteredMemories.slice(0, 20).map((memory) => (
                  <div
                    key={memory.id}
                    className="rounded-[24px] border border-[#e7eee9] bg-[#fcfefd] p-5"
                  >
                    <div className="flex items-start gap-4">
                      <div
                        className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full text-lg font-bold"
                        style={{
                          backgroundColor: `${GRADE_COLORS[memory.grade]}20`,
                          color: GRADE_COLORS[memory.grade],
                        }}
                      >
                        {memory.grade}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-semibold text-[#173128]">
                            {memory.quality_score}
                          </span>
                          <span className="rounded-full bg-[#edf7f2] px-3 py-1 text-xs text-[#305f4c]">
                            {TYPE_LABELS[memory.memory_type]}
                          </span>
                        </div>
                        <div className="mt-2 text-sm leading-7 text-[#3d544a]">
                          {memory.content}
                        </div>

                        <div className="mt-3 grid grid-cols-5 gap-2 text-xs">
                          <div>
                            <div className="text-[#72827b]">重要度</div>
                            <div className="font-semibold text-[#173128]">
                              {memory.breakdown.importance}
                            </div>
                          </div>
                          <div>
                            <div className="text-[#72827b]">使用</div>
                            <div className="font-semibold text-[#173128]">
                              {memory.breakdown.usage}
                            </div>
                          </div>
                          <div>
                            <div className="text-[#72827b]">准确</div>
                            <div className="font-semibold text-[#173128]">
                              {memory.breakdown.accuracy}
                            </div>
                          </div>
                          <div>
                            <div className="text-[#72827b]">内容</div>
                            <div className="font-semibold text-[#173128]">
                              {memory.breakdown.content}
                            </div>
                          </div>
                          <div>
                            <div className="text-[#72827b]">时效</div>
                            <div className="font-semibold text-[#173128]">
                              {memory.breakdown.freshness}
                            </div>
                          </div>
                        </div>

                        {memory.suggestions.length > 0 && (
                          <div className="mt-3 space-y-1">
                            {memory.suggestions.map((suggestion, index) => (
                              <div
                                key={index}
                                className="text-xs text-[#8b6127]"
                              >
                                • {suggestion}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-[24px] border border-dashed border-[#d9e4de] bg-[#fbfdfc] px-4 py-10 text-center text-sm text-[#72827b]">
                  没有符合条件的记忆
                </div>
              )}
            </div>
          </section>
        </>
      ) : (
        <div className="flex h-96 items-center justify-center rounded-[30px] border border-[#dde8e2] bg-white/90">
          <div className="text-sm text-[#72827b]">请选择用户和人设查看质量评分</div>
        </div>
      )}
    </div>
  );
}
