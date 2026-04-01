import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { config as loadEnv } from "dotenv";
import { getMemoryGateway, resetMemoryGateway } from "../src/lib/memory/factory";
import { memoryMetrics } from "../src/lib/memory/metrics";
import { getOrCreateDemoUserId, getSupabaseAdminClient } from "../src/lib/supabase/admin";
import type { Persona, SessionRecord } from "../src/lib/supabase/types";

loadEnv({ path: path.join(process.cwd(), ".env.local") });

type BatchTestCase = {
  id: string;
  category: string;
  input: string;
  setup_messages?: string[];
};

const OUTPUT_DIR = path.join(process.cwd(), "docs", "perf-reports");
const SOURCE_PERSONA_ID = process.env.BATCH_TESTER_PERSONA_ID || "e92e08d8-a25e-4a56-a439-60d71b0e4e69";
const SEQUENTIAL_CASE_IDS = ["C01", "C03", "C09", "C10"];
const CONCURRENT_CASE_IDS = ["C01", "C03", "C06", "C09", "C10"];

function timestampParts() {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return {
    iso: now.toISOString(),
    file: `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(
      now.getHours(),
    )}${pad(now.getMinutes())}${pad(now.getSeconds())}`,
  };
}

function average(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function formatNumber(value: number | null | undefined, digits = 2) {
  return typeof value === "number" && Number.isFinite(value) ? value.toFixed(digits) : "-";
}

function escapeCell(value: string) {
  return value.replace(/\|/g, "\\|").replace(/\n/g, "<br>");
}

function uniqueStrings(items: Array<string | null | undefined>) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of items) {
    const normalized = item?.trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }
  return result;
}

function extractAnchors(...texts: string[]) {
  const phrases = texts
    .flatMap((text) => text.match(/[\u4e00-\u9fa5A-Za-z0-9]{2,8}/g) ?? [])
    .map((item) => item.trim());
  return uniqueStrings(phrases).slice(0, 8);
}

function buildMetricRow(name: string, stats: Record<string, number> | null, targetMs?: number) {
  const verdict =
    targetMs == null
      ? "-"
      : stats && stats.mean < targetMs && stats.p95 < targetMs
        ? "PASS"
        : "FAIL";

  return `| ${name} | ${stats?.count ?? 0} | ${formatNumber(stats?.mean)} | ${formatNumber(
    stats?.p95,
  )} | ${formatNumber(stats?.max)} | ${targetMs ? `< ${targetMs}ms` : "-"} | ${verdict} |`;
}

async function loadCases() {
  const raw = await readFile(path.join(process.cwd(), "docs", "TEST_CASES.json"), "utf8");
  const data = JSON.parse(raw) as { cases?: BatchTestCase[] };
  return (data.cases ?? []).filter((item) => item.category === "C");
}

async function createTempPersona() {
  const supabase = getSupabaseAdminClient();
  const { data: sourcePersona, error } = await supabase
    .from("personas")
    .select("*")
    .eq("id", SOURCE_PERSONA_ID)
    .single();

  if (error || !sourcePersona) {
    throw new Error(error?.message || "Failed to load source persona");
  }

  const insertedPayload = {
    ...sourcePersona,
    id: crypto.randomUUID(),
    name: `${sourcePersona.name} Perf`,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { data: insertedPersona, error: insertError } = await supabase
    .from("personas")
    .insert(insertedPayload)
    .select("*")
    .single();

  if (insertError || !insertedPersona) {
    throw new Error(insertError?.message || "Failed to create temporary persona");
  }

  return insertedPersona as Persona;
}

async function createTestCharacter(userId: string) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("user_characters")
    .insert({
      owner_id: userId,
      name: "性能测试角色",
      personality: "测试用虚拟角色",
      is_active: true,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Failed to create test character");
  }

  return data.id as string;
}

async function createSession(userId: string, personaId: string, summary: string, topics: string[]) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("sessions")
    .insert({
      user_id: userId,
      persona_id: personaId,
      status: "active",
      summary,
      topics,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Failed to create temporary session");
  }

  return data as SessionRecord;
}

async function seedCaseContext(
  persona: Persona,
  testCase: BatchTestCase,
  demoUserId: string,
  testCharacterId: string,
) {
  const gateway = getMemoryGateway();
  const setupMessages = testCase.setup_messages ?? [];
  const topicSeed = setupMessages[0] || testCase.input;
  const topics = uniqueStrings([topicSeed]).slice(0, 3);
  const anchors = extractAnchors(...setupMessages, testCase.input);
  const session = await createSession(
    demoUserId,
    persona.id,
    topicSeed,
    topics,
  );

  await gateway.saveSessionMemories({
    userId: demoUserId,
    personaId: persona.id,
    characterId: testCharacterId,
    sessionId: session.id,
    topics,
    summary: topicSeed,
    memories: uniqueStrings(setupMessages).map((content) => ({
      memory_type: "shared_event" as const,
      content,
      importance: 0.8,
    })),
    profile: {
      summary: `与${persona.name}聊过${topics.join("、")}`,
      facts: uniqueStrings(setupMessages),
      preferences: [],
      relationship_notes: [`已经和${persona.name}聊过相关旧话题`],
      recent_topics: topics,
      anchors,
      relationship_stage: "warming",
      total_messages: setupMessages.length + 1,
    },
  });
}

async function cleanupTempData(personaId: string, characterId?: string) {
  const supabase = getSupabaseAdminClient();
  await supabase.from("messages").delete().in(
    "session_id",
    (
      await supabase.from("sessions").select("id").eq("persona_id", personaId)
    ).data?.map((item) => item.id) ?? [],
  );
  await supabase.from("memories").delete().eq("persona_id", personaId);
  await supabase.from("user_profiles_per_persona").delete().eq("persona_id", personaId);
  await supabase.from("sessions").delete().eq("persona_id", personaId);
  await supabase.from("personas").delete().eq("id", personaId);
  if (characterId) {
    await supabase.from("user_characters").delete().eq("id", characterId);
  }
}

async function runQueries(persona: Persona, cases: BatchTestCase[], demoUserId: string, testCharacterId: string) {
  const gateway = getMemoryGateway();
  const results: Array<{ id: string; input: string; durationMs: number; memoryCount: number }> = [];

  for (const testCase of cases) {
    const startedAt = Date.now();
    const context = await gateway.getMemoryContext({
      userId: demoUserId,
      personaId: persona.id,
      characterId: testCharacterId,
      persona,
      query: testCase.input,
      limit: 5,
    });
    results.push({
      id: testCase.id,
      input: testCase.input,
      durationMs: Date.now() - startedAt,
      memoryCount: context.relevantMemories.length,
    });
  }

  return results;
}

async function runQueriesConcurrently(persona: Persona, cases: BatchTestCase[], demoUserId: string, testCharacterId: string) {
  const gateway = getMemoryGateway();
  const startedAt = Date.now();
  const results = await Promise.all(
    cases.map(async (testCase) => {
      const caseStartedAt = Date.now();
      const context = await gateway.getMemoryContext({
        userId: demoUserId,
        personaId: persona.id,
        characterId: testCharacterId,
        persona,
        query: testCase.input,
        limit: 5,
      });

      return {
        id: testCase.id,
        input: testCase.input,
        durationMs: Date.now() - caseStartedAt,
        memoryCount: context.relevantMemories.length,
      };
    }),
  );

  return {
    wallTimeMs: Date.now() - startedAt,
    results,
  };
}

async function main() {
  const { iso, file } = timestampParts();
  const allCases = await loadCases();
  const caseMap = new Map(allCases.map((item) => [item.id, item]));
  const sequentialCases = SEQUENTIAL_CASE_IDS.map((id) => caseMap.get(id)).filter(Boolean) as BatchTestCase[];
  const concurrentCases = CONCURRENT_CASE_IDS.map((id) => caseMap.get(id)).filter(Boolean) as BatchTestCase[];
  const persona = await createTempPersona();
  const demoUserId = await getOrCreateDemoUserId();
  const testCharacterId = await createTestCharacter(demoUserId);

  try {
    resetMemoryGateway();
    memoryMetrics.reset();

    for (const testCase of allCases) {
      await seedCaseContext(persona, testCase, demoUserId, testCharacterId);
    }

    memoryMetrics.reset();
    const sequentialResults = await runQueries(persona, sequentialCases, demoUserId, testCharacterId);
    const sequentialMetrics = memoryMetrics.getAllStats();

    memoryMetrics.reset();
    const concurrent = await runQueriesConcurrently(persona, concurrentCases, demoUserId, testCharacterId);
    const concurrentMetrics = memoryMetrics.getAllStats();

    const lines = [
      "# Memory Performance Report",
      "",
      `- Generated at: ${iso}`,
      `- Source persona: ${SOURCE_PERSONA_ID}`,
      `- Temporary persona: ${persona.id}`,
      `- Embedding provider: ${process.env.EMBEDDING_PROVIDER || "openai"} (${process.env.EMBEDDING_MODEL || "text-embedding-3-large"})`,
      `- Reranker provider: ${process.env.RERANKER_PROVIDER || "jina"}`,
      `- External embedding key configured: ${process.env.EMBEDDING_API_KEY || process.env.OPENAI_API_KEY || process.env.NVIDIA_API_KEY ? "yes" : "no (fallback active)"}`,
      `- External reranker key configured: ${process.env.RERANKER_API_KEY ? "yes" : "no (fallback/original order)"}`,
      "",
      "## Sequential Core Metrics",
      "",
      "| Metric | Count | Mean (ms) | P95 (ms) | Max (ms) | Target | Verdict |",
      "| --- | ---: | ---: | ---: | ---: | --- | --- |",
      buildMetricRow("memory.search.duration", sequentialMetrics["memory.search.duration"] || null, 2000),
      buildMetricRow("memory.getContext.duration", sequentialMetrics["memory.getContext.duration"] || null, 2000),
      buildMetricRow("embedding.duration", sequentialMetrics["embedding.duration"] || null),
      buildMetricRow("reranker.duration", sequentialMetrics["reranker.duration"] || null),
      "",
      "## Sequential Samples",
      "",
      "| Case | Input | Duration (ms) | Retrieved Memories |",
      "| --- | --- | ---: | ---: |",
      ...sequentialResults.map(
        (item) =>
          `| ${item.id} | ${escapeCell(item.input)} | ${item.durationMs} | ${item.memoryCount} |`,
      ),
      "",
      "## Concurrency",
      "",
      `- Concurrent requests: ${concurrent.results.length}`,
      `- Wall time: ${concurrent.wallTimeMs}ms`,
      `- Average client duration: ${formatNumber(
        average(concurrent.results.map((item) => item.durationMs)),
      )}ms`,
      "",
      "| Metric | Count | Mean (ms) | P95 (ms) | Max (ms) | Target | Verdict |",
      "| --- | ---: | ---: | ---: | ---: | --- | --- |",
      buildMetricRow("memory.search.duration", concurrentMetrics["memory.search.duration"] || null, 2000),
      buildMetricRow(
        "memory.getContext.duration",
        concurrentMetrics["memory.getContext.duration"] || null,
        2000,
      ),
      buildMetricRow("embedding.duration", concurrentMetrics["embedding.duration"] || null),
      buildMetricRow("reranker.duration", concurrentMetrics["reranker.duration"] || null),
      "",
      "| Case | Input | Duration (ms) | Retrieved Memories |",
      "| --- | --- | ---: | ---: |",
      ...concurrent.results.map(
        (item) =>
          `| ${item.id} | ${escapeCell(item.input)} | ${item.durationMs} | ${item.memoryCount} |`,
      ),
      "",
      "## Verdict",
      "",
      `- Memory retrieval target (<2s): ${
        sequentialMetrics["memory.getContext.duration"] &&
        sequentialMetrics["memory.getContext.duration"].mean < 2000 &&
        sequentialMetrics["memory.getContext.duration"].p95 < 2000
          ? "PASS"
          : "FAIL"
      }`,
      `- Embedding latency interpretation: ${
        process.env.EMBEDDING_API_KEY || process.env.OPENAI_API_KEY || process.env.NVIDIA_API_KEY
          ? "Measured against external embedding provider."
          : "Measured in fallback mode because no external embedding API key is configured."
      }`,
      `- Reranker latency interpretation: ${
        process.env.RERANKER_API_KEY
          ? "Measured against external reranker."
          : "Measured in fallback/original-order mode because no reranker API key is configured."
      }`,
      "",
    ];

    await mkdir(OUTPUT_DIR, { recursive: true });
    const outputPath = path.join(OUTPUT_DIR, `memory-performance-${file}.md`);
    await writeFile(outputPath, `${lines.join("\n")}\n`, "utf8");

    console.log(`Performance report written to ${path.relative(process.cwd(), outputPath)}`);
    console.log(
      `- memory.getContext mean=${formatNumber(
        sequentialMetrics["memory.getContext.duration"]?.mean,
      )}ms`,
    );
    console.log(
      `- memory.getContext p95=${formatNumber(
        sequentialMetrics["memory.getContext.duration"]?.p95,
      )}ms`,
    );
    console.log(
      `- embedding mean=${formatNumber(sequentialMetrics["embedding.duration"]?.mean)}ms`,
    );
    console.log(
      `- reranker mean=${formatNumber(sequentialMetrics["reranker.duration"]?.mean)}ms`,
    );
    console.log(`- concurrent wall time=${concurrent.wallTimeMs}ms`);
  } finally {
    await cleanupTempData(persona.id, testCharacterId).catch(() => undefined);
  }
}

void main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Performance test failed: ${message}`);
  process.exit(1);
});
