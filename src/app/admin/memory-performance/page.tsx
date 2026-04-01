"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import ComprehensivePerformanceChart from "@/components/admin/ComprehensivePerformanceChart";

type MemoryLog = {
  timestamp: string;
  operation: string;
  user_id: string;
  persona_id?: string | null;
  character_id?: string | null;
  memory_id?: string | null;
  duration: number;
  success: boolean;
  error_message?: string | null;
  metadata?: Record<string, unknown> | null;
};

type Character = {
  id: string;
  name: string;
};

function formatDuration(value: number) {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}s`;
  }

  return `${Math.round(value)}ms`;
}

function StatCard({
  label,
  value,
}: {
  label: string;
  value: number | string;
}) {
  return (
    <div className="rounded-[26px] border border-[#dde8e2] bg-white/88 px-5 py-5 shadow-[0_18px_50px_rgba(46,69,58,0.08)]">
      <div className="text-sm text-[#6e7d76]">{label}</div>
      <div className="mt-2 text-3xl font-semibold text-[#173127]">{value}</div>
    </div>
  );
}

export default function MemoryPerformancePage() {
  const [logs, setLogs] = useState<MemoryLog[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);
  const [charactersLoading, setCharactersLoading] = useState(true);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);
  const [operationFilter, setOperationFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "success" | "failure">("all");
  const [characterFilter, setCharacterFilter] = useState("all");

  const loadLogs = useCallback(async () => {
    setLogsLoading(true);

    try {
      const search = new URLSearchParams({ limit: "250" });
      const response = await fetch(`/api/admin/memory-logs?${search.toString()}`, {
        cache: "no-store",
      });
      const json = (await response.json()) as {
        success: boolean;
        data: { logs: MemoryLog[] } | null;
        error: { message: string } | null;
      };

      if (!json.success || !json.data) {
        throw new Error(json.error?.message || "读取操作日志失败");
      }

      setLogs(json.data.logs);
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "读取性能数据失败");
    } finally {
      setLogsLoading(false);
    }
  }, []);

  const loadCharacters = useCallback(async () => {
    setCharactersLoading(true);

    try {
      const response = await fetch("/api/admin/all-characters", {
        cache: "no-store",
      });
      const json = (await response.json()) as {
        success: boolean;
        data: { characters: Character[] } | null;
        error: { message: string } | null;
      };

      if (!json.success || !json.data) {
        throw new Error(json.error?.message || "读取角色列表失败");
      }

      setCharacters(json.data.characters);
    } catch (error) {
      setErrorText((current) =>
        current ?? (error instanceof Error ? error.message : "读取角色列表失败"),
      );
    } finally {
      setCharactersLoading(false);
    }
  }, []);

  const loadData = useCallback(async () => {
    setErrorText(null);
    await Promise.allSettled([loadLogs(), loadCharacters()]);
  }, [loadCharacters, loadLogs]);

  const handleReset = useCallback(async () => {
    setResetting(true);
    setErrorText(null);

    try {
      const response = await fetch("/api/admin/memory-metrics", {
        method: "DELETE",
      });
      const json = (await response.json()) as {
        success: boolean;
        error: { message: string } | null;
      };

      if (!json.success) {
        throw new Error(json.error?.message || "重置指标失败");
      }

      await loadLogs();
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "重置指标失败");
    } finally {
      setResetting(false);
    }
  }, [loadLogs]);

  useEffect(() => {
    void loadData();
    const timer = window.setInterval(() => {
      void loadLogs();
    }, 30000);

    return () => window.clearInterval(timer);
  }, [loadData, loadLogs]);

  const operationOptions = useMemo(
    () => ["all", ...Array.from(new Set(logs.map((log) => log.operation))).sort()],
    [logs],
  );

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (operationFilter !== "all" && log.operation !== operationFilter) {
        return false;
      }

      if (statusFilter === "success" && !log.success) {
        return false;
      }

      if (statusFilter === "failure" && log.success) {
        return false;
      }

      if (characterFilter !== "all" && log.character_id !== characterFilter) {
        return false;
      }

      return true;
    });
  }, [characterFilter, logs, operationFilter, statusFilter]);

  const summary = useMemo(() => {
    const total = filteredLogs.length;
    const failures = filteredLogs.filter((log) => !log.success).length;
    const slow = filteredLogs.filter((log) => log.duration > 2000).length;
    const avgDuration =
      filteredLogs.reduce((sum, log) => sum + log.duration, 0) / Math.max(total, 1);

    return {
      total,
      failures,
      slow,
      avgDuration,
      successRate: total === 0 ? 1 : (total - failures) / total,
    };
  }, [filteredLogs]);

  const hasLogs = logs.length > 0;

  return (
    <div className="mx-auto flex w-full max-w-[1640px] flex-col gap-6 px-6 py-8">
      <section className="rounded-[30px] border border-[#dde8e2] bg-[linear-gradient(135deg,_rgba(255,252,247,0.98),_rgba(244,250,247,0.96))] p-6 shadow-[0_18px_50px_rgba(46,69,58,0.08)]">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.26em] text-[#76837c]">
              Memory Observability
            </div>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[#163127]">
              所有关键调用都放进一条可追踪的监控视图里。
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-[#61716a]">
              页面优先渲染真实日志，再补角色筛选数据。这样日志已存在时，不会再因为附加筛选数据延迟而显示成空白。
            </p>
          </div>

          <button
            type="button"
            onClick={() => void handleReset()}
            disabled={resetting}
            className="rounded-full bg-[#1f6b50] px-5 py-3 text-sm font-medium text-white transition hover:bg-[#17563f] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {resetting ? "重置中..." : "重置指标"}
          </button>
        </div>

        {errorText ? (
          <div className="mt-4 rounded-2xl border border-[#efd7d7] bg-[#fff5f5] px-4 py-3 text-sm text-[#a23d3d]">
            {errorText}
          </div>
        ) : null}
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard label="调用总量" value={logsLoading ? "--" : summary.total} />
        <StatCard
          label="成功率"
          value={logsLoading ? "--" : `${(summary.successRate * 100).toFixed(0)}%`}
        />
        <StatCard label="失败次数" value={logsLoading ? "--" : summary.failures} />
        <StatCard
          label="平均延迟"
          value={logsLoading ? "--" : formatDuration(summary.avgDuration)}
        />
        <StatCard label="慢调用 >2s" value={logsLoading ? "--" : summary.slow} />
      </section>

      <section className="rounded-[30px] border border-[#dde8e2] bg-white/88 p-6 shadow-[0_18px_50px_rgba(46,69,58,0.08)]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-[#173127]">性能全景监控</h2>
            <p className="mt-1 text-sm text-[#67766f]">
              延迟、调用量、成功率、失败、慢调用都从同一批日志数据聚合出来。
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <select
              value={operationFilter}
              onChange={(event) => setOperationFilter(event.target.value)}
              className="rounded-full border border-[#d7e6df] bg-white px-4 py-2 text-sm text-[#31584a] outline-none"
            >
              {operationOptions.map((option) => (
                <option key={option} value={option}>
                  {option === "all" ? "全部操作" : option}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as "all" | "success" | "failure")
              }
              className="rounded-full border border-[#d7e6df] bg-white px-4 py-2 text-sm text-[#31584a] outline-none"
            >
              <option value="all">全部状态</option>
              <option value="success">仅成功</option>
              <option value="failure">仅失败</option>
            </select>

            <select
              value={characterFilter}
              onChange={(event) => setCharacterFilter(event.target.value)}
              disabled={charactersLoading && characters.length === 0}
              className="rounded-full border border-[#d7e6df] bg-white px-4 py-2 text-sm text-[#31584a] outline-none disabled:opacity-60"
            >
              <option value="all">全部角色</option>
              {characters.map((character) => (
                <option key={character.id} value={character.id}>
                  {character.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {logsLoading ? (
          <div className="mt-5 flex h-[520px] items-center justify-center rounded-[24px] border border-dashed border-[#dce6df] bg-[#fbfdfc]">
            <div className="text-sm text-[#6d6257]">加载日志中...</div>
          </div>
        ) : !hasLogs ? (
          <div className="mt-5 flex h-[520px] items-center justify-center rounded-[24px] border border-dashed border-[#dce6df] bg-[#fbfdfc]">
            <div className="text-sm text-[#72827b]">当前日志源没有可用数据。</div>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="mt-5 flex h-[520px] items-center justify-center rounded-[24px] border border-dashed border-[#dce6df] bg-[#fbfdfc]">
            <div className="text-sm text-[#72827b]">当前筛选条件下没有可用数据。</div>
          </div>
        ) : (
          <div className="mt-5">
            <ComprehensivePerformanceChart logs={filteredLogs} />
          </div>
        )}
      </section>
    </div>
  );
}
