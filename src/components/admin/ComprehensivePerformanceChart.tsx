"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useMemo } from "react";

type MemoryLog = {
  timestamp: string;
  operation: string;
  user_id: string;
  persona_id?: string | null;
  duration: number;
  success: boolean;
  error_message?: string | null;
  metadata?: Record<string, unknown> | null;
};

type ComprehensivePerformanceChartProps = {
  logs: MemoryLog[];
};

const OPERATION_COLORS: Record<string, string> = {
  search: "#2f7a5b",
  add: "#3b82f6",
  update: "#8b5cf6",
  delete: "#ef4444",
  get: "#f59e0b",
  list: "#10b981",
};

function getOperationColor(operation: string, index: number): string {
  if (OPERATION_COLORS[operation]) {
    return OPERATION_COLORS[operation];
  }

  const colors = ["#2f7a5b", "#3b82f6", "#8b5cf6", "#ef4444", "#f59e0b", "#10b981", "#ec4899", "#06b6d4"];
  return colors[index % colors.length];
}

function formatTime(timestamp: string) {
  try {
    const date = new Date(timestamp);
    return new Intl.DateTimeFormat("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(date);
  } catch {
    return timestamp;
  }
}

function formatDuration(value: number) {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}s`;
  }
  return `${Math.round(value)}ms`;
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    color: string;
    dataKey: string | ((entry: unknown) => unknown);
    payload: {
      time: string;
      timestamp: string;
      totalCalls: number;
      successRate: number;
      failures: number;
      slowCalls: number;
      avgDuration: number;
      [key: string]: unknown;
    };
  }>;
}) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  const data = payload[0].payload;
  const operationBars = payload.filter((p) => typeof p.dataKey === "string" && p.dataKey.endsWith("_count"));

  return (
    <div className="rounded-2xl border border-[#dde8e2] bg-white/98 p-4 shadow-xl backdrop-blur-sm">
      <div className="border-b border-[#e7eee9] pb-3">
        <div className="text-sm font-semibold text-[#173127]">{data.time}</div>
        <div className="mt-2 grid grid-cols-2 gap-3 text-xs">
          <div>
            <div className="text-[#6f7d76]">总调用</div>
            <div className="mt-0.5 text-lg font-semibold text-[#173127]">{data.totalCalls}</div>
          </div>
          <div>
            <div className="text-[#6f7d76]">成功率</div>
            <div className="mt-0.5 text-lg font-semibold text-[#173127]">
              {(data.successRate * 100).toFixed(0)}%
            </div>
          </div>
          <div>
            <div className="text-[#6f7d76]">平均延迟</div>
            <div className="mt-0.5 text-base font-semibold text-[#173127]">
              {formatDuration(data.avgDuration)}
            </div>
          </div>
          <div>
            <div className="text-[#6f7d76]">失败/慢</div>
            <div className="mt-0.5 text-base font-semibold text-[#173127]">
              {data.failures}/{data.slowCalls}
            </div>
          </div>
        </div>
      </div>

      {operationBars.length > 0 && (
        <div className="mt-3">
          <div className="mb-2 text-xs font-medium text-[#61716a]">各操作调用量</div>
          <div className="space-y-2">
            {operationBars.map((entry) => {
              const operation = typeof entry.dataKey === "string" ? entry.dataKey.replace("_count", "") : "unknown";
              return (
                <div key={entry.name} className="flex items-center gap-2">
                  <div
                    className="h-3 w-3 rounded"
                    style={{ backgroundColor: entry.color }}
                  />
                  <div className="flex-1 text-xs text-[#61716a]">{operation}</div>
                  <div className="text-xs font-semibold text-[#173127]">{entry.value}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ComprehensivePerformanceChart({
  logs,
}: ComprehensivePerformanceChartProps) {
  const { chartData, operations, stats } = useMemo(() => {
    const operations = Array.from(new Set(logs.map((log) => log.operation)));

    // 按时间窗口聚合数据
    const timeWindows = new Map<
      string,
      {
        timestamp: string;
        logs: MemoryLog[];
        operationData: Map<string, { durations: number[]; count: number }>;
      }
    >();

    logs.forEach((log) => {
      const time = formatTime(log.timestamp);
      if (!timeWindows.has(time)) {
        timeWindows.set(time, {
          timestamp: log.timestamp,
          logs: [],
          operationData: new Map(),
        });
      }

      const window = timeWindows.get(time)!;
      window.logs.push(log);

      if (!window.operationData.has(log.operation)) {
        window.operationData.set(log.operation, { durations: [], count: 0 });
      }

      const opData = window.operationData.get(log.operation)!;
      opData.durations.push(log.duration);
      opData.count += 1;
    });

    // 构建图表数据
    const chartData = Array.from(timeWindows.entries()).map(([time, window]) => {
      const totalDuration = window.logs.reduce((sum, log) => sum + log.duration, 0);
      const avgDuration = totalDuration / window.logs.length;

      const dataPoint: Record<string, unknown> = {
        time,
        timestamp: window.timestamp,
        totalCalls: window.logs.length,
        failures: window.logs.filter((log) => !log.success).length,
        slowCalls: window.logs.filter((log) => log.duration > 2000).length,
        successRate:
          window.logs.length === 0
            ? 1
            : window.logs.filter((log) => log.success).length / window.logs.length,
        avgDuration,
      };

      // 每个操作的调用量
      operations.forEach((operation) => {
        const opData = window.operationData.get(operation);
        dataPoint[`${operation}_count`] = opData ? opData.count : 0;
      });

      return dataPoint;
    });

    // 计算统计数据
    const stats = operations.map((operation, index) => {
      const operationLogs = logs.filter((log) => log.operation === operation);
      const total = operationLogs.length;
      const failures = operationLogs.filter((log) => !log.success).length;
      const slowCount = operationLogs.filter((log) => log.duration > 2000).length;
      const avgDuration =
        operationLogs.reduce((sum, log) => sum + log.duration, 0) / Math.max(total, 1);
      const successRate = total === 0 ? 1 : (total - failures) / total;

      return {
        operation,
        total,
        failures,
        slowCount,
        avgDuration,
        successRate,
        color: getOperationColor(operation, index),
      };
    }).sort((a, b) => b.total - a.total);

    return { chartData, operations, stats };
  }, [logs]);

  const maxCallCount = Math.max(
    ...chartData.map((d) => d.totalCalls as number),
    1,
  );

  return (
    <div className="space-y-6">
      {/* 主综合图表 */}
      <div className="rounded-[28px] border border-[#dde8e2] bg-gradient-to-br from-white to-[#f8faf9] p-6 shadow-[0_18px_50px_rgba(46,69,58,0.08)]">
        <div className="mb-5">
          <h3 className="text-lg font-semibold text-[#173127]">调用量与性能监控</h3>
          <p className="mt-1 text-sm text-[#67766f]">
            柱状图显示各操作调用量分布，散点标记失败和慢调用。
          </p>
        </div>

        <ResponsiveContainer width="100%" height={480}>
          <ComposedChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <defs>
              {operations.map((operation, index) => (
                <linearGradient key={operation} id={`gradient-${operation}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={getOperationColor(operation, index)} stopOpacity={0.9} />
                  <stop offset="100%" stopColor={getOperationColor(operation, index)} stopOpacity={0.6} />
                </linearGradient>
              ))}
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke="#e7eee9" vertical={false} />

            {/* X轴 */}
            <XAxis
              dataKey="time"
              stroke="#7a6c5d"
              tick={{ fontSize: 11 }}
              interval="preserveStartEnd"
              axisLine={{ stroke: "#d7e6df" }}
            />

            {/* Y轴 - 调用量 */}
            <YAxis
              stroke="#7a6c5d"
              tick={{ fontSize: 11 }}
              domain={[0, maxCallCount * 1.2]}
              axisLine={{ stroke: "#d7e6df" }}
              label={{
                value: "调用量",
                angle: -90,
                position: "insideLeft",
                style: { fontSize: 12, fill: "#7a6c5d" }
              }}
            />

            <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(47, 122, 91, 0.05)" }} />
            <Legend
              wrapperStyle={{ fontSize: "12px", paddingTop: "15px" }}
              iconType="rect"
              iconSize={12}
            />

            {/* 调用量柱状图（堆叠，带渐变） */}
            {operations.map((operation, index) => (
              <Bar
                key={`${operation}_count`}
                dataKey={`${operation}_count`}
                stackId="calls"
                fill={`url(#gradient-${operation})`}
                name={operation}
                radius={index === operations.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                isAnimationActive={false}
              />
            ))}

            {/* 失败标记（红色散点） */}
            <Scatter
              dataKey={(entry) => {
                if ((entry.failures as number) > 0) {
                  return (entry.totalCalls as number) * 1.1;
                }
                return null;
              }}
              fill="#ef4444"
              shape="circle"
              name="失败"
              isAnimationActive={false}
            />

            {/* 慢调用标记（橙色三角） */}
            <Scatter
              dataKey={(entry) => {
                if ((entry.slowCalls as number) > 0) {
                  return (entry.totalCalls as number) * 1.05;
                }
                return null;
              }}
              fill="#f59e0b"
              shape="triangle"
              name="慢调用"
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* 操作统计卡片 - 更美观的设计 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {stats.map((stat) => (
          <div
            key={stat.operation}
            className="group relative overflow-hidden rounded-[24px] border border-[#edf2ee] bg-gradient-to-br from-white to-[#fbfdfc] p-5 shadow-sm transition-all hover:shadow-md"
          >
            {/* 背景装饰 */}
            <div
              className="absolute right-0 top-0 h-24 w-24 rounded-full opacity-5 blur-2xl transition-opacity group-hover:opacity-10"
              style={{ backgroundColor: stat.color }}
            />

            <div className="relative">
              <div className="flex items-center gap-2">
                <div
                  className="h-4 w-4 rounded-lg shadow-sm"
                  style={{ backgroundColor: stat.color }}
                />
                <div className="text-base font-semibold text-[#173127]">{stat.operation}</div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-white/80 p-3">
                  <div className="text-xs text-[#6f7d76]">调用次数</div>
                  <div className="mt-1 text-xl font-bold text-[#173127]">{stat.total}</div>
                </div>
                <div className="rounded-xl bg-white/80 p-3">
                  <div className="text-xs text-[#6f7d76]">成功率</div>
                  <div className="mt-1 text-xl font-bold text-[#173127]">
                    {(stat.successRate * 100).toFixed(0)}%
                  </div>
                </div>
                <div className="rounded-xl bg-white/80 p-3">
                  <div className="text-xs text-[#6f7d76]">平均延迟</div>
                  <div className="mt-1 text-base font-semibold text-[#173127]">
                    {formatDuration(stat.avgDuration)}
                  </div>
                </div>
                <div className="rounded-xl bg-white/80 p-3">
                  <div className="text-xs text-[#6f7d76]">失败/慢</div>
                  <div className="mt-1 text-base font-semibold text-[#173127]">
                    <span className={stat.failures > 0 ? "text-[#ef4444]" : ""}>{stat.failures}</span>
                    <span className="text-[#6f7d76]">/</span>
                    <span className={stat.slowCount > 0 ? "text-[#f59e0b]" : ""}>{stat.slowCount}</span>
                  </div>
                </div>
              </div>

              <div className="mt-4">
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="text-[#6f7d76]">健康度</span>
                  <span className="font-medium text-[#173127]">
                    {(stat.successRate * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-[#eaf1ec]">
                  <div
                    className={`h-full rounded-full transition-all ${
                      stat.successRate >= 0.95
                        ? "bg-gradient-to-r from-[#2f7a5b] to-[#3d9b73]"
                        : stat.successRate >= 0.8
                          ? "bg-gradient-to-r from-[#f59e0b] to-[#fb923c]"
                          : "bg-gradient-to-r from-[#ef4444] to-[#f87171]"
                    }`}
                    style={{ width: `${stat.successRate * 100}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
