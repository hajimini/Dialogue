"use client";

type MetricStats = {
  count: number;
  mean: number;
  median: number;
  p95: number;
  p99: number;
  min: number;
  max: number;
};

function formatNumber(value: number) {
  if (Number.isInteger(value)) return `${value}`;
  return value.toFixed(2);
}

export default function MetricStatsTable({
  metrics,
}: {
  metrics: Record<string, MetricStats>;
}) {
  const rows = Object.entries(metrics).sort((left, right) => right[1].p95 - left[1].p95);

  if (rows.length === 0) {
    return null;
  }

  return (
    <div className="overflow-hidden rounded-[24px] border border-[#dcebe4] bg-white">
      <div className="max-h-[420px] overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-[#f4faf7] text-left text-[#3b5f51]">
            <tr>
              <th className="px-4 py-3">指标</th>
              <th className="px-4 py-3">count</th>
              <th className="px-4 py-3">mean</th>
              <th className="px-4 py-3">median</th>
              <th className="px-4 py-3">p95</th>
              <th className="px-4 py-3">p99</th>
              <th className="px-4 py-3">min</th>
              <th className="px-4 py-3">max</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([name, stats]) => {
              const isSlow = stats.p95 > 2000 || stats.max > 2000;
              return (
                <tr
                  key={name}
                  className={isSlow ? "bg-[#fff7f0]" : "border-t border-[#edf3ef]"}
                >
                  <td className="px-4 py-3 font-medium text-[#284d40]">{name}</td>
                  <td className="px-4 py-3">{formatNumber(stats.count)}</td>
                  <td className="px-4 py-3">{formatNumber(stats.mean)}</td>
                  <td className="px-4 py-3">{formatNumber(stats.median)}</td>
                  <td className="px-4 py-3">{formatNumber(stats.p95)}</td>
                  <td className="px-4 py-3">{formatNumber(stats.p99)}</td>
                  <td className="px-4 py-3">{formatNumber(stats.min)}</td>
                  <td className="px-4 py-3">{formatNumber(stats.max)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
