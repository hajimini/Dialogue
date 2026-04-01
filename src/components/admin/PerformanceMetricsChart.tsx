"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type MetricStats = {
  count: number;
  mean: number;
  median: number;
  p95: number;
  p99: number;
  min: number;
  max: number;
};

export default function PerformanceMetricsChart({
  metrics,
}: {
  metrics: Record<string, MetricStats>;
}) {
  const data = Object.entries(metrics)
    .map(([name, stats]) => ({
      name: name.replace(".duration", ""),
      mean: Number(stats.mean.toFixed(2)),
      p95: Number(stats.p95.toFixed(2)),
      max: Number(stats.max.toFixed(2)),
    }))
    .sort((left, right) => right.p95 - left.p95);

  if (data.length === 0) {
    return (
      <div className="rounded-[24px] border border-dashed border-[#d7e8e0] px-4 py-10 text-sm text-[#6a7c74]">
        还没有可展示的性能指标。
      </div>
    );
  }

  return (
    <div className="h-[360px] min-h-[360px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 12, right: 12, left: 0, bottom: 8 }}
          barGap={10}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#dce9e2" vertical={false} />
          <XAxis dataKey="name" tick={{ fill: "#527165", fontSize: 12 }} />
          <YAxis tick={{ fill: "#527165", fontSize: 12 }} />
          <Tooltip
            cursor={{ fill: "rgba(41, 85, 67, 0.06)" }}
            contentStyle={{
              borderRadius: 16,
              borderColor: "#dce9e2",
              boxShadow: "0 18px 45px rgba(46,69,58,0.12)",
            }}
          />
          <Bar dataKey="mean" fill="#3d8a68" radius={[8, 8, 0, 0]} />
          <Bar dataKey="p95" fill="#d9913a" radius={[8, 8, 0, 0]} />
          <Bar dataKey="max" fill="#cf5d47" radius={[8, 8, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
