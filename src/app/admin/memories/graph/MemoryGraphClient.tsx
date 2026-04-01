"use client";

import { useEffect, useState } from "react";

type GraphData = {
  nodes: Array<{
    id: string;
    label: string;
    type: string;
    importance: number;
    retrieval_count: number;
    created_at: string;
  }>;
  edges: Array<{
    source: string;
    target: string;
    weight: number;
    type: "temporal" | "semantic";
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

export default function MemoryGraphClient({
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
  const [data, setData] = useState<GraphData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  useEffect(() => {
    async function loadGraph() {
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

        const response = await fetch(`/api/admin/memories/graph?${params.toString()}`);
        const json = (await response.json()) as {
          success: boolean;
          data: GraphData | null;
          error: { message: string } | null;
        };

        if (!json.success || !json.data) {
          throw new Error(json.error?.message || "读取关系图失败");
        }

        setData(json.data);
      } catch (error) {
        setErrorText(error instanceof Error ? error.message : "读取关系图失败");
      } finally {
        setIsLoading(false);
      }
    }

    void loadGraph();
  }, [selectedUserId, selectedPersonaId, selectedCharacterId]);

  const selectedUser = users.find((u) => u.id === selectedUserId);
  const selectedPersona = personas.find((p) => p.id === selectedPersonaId);

  // 计算节点位置（改进的螺旋布局）
  const getNodePosition = (index: number, total: number) => {
    const centerX = 300;
    const centerY = 300;

    if (total === 1) {
      return { x: centerX, y: centerY };
    }

    // 使用螺旋布局，避免节点重叠
    const spiralSpacing = 30; // 螺旋间距
    const angleStep = 2.4; // 角度步进（黄金角）
    const angle = index * angleStep;
    const radius = spiralSpacing * Math.sqrt(index);

    return {
      x: centerX + radius * Math.cos(angle),
      y: centerY + radius * Math.sin(angle),
    };
  };

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
              Memory Graph
            </div>
            <h1 className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight text-[#173128]">
              记忆关系图：探索记忆之间的联系
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-[#5f6f67]">
              可视化展示记忆之间的时间关系和语义关系，帮助理解记忆网络的结构。
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
      ) : data && data.nodes.length > 0 ? (
        <>
          <section className="rounded-[30px] border border-[#dde8e2] bg-white/90 p-6 shadow-[0_18px_50px_rgba(46,69,58,0.08)]">
            <h2 className="text-xl font-semibold text-[#173128]">关系图可视化</h2>
            <p className="mt-1 text-sm text-[#66766f]">
              节点代表记忆，连线代表关系（蓝色=时间关系，绿色=语义关系）
            </p>

            <div className="mt-5 overflow-hidden rounded-[24px] border border-[#e7eee9] bg-[#fcfefd]">
              <svg width="100%" height="800" viewBox="0 0 600 600" preserveAspectRatio="xMidYMid meet">
                <defs>
                  <filter id="glow">
                    <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                    <feMerge>
                      <feMergeNode in="coloredBlur"/>
                      <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                  </filter>
                </defs>

                {/* 绘制边 */}
                {data.edges.map((edge, index) => {
                  const sourceNode = data.nodes.find((n) => n.id === edge.source);
                  const targetNode = data.nodes.find((n) => n.id === edge.target);
                  if (!sourceNode || !targetNode) return null;

                  const sourceIndex = data.nodes.indexOf(sourceNode);
                  const targetIndex = data.nodes.indexOf(targetNode);
                  const sourcePos = getNodePosition(sourceIndex, data.nodes.length);
                  const targetPos = getNodePosition(targetIndex, data.nodes.length);

                  return (
                    <line
                      key={`edge-${index}`}
                      x1={sourcePos.x}
                      y1={sourcePos.y}
                      x2={targetPos.x}
                      y2={targetPos.y}
                      stroke={edge.type === "temporal" ? "#3b82f6" : "#2f7a5b"}
                      strokeWidth={Math.max(edge.weight * 3, 1)}
                      strokeOpacity={0.4}
                    />
                  );
                })}

                {/* 绘制节点 */}
                {data.nodes.map((node, index) => {
                  const pos = getNodePosition(index, data.nodes.length);
                  const isSelected = selectedNode === node.id;
                  const radius = 6 + node.importance * 10;

                  return (
                    <g
                      key={node.id}
                      onClick={() => setSelectedNode(isSelected ? null : node.id)}
                      style={{ cursor: "pointer" }}
                    >
                      <circle
                        cx={pos.x}
                        cy={pos.y}
                        r={radius}
                        fill={TYPE_COLORS[node.type] || "#94a3b8"}
                        opacity={isSelected ? 1 : 0.85}
                        stroke={isSelected ? "#173128" : "white"}
                        strokeWidth={isSelected ? 3 : 2}
                        filter={isSelected ? "url(#glow)" : "none"}
                      />
                      {(isSelected || data.nodes.length <= 20) && (
                        <text
                          x={pos.x}
                          y={pos.y - radius - 8}
                          textAnchor="middle"
                          fontSize="11"
                          fill="#173128"
                          fontWeight={isSelected ? "600" : "400"}
                        >
                          {node.label.length > 15 ? node.label.substring(0, 15) + "..." : node.label}
                        </text>
                      )}
                    </g>
                  );
                })}
              </svg>
            </div>

            <div className="mt-4 flex gap-4 text-xs text-[#66766f]">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-[#3b82f6] opacity-30" />
                <span>时间关系</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-[#2f7a5b] opacity-30" />
                <span>语义关系</span>
              </div>
            </div>
          </section>

          {selectedNode && (
            <section className="rounded-[30px] border border-[#dde8e2] bg-white/90 p-6 shadow-[0_18px_50px_rgba(46,69,58,0.08)]">
              <h2 className="text-xl font-semibold text-[#173128]">节点详情</h2>
              {(() => {
                const node = data.nodes.find((n) => n.id === selectedNode);
                if (!node) return null;

                const connectedEdges = data.edges.filter(
                  (e) => e.source === node.id || e.target === node.id,
                );

                return (
                  <div className="mt-5 space-y-4">
                    <div className="rounded-[24px] border border-[#e7eee9] bg-[#fcfefd] p-5">
                      <div className="flex gap-2">
                        <span
                          className="rounded-full px-3 py-1 text-xs"
                          style={{
                            backgroundColor: `${TYPE_COLORS[node.type]}20`,
                            color: TYPE_COLORS[node.type],
                          }}
                        >
                          {TYPE_LABELS[node.type]}
                        </span>
                        <span className="rounded-full bg-[#fff5e8] px-3 py-1 text-xs text-[#8b6127]">
                          重要度 {(node.importance * 100).toFixed(0)}%
                        </span>
                        {node.retrieval_count > 0 && (
                          <span className="rounded-full bg-[#edf7f2] px-3 py-1 text-xs text-[#305f4c]">
                            检索 {node.retrieval_count} 次
                          </span>
                        )}
                      </div>
                      <div className="mt-3 text-sm leading-7 text-[#3d544a]">{node.label}</div>
                      <div className="mt-2 text-xs text-[#72827b]">
                        创建于 {new Date(node.created_at).toLocaleString("zh-CN")}
                      </div>
                    </div>

                    <div>
                      <div className="text-sm font-semibold text-[#173128]">
                        关联关系 ({connectedEdges.length})
                      </div>
                      <div className="mt-2 space-y-2">
                        {connectedEdges.map((edge, index) => {
                          const otherNodeId =
                            edge.source === node.id ? edge.target : edge.source;
                          const otherNode = data.nodes.find((n) => n.id === otherNodeId);
                          if (!otherNode) return null;

                          return (
                            <div
                              key={index}
                              className="rounded-[20px] border border-[#e7eee9] bg-[#fcfefd] p-4 text-xs"
                            >
                              <div className="flex items-center gap-2">
                                <span
                                  className="rounded-full px-2 py-1"
                                  style={{
                                    backgroundColor:
                                      edge.type === "temporal" ? "#3b82f620" : "#2f7a5b20",
                                    color: edge.type === "temporal" ? "#3b82f6" : "#2f7a5b",
                                  }}
                                >
                                  {edge.type === "temporal" ? "时间" : "语义"}
                                </span>
                                <span className="text-[#72827b]">
                                  权重 {(edge.weight * 100).toFixed(0)}%
                                </span>
                              </div>
                              <div className="mt-2 text-[#3d544a]">{otherNode.label}</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </section>
          )}

          <section className="rounded-[30px] border border-[#dde8e2] bg-white/90 p-6 shadow-[0_18px_50px_rgba(46,69,58,0.08)]">
            <h2 className="text-xl font-semibold text-[#173128]">图统计</h2>
            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <div className="rounded-[24px] border border-[#e7eee9] bg-[#fcfefd] p-4">
                <div className="text-sm text-[#73827b]">节点数量</div>
                <div className="mt-2 text-2xl font-semibold text-[#173128]">
                  {data.nodes.length}
                </div>
              </div>
              <div className="rounded-[24px] border border-[#e7eee9] bg-[#fcfefd] p-4">
                <div className="text-sm text-[#73827b]">关系数量</div>
                <div className="mt-2 text-2xl font-semibold text-[#173128]">
                  {data.edges.length}
                </div>
              </div>
              <div className="rounded-[24px] border border-[#e7eee9] bg-[#fcfefd] p-4">
                <div className="text-sm text-[#73827b]">平均连接度</div>
                <div className="mt-2 text-2xl font-semibold text-[#173128]">
                  {(data.edges.length / data.nodes.length).toFixed(1)}
                </div>
              </div>
            </div>
          </section>
        </>
      ) : (
        <div className="flex h-96 items-center justify-center rounded-[30px] border border-[#dde8e2] bg-white/90">
          <div className="text-sm text-[#72827b]">
            {data ? "暂无记忆数据" : "请选择用户和人设查看关系图"}
          </div>
        </div>
      )}
    </div>
  );
}
