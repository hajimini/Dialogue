import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { config as loadEnv } from "dotenv";
import { clearMemoryRuntimeConfigOverrides, setMemoryRuntimeConfigOverrides } from "../src/lib/memory/config";
import { resetMemoryGateway } from "../src/lib/memory/factory";
import { memoryContextCache } from "../src/lib/memory/memory-context-cache";
import { getMemoryContext } from "../src/lib/memory/retriever";
import { getOrCreateDemoUserId, getSupabaseAdminClient } from "../src/lib/supabase/admin";
import type { Persona, SessionRecord } from "../src/lib/supabase/types";
import { getMemoryGateway } from "../src/lib/memory/factory";

loadEnv({ path: path.join(process.cwd(), ".env.local") });

const COUNTS = Array.from({ length: 12 }, (_, index) => index + 5);
const OUTPUT_DIR = path.join(process.cwd(), "docs", "perf-reports");

function fileStamp() {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(
    now.getHours(),
  )}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

function average(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

async function createTempPersona() {
  const supabase = getSupabaseAdminClient();
  const { data: sourcePersona, error } = await supabase
    .from("personas")
    .select("*")
    .eq("is_active", true)
    .limit(1)
    .single();

  if (error || !sourcePersona) {
    throw new Error(error?.message || "Failed to load source persona");
  }

  const { data: inserted, error: insertError } = await supabase
    .from("personas")
    .insert({
      ...sourcePersona,
      id: crypto.randomUUID(),
      name: `${sourcePersona.name} Cache`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (insertError || !inserted) {
    throw new Error(insertError?.message || "Failed to create temp persona");
  }

  return inserted as Persona;
}

async function createTestCharacter(userId: string) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("user_characters")
    .insert({
      owner_id: userId,
      name: "缓存测试角色",
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

async function createSession(userId: string, personaId: string) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("sessions")
    .insert({
      user_id: userId,
      persona_id: personaId,
      status: "active",
      summary: "缓存性能测试会话",
      topics: ["记忆缓存", "连续对话"],
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Failed to create temp session");
  }

  return data as SessionRecord;
}

async function seedContext(persona: Persona, demoUserId: string, testCharacterId: string) {
  const gateway = getMemoryGateway();
  const session = await createSession(demoUserId, persona.id);

  await gateway.saveSessionMemories({
    userId: demoUserId,
    personaId: persona.id,
    characterId: testCharacterId,
    sessionId: session.id,
    topics: ["面试", "展览"],
    summary: "用户最近在聊面试和展览",
    memories: [
      {
        memory_type: "shared_event",
        content: "用户前几天提过一个面试结果还没出来。",
        importance: 0.9,
      },
      {
        memory_type: "shared_event",
        content: "用户昨天提到去看了一个展，说想下次再去。",
        importance: 0.85,
      },
    ],
    profile: {
      summary: "最近在准备面试，也聊到去看展。",
      facts: ["最近在等面试结果"],
      preferences: ["喜欢展览"],
      relationship_notes: ["适合直接承接旧话题"],
      recent_topics: ["面试", "展览"],
      anchors: ["那个面试", "那个展"],
      relationship_stage: "warming",
      total_messages: 12,
    },
  });

  return session;
}

async function cleanupTempData(personaId: string, characterId?: string) {
  const supabase = getSupabaseAdminClient();
  const { data: sessions } = await supabase.from("sessions").select("id").eq("persona_id", personaId);
  const sessionIds = sessions?.map((item) => item.id) ?? [];
  if (sessionIds.length > 0) {
    await supabase.from("messages").delete().in("session_id", sessionIds);
  }
  await supabase.from("memory_feedback").delete().in("memory_id", []);
  await supabase.from("memories").delete().eq("persona_id", personaId);
  await supabase.from("user_profiles_per_persona").delete().eq("persona_id", personaId);
  await supabase.from("sessions").delete().eq("persona_id", personaId);
  await supabase.from("personas").delete().eq("id", personaId);
  if (characterId) {
    await supabase.from("user_characters").delete().eq("id", characterId);
  }
}

async function runScenario(persona: Persona, sessionId: string, useCache: boolean, demoUserId: string, testCharacterId: string) {
  setMemoryRuntimeConfigOverrides({
    MEMORY_CONTEXT_CACHE_ENABLED: useCache ? "true" : "false",
  });
  resetMemoryGateway();
  memoryContextCache.clear();

  let hits = 0;
  let misses = 0;
  const durations: number[] = [];

  for (const count of COUNTS) {
    const startedAt = Date.now();
    const cached = memoryContextCache.get(sessionId, count);

    if (cached) {
      hits += 1;
      durations.push(Date.now() - startedAt);
      continue;
    }

    misses += 1;
    const context = await getMemoryContext({
      userId: demoUserId,
      personaId: persona.id,
      characterId: testCharacterId,
      persona,
      query: count % 2 === 0 ? "那个面试后来怎么样" : "我今天又想到那个展了",
      limit: 5,
    });

    memoryContextCache.set({
      sessionId,
      messageCount: count,
      userId: demoUserId,
      personaId: persona.id,
      characterId: testCharacterId,
      context,
    });
    durations.push(Date.now() - startedAt);
  }

  return {
    useCache,
    hits,
    misses,
    hitRate: hits / COUNTS.length,
    meanDuration: average(durations),
    totalDuration: durations.reduce((sum, value) => sum + value, 0),
    durations,
  };
}

async function main() {
  const persona = await createTempPersona();
  const demoUserId = await getOrCreateDemoUserId();
  const testCharacterId = await createTestCharacter(demoUserId);

  try {
    const session = await seedContext(persona, demoUserId, testCharacterId);
    const withoutCache = await runScenario(persona, session.id, false, demoUserId, testCharacterId);
    const withCache = await runScenario(persona, session.id, true, demoUserId, testCharacterId);

    await mkdir(OUTPUT_DIR, { recursive: true });
    const outputPath = path.join(OUTPUT_DIR, `memory-cache-${fileStamp()}.md`);
    const lines = [
      "# Memory Cache Validation",
      "",
      `- Generated at: ${new Date().toISOString()}`,
      `- Persona: ${persona.name} (${persona.id})`,
      `- Session: ${session.id}`,
      "",
      "| Scenario | Hits | Misses | Hit Rate | Mean Duration (ms) | Total Duration (ms) |",
      "| --- | ---: | ---: | ---: | ---: | ---: |",
      `| cache off | ${withoutCache.hits} | ${withoutCache.misses} | ${withoutCache.hitRate.toFixed(
        2,
      )} | ${withoutCache.meanDuration.toFixed(2)} | ${withoutCache.totalDuration.toFixed(2)} |`,
      `| cache on | ${withCache.hits} | ${withCache.misses} | ${withCache.hitRate.toFixed(2)} | ${withCache.meanDuration.toFixed(
        2,
      )} | ${withCache.totalDuration.toFixed(2)} |`,
      "",
      `- Hit rate target (> 0.50): ${withCache.hitRate > 0.5 ? "PASS" : "FAIL"}`,
      `- Performance target (cache on faster than cache off): ${
        withCache.totalDuration < withoutCache.totalDuration ? "PASS" : "FAIL"
      }`,
      "",
    ];
    await writeFile(outputPath, `${lines.join("\n")}\n`, "utf8");

    console.log(`Cache validation report written to ${path.relative(process.cwd(), outputPath)}`);
    console.log(
      `- cache off: mean=${withoutCache.meanDuration.toFixed(2)}ms total=${withoutCache.totalDuration.toFixed(2)}ms`,
    );
    console.log(
      `- cache on: mean=${withCache.meanDuration.toFixed(2)}ms total=${withCache.totalDuration.toFixed(2)}ms hitRate=${withCache.hitRate.toFixed(2)}`,
    );

    if (!(withCache.hitRate > 0.5) || !(withCache.totalDuration < withoutCache.totalDuration)) {
      process.exit(1);
    }
  } finally {
    clearMemoryRuntimeConfigOverrides();
    memoryContextCache.clear();
    await cleanupTempData(persona.id, testCharacterId).catch(() => undefined);
  }
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
