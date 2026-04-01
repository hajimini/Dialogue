import { describe, expect, it } from "@jest/globals";
import { renderToStaticMarkup } from "react-dom/server";
import MetricStatsTable from "@/components/admin/MetricStatsTable";

describe("MetricStatsTable", () => {
  it("highlights slow rows when p95 or max exceed the threshold", () => {
    const html = renderToStaticMarkup(
      <MetricStatsTable
        metrics={{
          "memory.search.duration": {
            count: 3,
            mean: 2100,
            median: 2050,
            p95: 2300,
            p99: 2300,
            min: 1900,
            max: 2400,
          },
          "memory.add.duration": {
            count: 2,
            mean: 400,
            median: 400,
            p95: 500,
            p99: 500,
            min: 300,
            max: 500,
          },
        }}
      />,
    );

    expect(html).toContain("memory.search.duration");
    expect(html).toContain("bg-[#fff7f0]");
    expect(html).toContain("memory.add.duration");
  });

  it("renders nothing when there are no metrics", () => {
    const html = renderToStaticMarkup(<MetricStatsTable metrics={{}} />);

    expect(html).toBe("");
  });
});
