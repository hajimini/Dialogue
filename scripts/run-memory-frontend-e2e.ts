import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { config as loadEnv } from "dotenv";
import { createClient } from "@supabase/supabase-js";

loadEnv({ path: path.join(process.cwd(), ".env.local"), quiet: true });

const baseUrl = process.env.BATCH_TESTER_BASE_URL || "http://localhost:3000";
const demoUserEmail = process.env.DEMO_USER_EMAIL || "demo@ai-companion.local";
const demoUserPassword = process.env.DEMO_USER_PASSWORD || "demo123456";
const adminEmail = process.env.DEMO_ADMIN_EMAIL || "admin@ai-companion.local";
const adminPassword = process.env.DEMO_ADMIN_PASSWORD || "admin123456";

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !serviceKey) {
  throw new Error("Missing Supabase service credentials for E2E cleanup/verification.");
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

type Persona = { id: string; name: string };
type Character = { id: string; name: string };
type SessionRecord = { id: string; character_id: string | null };
type MemoryRecord = { id: string; content: string; memory_type: string };
type MemoryLog = { id?: string; operation?: string; character_id?: string | null };
type ChatData = {
  reply?: string;
  session_id?: string;
  memory_context?: {
    memories?: Array<{ id?: string; content?: string; memory_type?: string }>;
    user_profile?: string | null;
  };
};
type SnapshotData = {
  total_count?: number;
  memories?: MemoryRecord[];
  profile?: unknown;
  summaries?: Array<{ id: string; summary: string | null }>;
};

class SessionClient {
  private cookie = "";

  async request(pathname: string, init: RequestInit = {}) {
    const response = await fetch(`${baseUrl}${pathname}`, {
      ...init,
      headers: {
        ...(init.headers ?? {}),
        ...(this.cookie ? { cookie: this.cookie } : {}),
      },
    });

    const setCookie = response.headers.get("set-cookie");
    if (setCookie) {
      this.cookie = setCookie.split(";")[0];
    }

    const text = await response.text();
    const json = text ? JSON.parse(text) : null;
    return { response, json };
  }

  async login(email: string, password: string) {
    return this.request("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
  }
}

function stamp() {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(
    now.getHours(),
  )}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

function reportLine(flow: string, pass: boolean, notes: string) {
  return `| ${flow} | ${pass ? "PASS" : "FAIL"} | ${notes} |`;
}

async function wait(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function getCurrentUserId(client: SessionClient) {
  const result = (await client.request("/api/auth/session")).json as
    | { data?: { user?: { id?: string } } }
    | null;

  const userId = result?.data?.user?.id;
  if (!userId) {
    throw new Error("Unable to resolve current user id.");
  }

  return userId;
}

async function getPersonas(client: SessionClient) {
  const result = (await client.request("/api/personas")).json as { data?: Persona[] } | null;
  return Array.isArray(result?.data) ? result.data : [];
}

async function createCharacter(client: SessionClient, name: string) {
  const result = (await client.request("/api/characters", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name,
      bio: "Temporary memory E2E validation character.",
      personality: "Validation profile only.",
    }),
  })).json as
    | {
        success?: boolean;
        data?: { character?: Character };
        error?: { message?: string };
      }
    | null;

  const character = result?.data?.character;
  if (!result?.success || !character) {
    throw new Error(result?.error?.message || `Failed to create character ${name}.`);
  }

  return character;
}

async function createSession(client: SessionClient, personaId: string, characterId: string) {
  const result = (await client.request(`/api/personas/${personaId}/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ character_id: characterId }),
  })).json as
    | { success?: boolean; data?: SessionRecord; error?: { message?: string } }
    | null;

  if (!result?.success || !result.data?.id) {
    throw new Error(result?.error?.message || "Failed to create session.");
  }

  return result.data;
}

async function sendChat(
  client: SessionClient,
  personaId: string,
  sessionId: string,
  message: string,
) {
  const result = (await client.request("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      persona_id: personaId,
      session_id: sessionId,
      message,
    }),
  })).json as
    | { success?: boolean; data?: ChatData; error?: { message?: string } }
    | null;

  if (!result?.success || !result.data) {
    throw new Error(result?.error?.message || "Chat request failed.");
  }

  return result.data;
}

async function createAdminMemory(
  admin: SessionClient,
  params: {
    userId: string;
    personaId: string;
    characterId: string;
    content: string;
  },
) {
  const result = (await admin.request("/api/admin/memories", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId: params.userId,
      personaId: params.personaId,
      characterId: params.characterId,
      memoryType: "user_fact",
      content: params.content,
      importance: 0.9,
    }),
  })).json as
    | { success?: boolean; data?: { id?: string }; error?: { message?: string } }
    | null;

  if (!result?.success || !result.data?.id) {
    throw new Error(result?.error?.message || "Failed to create admin memory.");
  }

  return result.data.id;
}

async function listMemories(
  client: SessionClient,
  personaId: string,
  characterId: string,
  q?: string,
) {
  const search = new URLSearchParams({
    persona_id: personaId,
    character_id: characterId,
    limit: "100",
    offset: "0",
  });
  if (q) {
    search.set("q", q);
  }

  const result = (await client.request(`/api/memories?${search.toString()}`)).json as
    | {
        success?: boolean;
        data?: { memories?: MemoryRecord[]; total_count?: number };
        error?: { message?: string };
      }
    | null;

  if (!result?.success || !result.data) {
    throw new Error(result?.error?.message || "Failed to list memories.");
  }

  return {
    memories: Array.isArray(result.data.memories) ? result.data.memories : [],
    totalCount: result.data.total_count ?? 0,
  };
}

async function adminSearch(
  admin: SessionClient,
  params: { userId: string; personaId: string; characterId: string; query: string },
) {
  const result = (await admin.request("/api/admin/memories/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      user_id: params.userId,
      persona_id: params.personaId,
      character_id: params.characterId,
      query: params.query,
      limit: 10,
    }),
  })).json as
    | {
        success?: boolean;
        data?: {
          memories?: Array<{ memory?: { id?: string; content?: string; memory_type?: string } }>;
        };
        error?: { message?: string };
      }
    | null;

  if (!result?.success) {
    throw new Error(result?.error?.message || "Failed to run admin search.");
  }

  return Array.isArray(result.data?.memories) ? result.data.memories : [];
}

async function adminSnapshot(
  admin: SessionClient,
  params: { userId: string; personaId: string; characterId: string; q?: string },
) {
  const search = new URLSearchParams({
    userId: params.userId,
    personaId: params.personaId,
    characterId: params.characterId,
    limit: "100",
    offset: "0",
  });
  if (params.q) {
    search.set("q", params.q);
  }

  const result = (await admin.request(`/api/admin/memories?${search.toString()}`)).json as
    | { success?: boolean; data?: SnapshotData; error?: { message?: string } }
    | null;

  if (!result?.success || !result.data) {
    throw new Error(result?.error?.message || "Failed to load admin snapshot.");
  }

  return result.data;
}

async function importTranscript(
  client: SessionClient,
  params: { personaId: string; characterId: string; personaName: string; transcript: string },
) {
  const formData = new FormData();
  formData.append("personaId", params.personaId);
  formData.append("characterId", params.characterId);
  formData.append("personaName", params.personaName);
  formData.append(
    "file",
    new File([params.transcript], "memory-e2e-import.txt", { type: "text/plain" }),
  );

  const result = (await client.request("/api/chat/import", {
    method: "POST",
    body: formData,
  })).json as
    | {
        success?: boolean;
        data?: { session_id?: string; message_count?: number };
        error?: { message?: string };
      }
    | null;

  if (!result?.success || !result.data?.session_id) {
    throw new Error(result?.error?.message || "Import failed.");
  }

  return result.data;
}

async function fetchLogs(admin: SessionClient, characterId: string) {
  const result = (await admin.request(
    `/api/admin/memory-logs?character_id=${encodeURIComponent(characterId)}&limit=50`,
  )).json as
    | { success?: boolean; data?: { logs?: MemoryLog[]; total_count?: number }; error?: { message?: string } }
    | null;

  if (!result?.success || !result.data) {
    throw new Error(result?.error?.message || "Failed to load admin memory logs.");
  }

  return {
    logs: Array.isArray(result.data.logs) ? result.data.logs : [],
    totalCount: result.data.total_count ?? 0,
  };
}

async function fetchMessages(sessionId: string) {
  const { data, error } = await supabase
    .from("messages")
    .select("id,role,content")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

async function fetchSession(sessionId: string) {
  const { data, error } = await supabase
    .from("sessions")
    .select("id,character_id,summary")
    .eq("id", sessionId)
    .single();

  if (error || !data) {
    throw new Error(error?.message || `Failed to load session ${sessionId}.`);
  }

  return data;
}

async function cleanup(params: { characterIds: string[]; sessionIds: string[] }) {
  const characterIds = [...new Set(params.characterIds.filter(Boolean))];
  const sessionIds = [...new Set(params.sessionIds.filter(Boolean))];

  if (sessionIds.length > 0) {
    await supabase.from("messages").delete().in("session_id", sessionIds);
    await supabase.from("sessions").delete().in("id", sessionIds);
  }

  if (characterIds.length > 0) {
    await supabase.from("memories").delete().in("character_id", characterIds);
    await supabase.from("user_profiles_per_persona").delete().in("character_id", characterIds);
    await supabase.from("user_characters").delete().in("id", characterIds);
  }
}

async function main() {
  const reportLines = [
    "# Memory Frontend E2E",
    "",
    `- Generated at: ${new Date().toISOString()}`,
    `- Base URL: ${baseUrl}`,
    "",
    "| Flow | Result | Notes |",
    "| --- | --- | --- |",
  ];

  const anonymous = new SessionClient();
  const user = new SessionClient();
  const admin = new SessionClient();

  const characterIds: string[] = [];
  const sessionIds: string[] = [];

  try {
    const anonMemories = await anonymous.request("/api/memories");
    reportLines.push(
      reportLine(
        "unauthenticated /api/memories",
        anonMemories.response.status === 401,
        `status=${anonMemories.response.status}`,
      ),
    );

    const [userLogin, adminLogin] = await Promise.all([
      user.login(demoUserEmail, demoUserPassword),
      admin.login(adminEmail, adminPassword),
    ]);

    reportLines.push(
      reportLine("user login", Boolean(userLogin.json?.success), userLogin.json?.error?.message ?? "ok"),
    );
    reportLines.push(
      reportLine(
        "admin login",
        Boolean(adminLogin.json?.success),
        adminLogin.json?.error?.message ?? "ok",
      ),
    );

    if (!userLogin.json?.success || !adminLogin.json?.success) {
      throw new Error("User or admin login failed.");
    }

    const userId = await getCurrentUserId(user);
    const personas = await getPersonas(user);
    const persona = personas[0];
    if (!persona) {
      throw new Error("No active persona available.");
    }

    const suffix = Date.now().toString(36);
    const characterA = await createCharacter(user, `memory-e2e-a-${suffix}`);
    const characterB = await createCharacter(user, `memory-e2e-b-${suffix}`);
    characterIds.push(characterA.id, characterB.id);
    reportLines.push(
      reportLine("character create", true, `${characterA.name}, ${characterB.name}`),
    );

    const sessionA = await createSession(user, persona.id, characterA.id);
    const sessionB = await createSession(user, persona.id, characterB.id);
    sessionIds.push(sessionA.id, sessionB.id);
    reportLines.push(
      reportLine(
        "session create + bind role",
        sessionA.character_id === characterA.id && sessionB.character_id === characterB.id,
        `sessionA=${sessionA.id} sessionB=${sessionB.id}`,
      ),
    );

    const chatMarker = `memory-e2e-chat-${suffix}`;
    await sendChat(user, persona.id, sessionA.id, `记住这次验证标记：${chatMarker}`);
    const sessionRow = await fetchSession(sessionA.id);
    const messages = await fetchMessages(sessionA.id);
    reportLines.push(
      reportLine(
        "chat -> backend/db",
        sessionRow.character_id === characterA.id && messages.length >= 2,
        `messages=${messages.length} character_id=${sessionRow.character_id}`,
      ),
    );

    const adminMemoryMarker = `memory-e2e-admin-${suffix}`;
    const memoryId = await createAdminMemory(admin, {
      userId,
      personaId: persona.id,
      characterId: characterA.id,
      content: `用户在验证中提到 ${adminMemoryMarker}`,
    });
    const memoryListA = await listMemories(user, persona.id, characterA.id, adminMemoryMarker);
    const memoryListB = await listMemories(user, persona.id, characterB.id, adminMemoryMarker);
    reportLines.push(
      reportLine(
        "admin create memory -> list by character",
        memoryListA.memories.some((item) => item.id === memoryId) && memoryListB.memories.length === 0,
        `A=${memoryListA.memories.length} B=${memoryListB.memories.length}`,
      ),
    );

    const searchA = await adminSearch(admin, {
      userId,
      personaId: persona.id,
      characterId: characterA.id,
      query: adminMemoryMarker,
    });
    const searchB = await adminSearch(admin, {
      userId,
      personaId: persona.id,
      characterId: characterB.id,
      query: adminMemoryMarker,
    });
    reportLines.push(
      reportLine(
        "admin search by character_id",
        searchA.some((item) => item.memory?.id === memoryId) && searchB.length === 0,
        `A=${searchA.length} B=${searchB.length}`,
      ),
    );

    const importMarker = `meteor-orchid-${suffix}`;
    const imported = await importTranscript(user, {
      personaId: persona.id,
      characterId: characterA.id,
      personaName: persona.name,
      transcript: [
        `09:00 Tester My favorite flower is ${importMarker}`,
        `09:01 ${persona.name} Got it, ${importMarker} is your favorite flower`,
        `09:02 Tester I usually walk by the seaside on weekends ${importMarker}`,
        `09:03 ${persona.name} Weekend seaside walks ${importMarker} sound relaxing`,
      ].join("\n"),
    });
    sessionIds.push(imported.session_id!);

    let importedMemories = await listMemories(user, persona.id, characterA.id, importMarker);
    let snapshot = await adminSnapshot(admin, {
      userId,
      personaId: persona.id,
      characterId: characterA.id,
      q: importMarker,
    });

    for (let attempt = 0; attempt < 5; attempt += 1) {
      if (importedMemories.memories.length > 0) break;
      await wait(1500);
      importedMemories = await listMemories(user, persona.id, characterA.id, importMarker);
      snapshot = await adminSnapshot(admin, {
        userId,
        personaId: persona.id,
        characterId: characterA.id,
        q: importMarker,
      });
    }

    reportLines.push(
      reportLine(
        "transcript import -> immediate memory rows",
        importedMemories.memories.length > 0,
        `session=${imported.session_id} marker_hits=${importedMemories.memories.length}`,
      ),
    );

    const firstRecall = await sendChat(
      user,
      persona.id,
      imported.session_id!,
      "What is my favorite flower? Reply with the flower name only.",
    );
    const firstRecallHit = (firstRecall.memory_context?.memories ?? []).some((item) =>
      item.content?.includes(importMarker),
    );
    reportLines.push(
      reportLine(
        "first post-import recall",
        firstRecallHit,
        `memory_context=${(firstRecall.memory_context?.memories ?? []).length}`,
      ),
    );

    let enrichedSnapshot = snapshot;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const hasSummary = (enrichedSnapshot.summaries ?? []).some(
        (item) => item.id === imported.session_id && Boolean(item.summary),
      );
      if (hasSummary && enrichedSnapshot.profile) break;
      await wait(2000);
      enrichedSnapshot = await adminSnapshot(admin, {
        userId,
        personaId: persona.id,
        characterId: characterA.id,
        q: importMarker,
      });
    }

    const importedSummary = (enrichedSnapshot.summaries ?? []).find(
      (item) => item.id === imported.session_id,
    );
    reportLines.push(
      reportLine(
        "profile + session summary visible",
        Boolean(enrichedSnapshot.profile) && Boolean(importedSummary?.summary),
        `profile=${enrichedSnapshot.profile ? "yes" : "no"} summary=${importedSummary?.summary ? "yes" : "no"}`,
      ),
    );

    const logsA = await fetchLogs(admin, characterA.id);
    const logsFiltered = logsA.logs.length > 0 && logsA.logs.every((log) => log.character_id === characterA.id);
    reportLines.push(
      reportLine(
        "admin logs by character_id",
        logsFiltered,
        `logs=${logsA.logs.length} total=${logsA.totalCount}`,
      ),
    );

    const importedForB = await listMemories(user, persona.id, characterB.id, importMarker);
    const searchImportedB = await adminSearch(admin, {
      userId,
      personaId: persona.id,
      characterId: characterB.id,
      query: importMarker,
    });
    reportLines.push(
      reportLine(
        "character isolation",
        importedForB.memories.length === 0 && searchImportedB.length === 0,
        `memoriesB=${importedForB.memories.length} searchB=${searchImportedB.length}`,
      ),
    );

    const outputDir = path.join(process.cwd(), "docs", "validation-reports");
    await mkdir(outputDir, { recursive: true });
    const outputPath = path.join(outputDir, `memory-frontend-e2e-${stamp()}.md`);
    await writeFile(outputPath, `${reportLines.join("\n")}\n`, "utf8");
    console.log(`E2E report written to ${path.relative(process.cwd(), outputPath)}`);
    reportLines
      .filter((item) => item.startsWith("|") && !item.includes("---"))
      .forEach((item) => console.log(item));

    if (reportLines.some((item) => item.includes("| FAIL |"))) {
      process.exit(1);
    }
  } finally {
    await cleanup({ characterIds, sessionIds }).catch(() => undefined);
  }
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
