"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Scatter,
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

type TimeSeriesChartProps = {
  logs: MemoryLog[];
};

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

function CustomTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: MemoryLog & { index: number } }> }) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  const data = payload[0].payload;

  return (
    <div className="rounded-2xl border border-[#dde8e2] bg-white/95 p-4 shadow-lg backdrop-blur-sm">
      <div className="text-sm font-semibold text-[#173127]">{data.operation}</div>
      <div className="mt-2 space-y-1 text-xs text-[#61716a]">
        <div>时间: {formatTime(data.timestamp)}</div>
        <div>延迟: {formatDuration(data.duration)}</div>
        <div>
          状态:{" "}
          <span className={data.success ? "text-[#2f684f]" : "text-[#b05545]"}>
            {data.success ? "成功" : "失败"}
          </span>
        </div>
        {!data.success && data.error_message && (
          <div className="mt-2 max-w-xs rounded-lg bg-[#fff0ef] px-2 py-1 text-[#b05545]">
            {data.error_message}
          </div>
        )}
        {data.duration > 2000 && (
          <div className="mt-1 rounded-lg bg-[#fff8f0] px-2 py-1 text-[#9a5a1c]">
            慢调用 ({'>'}2s)
          </div>
        )}
      </div>
    </div>
  );
}

export default function TimeSeriesChart({ logs }: TimeSeriesChartProps) {
  const chartData = logs.map((log, index) => ({
    ...log,
    index,
    time: formatTime(log.timestamp),
    errorPoint: !log.success ? log.duration : null,
    slowPoint: log.success && log.duration > 2000 ? log.duration : null,
  }));

  return (
    <ResponsiveContainer width="100%" height={420}>
      <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
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
          iconType="circle"
        />

        {/* 延迟趋势线 */}
        <Line
          type="monotone"
          dataKey="duration"
          stroke="#2f7a5b"
          strokeWidth={2}
          dot={false}
          name="延迟"
          isAnimationActive={false}
        />

        {/* 错误标记点 */}
        <Scatter
          dataKey="errorPoint"
          fill="#c0392b"
          name="失败"
          shape="circle"
          isAnimationActive={false}
        />

        {/* 慢调用标记点 */}
        <Scatter
          dataKey="slowPoint"
          fill="#d4a017"
          name="慢调用"
          shape="triangle"
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
