"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

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

type PerformanceOverviewProps = {
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

function CustomTooltip({ active, payload }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string; payload: { time: string; [key: string]: unknown } }> }) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  const data = payload[0].payload;

  return (
    <div className="rounded-2xl border border-[#dde8e2] bg-white/95 p-4 shadow-lg backdrop-blur-sm">
      <div className="text-sm font-semibold text-[#173127]">{data.time}</div>
      <div className="mt-2 space-y-1">
        {payload.map((entry) => (
          <div key={entry.name} className="flex items-center gap-2 text-xs">
            <div
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-[#61716a]">{entry.name}:</span>
            <span className="font-medium text-[#173127]">{formatDuration(entry.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function OperationBarTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: { operation: string; total: number; failures: number; avgDuration: number; successRate: number; slowCount: number } }> }) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  const data = payload[0].payload;

  return (
    <div className="rounded-2xl border border-[#dde8e2] bg-white/95 p-4 shadow-lg backdrop-blur-sm">
      <div className="text-sm font-semibold text-[#173127]">{data.operation}</div>
      <div className="mt-2 space-y-1 text-xs text-[#61716a]">
        <div>调用次数: {data.total}</div>
        <div>成功率: {(data.successRate * 100).toFixed(0)}%</div>
        <div>平均延迟: {formatDuration(data.avgDuration)}</div>
        <div>失败次数: {data.failures}</div>
        <div>慢调用: {data.slowCount}</div>
      </div>
    </div>
  );
}

export default function PerformanceOverview({ logs }: PerformanceOverviewProps) {
  // 按操作分组时序数据
  const operations = Array.from(new Set(logs.map((log) => log.operation)));

  // 构建时序数据：每个时间点包含所有操作的延迟
  const timeSeriesData = logs.reduce((acc, log, index) => {
    const time = formatTime(log.timestamp);
    const existing = acc.find((item) => item.time === time && item.index === index);

    if (!existing) {
      const dataPoint: Record<string, unknown> = {
        time,
        index,
        timestamp: log.timestamp,
      };

      dataPoint[log.operation] = log.duration;
      acc.push(dataPoint);
    }

    return acc;
  }, [] as Array<Record<string, unknown>>);

  // 操作统计数据
  const operationStats = operations.map((operation) => {
    const operationLogs = logs.filter((log) => log.operation === operation);
    const total = operationLogs.length;
    const failures = operationLogs.filter((log) => !log.success).length;
    const slowCount = operationLogs.filter((log) => log.duration > 2000).length;
    const avgDuration = operationLogs.reduce((sum, log) => sum + log.duration, 0) / Math.max(total, 1);
    const successRate = total === 0 ? 1 : (total - failures) / total;

    return {
      operation,
      total,
      failures,
      slowCount,
      avgDuration,
      successRate,
    };
  }).sort((a, b) => b.total - a.total);

  return (
    <div className="space-y-6">
      {/* 时序趋势图 - 每个操作一条线 */}
      <div className="rounded-[28px] border border-[#dde8e2] bg-white/90 p-6 shadow-[0_18px_50px_rgba(46,69,58,0.08)]">
        <div>
          <h3 className="text-lg font-semibold text-[#173127]">延迟时序趋势</h3>
          <p className="mt-1 text-sm text-[#67766f]">
            每个操作类型用不同颜色的线条显示，可以看到各操作的延迟变化趋势。
          </p>
        </div>

        <div className="mt-5">
          <ResponsiveContainer width="100%" height={420}>
            <LineChart data={timeSeriesData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e7eee9" />
              <XAxis
                dataKey="time"
                stroke="#7a6c5d"
                tick={{ fontSize: 11 }}
                interval="preserveStartEnd"
              />
              <YAxis
                stroke="#7a6c5d"
                tick={{ fontSize: 11 }}
                tickFormatter={(value) => formatDuration(value)}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: "12px", paddingTop: "10px" }}
                iconType="line"
              />

              {operations.map((operation, index) => (
                <Line
                  key={operation}
                  type="monotone"
                  dataKey={operation}
                  stroke={getOperationColor(operation, index)}
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                  name={operation}
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 操作对比图 */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-[28px] border border-[#dde8e2] bg-white/90 p-6 shadow-[0_18px_50px_rgba(46,69,58,0.08)]">
          <div>
            <h3 className="text-lg font-semibold text-[#173127]">调用量对比</h3>
            <p className="mt-1 text-sm text-[#67766f]">
              各操作的调用次数和成功率对比。
            </p>
          </div>

          <div className="mt-5">
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={operationStats} layout="vertical" margin={{ top: 5, right: 30, left: 80, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e7eee9" />
                <XAxis type="number" stroke="#7a6c5d" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="operation" stroke="#7a6c5d" tick={{ fontSize: 11 }} />
                <Tooltip content={<OperationBarTooltip />} />
                <Bar dataKey="total" name="调用次数" radius={[0, 8, 8, 0]} isAnimationActive={false}>
                  {operationStats.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={getOperationColor(entry.operation, index)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-[28px] border border-[#dde8e2] bg-white/90 p-6 shadow-[0_18px_50px_rgba(46,69,58,0.08)]">
          <div>
            <h3 className="text-lg font-semibold text-[#173127]">平均延迟对比</h3>
            <p className="mt-1 text-sm text-[#67766f]">
              各操作的平均响应时间对比。
            </p>
          </div>

          <div className="mt-5">
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={operationStats} layout="vertical" margin={{ top: 5, right: 30, left: 80, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e7eee9" />
                <XAxis
                  type="number"
                  stroke="#7a6c5d"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(value) => formatDuration(value)}
                />
                <YAxis type="category" dataKey="operation" stroke="#7a6c5d" tick={{ fontSize: 11 }} />
                <Tooltip content={<OperationBarTooltip />} />
                <Bar dataKey="avgDuration" name="平均延迟" radius={[0, 8, 8, 0]} isAnimationActive={false}>
                  {operationStats.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.avgDuration > 2000 ? "#ef4444" : entry.avgDuration > 1000 ? "#f59e0b" : getOperationColor(entry.operation, index)}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* 详细统计卡片 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {operationStats.map((stat, index) => (
          <div
            key={stat.operation}
            className="rounded-[24px] border border-[#edf2ee] bg-[#fbfdfc] p-5"
          >
            <div className="flex items-center gap-3">
              <div
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: getOperationColor(stat.operation, index) }}
              />
              <div className="text-base font-semibold text-[#173127]">{stat.operation}</div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div>
                <div className="text-xs text-[#6f7d76]">调用次数</div>
                <div className="mt-1 text-xl font-semibold text-[#173127]">{stat.total}</div>
              </div>
              <div>
                <div className="text-xs text-[#6f7d76]">成功率</div>
                <div className="mt-1 text-xl font-semibold text-[#173127]">
                  {(stat.successRate * 100).toFixed(0)}%
                </div>
              </div>
              <div>
                <div className="text-xs text-[#6f7d76]">平均延迟</div>
                <div className="mt-1 text-lg font-semibold text-[#173127]">
                  {formatDuration(stat.avgDuration)}
                </div>
              </div>
              <div>
                <div className="text-xs text-[#6f7d76]">失败/慢调用</div>
                <div className="mt-1 text-lg font-semibold text-[#173127]">
                  {stat.failures}/{stat.slowCount}
                </div>
              </div>
            </div>

            <div className="mt-3">
              <div className="h-1.5 overflow-hidden rounded-full bg-[#eaf1ec]">
                <div
                  className={`h-full rounded-full transition-all ${stat.successRate >= 0.95 ? "bg-[#2f7a5b]" : stat.successRate >= 0.8 ? "bg-[#f59e0b]" : "bg-[#ef4444]"}`}
                  style={{ width: `${stat.successRate * 100}%` }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
