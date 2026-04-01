import { describe, expect, it } from "@jest/globals";
import { MemoryMetrics } from "@/lib/memory/metrics";

describe("MemoryMetrics", () => {
  it("computes stats from recorded values", () => {
    const metrics = new MemoryMetrics();
    const samples = [120, 200, 310, 450, 900];

    for (const value of samples) {
      metrics.record("memory.search.duration", value);
    }

    expect(metrics.getStats("memory.search.duration")).toEqual({
      count: 5,
      mean: 396,
      median: 310,
      p95: 900,
      p99: 900,
      min: 120,
      max: 900,
    });
  });

  it("clears recorded metrics on reset", () => {
    const metrics = new MemoryMetrics();

    metrics.record("memory.getContext.duration", 150);
    metrics.reset();

    expect(metrics.getStats("memory.getContext.duration")).toBeNull();
    expect(metrics.getAllStats()).toEqual({});
  });
});
