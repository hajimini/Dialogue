import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { config as loadEnv } from "dotenv";

loadEnv({ path: path.join(process.cwd(), ".env.local") });

const BASE_URL = process.env.BATCH_TESTER_BASE_URL || "http://localhost:3000";
const USER_EMAIL = process.env.DEMO_USER_EMAIL || "demo@ai-companion.local";
const USER_PASSWORD = process.env.DEMO_USER_PASSWORD || "demo123456";
const ADMIN_EMAIL = process.env.DEMO_ADMIN_EMAIL || "admin@ai-companion.local";
const ADMIN_PASSWORD = process.env.DEMO_ADMIN_PASSWORD || "admin123456";

type Persona = { id: string; name: string };
type Character = { id: string; name: string };
type Memory = { id: string; content: string; memory_type: string };

type MemoryListResult = {
  total: number;
  memories: Memory[];
};

type AdminSnapshotResult = {
  total: number;
  memories: Memory[];
  profile: unknown;
  summaries: Array<{ id: string; summary: string | null }>;
};

class SessionClient {
  private cookie = "";

  async request(pathname: string, init: RequestInit = {}) {
    const response = await fetch(`${BASE_URL}${pathname}`, {
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
    let json: unknown = null;
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }

    return { response, text, json };
  }

  async login(email: string, password: string) {
    return this.request("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
  }
}

function nowStamp() {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(
    now.getHours(),
  )}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

async function wait(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function asMarkdownJson(value: unknown) {
  return `\`\`\`json
${JSON.stringify(value, null, 2)}
\`\`\``;
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
  const result = (await client.request("/api/personas")).json as
    | { data?: Persona[] }
    | null;
  const personas = Array.isArray(result?.data) ? result.data : [];

  if (personas.length === 0) {
    throw new Error("No active personas found.");
  }

  return personas;
}

async function getCharacters(client: SessionClient) {
  const result = (await client.request("/api/characters")).json as
    | { data?: { characters?: Character[] } }
    | null;
  return Array.isArray(result?.data?.characters) ? result.data.characters : [];
}

async function createCharacter(client: SessionClient, name: string) {
  const result = (await client.request("/api/characters", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name,
      bio: "Temporary validation character for import-memory flow.",
      personality: "Controlled validation profile.",
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
    throw new Error(result?.error?.message || "Failed to create test character.");
  }

  return character;
}

async function listMemories(
  client: SessionClient,
  personaId: string,
  characterId: string,
  q?: string,
): Promise<MemoryListResult> {
  const params = new URLSearchParams({
    persona_id: personaId,
    character_id: characterId,
    limit: "200",
    offset: "0",
  });
  if (q) {
    params.set("q", q);
  }

  const result = (await client.request(`/api/memories?${params.toString()}`)).json as
    | {
        success?: boolean;
        data?: { memories?: Memory[]; total_count?: number };
        error?: { message?: string };
      }
    | null;

  if (!result?.success || !result.data) {
    throw new Error(result?.error?.message || "Failed to list memories.");
  }

  return {
    total: result.data.total_count ?? 0,
    memories: Array.isArray(result.data.memories) ? result.data.memories : [],
  };
}

async function importTranscript(
  client: SessionClient,
  persona: Persona,
  characterId: string,
  transcript: string,
) {
  const formData = new FormData();
  formData.append("personaId", persona.id);
  formData.append("characterId", characterId);
  formData.append("personaName", persona.name);
  formData.append(
    "file",
    new File([transcript], "import-memory-test.txt", { type: "text/plain" }),
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

async function chat(
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
    | {
        success?: boolean;
        data?: {
          reply?: string;
          memory_context?: {
            memories?: Array<{ content?: string; memory_type?: string }>;
            user_profile?: string | null;
          };
        };
        error?: { message?: string };
      }
    | null;

  if (!result?.success || !result.data) {
    throw new Error(result?.error?.message || "Chat failed.");
  }

  return result.data;
}

async function adminSnapshot(
  admin: SessionClient,
  userId: string,
  personaId: string,
  characterId: string,
  q?: string,
): Promise<AdminSnapshotResult> {
  const params = new URLSearchParams({
    userId,
    personaId,
    characterId,
    limit: "200",
    offset: "0",
  });
  if (q) {
    params.set("q", q);
  }

  const result = (await admin.request(`/api/admin/memories?${params.toString()}`)).json as
    | {
        success?: boolean;
        data?: {
          memories?: Memory[];
          total_count?: number;
          profile?: unknown;
          summaries?: Array<{ id: string; summary: string | null }>;
        };
        error?: { message?: string };
      }
    | null;

  if (!result?.success || !result.data) {
    throw new Error(result?.error?.message || "Admin snapshot failed.");
  }

  return {
    total: result.data.total_count ?? 0,
    memories: Array.isArray(result.data.memories) ? result.data.memories : [],
    profile: result.data.profile ?? null,
    summaries: Array.isArray(result.data.summaries) ? result.data.summaries : [],
  };
}

async function adminSearch(
  admin: SessionClient,
  userId: string,
  personaId: string,
  characterId: string,
  query: string,
) {
  const result = (await admin.request("/api/admin/memories/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      user_id: userId,
      persona_id: personaId,
      character_id: characterId,
      query,
      limit: 5,
    }),
  })).json as
    | {
        success?: boolean;
        data?: {
          memories?: Array<{
            memory?: { id?: string; content?: string; memory_type?: string };
            similarity_score?: number;
            reranker_score?: number | null;
            final_rank?: number | null;
          }>;
        };
      }
    | null;

  return Array.isArray(result?.data?.memories) ? result.data.memories : [];
}

async function cleanupCharacter(client: SessionClient, characterId: string) {
  await client.request(`/api/characters?id=${encodeURIComponent(characterId)}`, {
    method: "DELETE",
  });
}

function findSessionSummary(
  snapshot: AdminSnapshotResult,
  sessionId: string,
) {
  return snapshot.summaries.find((item) => item.id === sessionId)?.summary ?? null;
}

async function main() {
  const user = new SessionClient();
  const admin = new SessionClient();

  const reportLines: string[] = [
    "# Import Memory Flow Validation",
    "",
    `- Generated at: ${new Date().toISOString()}`,
    `- Base URL: ${BASE_URL}`,
    "",
  ];

  let cleanupCharacterId: string | null = null;

  try {
    const [userLogin, adminLogin] = await Promise.all([
      user.login(USER_EMAIL, USER_PASSWORD),
      admin.login(ADMIN_EMAIL, ADMIN_PASSWORD),
    ]);

    const userLoginJson = userLogin.json as { success?: boolean; error?: { message?: string } } | null;
    const adminLoginJson = adminLogin.json as { success?: boolean; error?: { message?: string } } | null;

    if (!userLoginJson?.success) {
      throw new Error(userLoginJson?.error?.message || "User login failed.");
    }
    if (!adminLoginJson?.success) {
      throw new Error(adminLoginJson?.error?.message || "Admin login failed.");
    }

    const userId = await getCurrentUserId(user);
    const personas = await getPersonas(user);
    const persona = personas.find((item) => item.name === "小芮嫣") ?? personas[0];

    const existingCharacters = await getCharacters(user);
    const characterA = existingCharacters[0];
    if (!characterA) {
      throw new Error("No user character found.");
    }

    const characterB = await createCharacter(
      user,
      `import-isolation-b-${Date.now().toString(36).slice(-6)}`,
    );
    cleanupCharacterId = characterB.id;

    const marker = `meteor-orchid-${Date.now().toString(36)}`;
    const transcript = [
      `09:00 TestUser My favorite flower is ${marker}`,
      `09:01 ${persona.name} Got it, ${marker} is your favorite flower`,
      `09:02 TestUser I usually walk by the seaside on weekends ${marker}`,
      `09:03 ${persona.name} Weekend seaside walks ${marker} sound relaxing`,
    ].join("\n");

    reportLines.push("## Setup");
    reportLines.push("");
    reportLines.push(`- User: \`${USER_EMAIL}\``);
    reportLines.push(`- Persona: \`${persona.name}\` (\`${persona.id}\`)`);
    reportLines.push(`- Character A: \`${characterA.name}\` (\`${characterA.id}\`)`);
    reportLines.push(`- Character B: \`${characterB.name}\` (\`${characterB.id}\`)`);
    reportLines.push(`- Marker: \`${marker}\``);
    reportLines.push("");

    const beforeATotal = await listMemories(user, persona.id, characterA.id);
    const beforeBTotal = await listMemories(user, persona.id, characterB.id);
    const beforeAMarker = await listMemories(user, persona.id, characterA.id, marker);
    const beforeBMarker = await listMemories(user, persona.id, characterB.id, marker);

    const imported = await importTranscript(user, persona, characterA.id, transcript);
    await wait(1500);

    const afterImportATotal = await listMemories(user, persona.id, characterA.id);
    const afterImportBTotal = await listMemories(user, persona.id, characterB.id);
    const afterImportAMarker = await listMemories(user, persona.id, characterA.id, marker);
    const afterImportBMarker = await listMemories(user, persona.id, characterB.id, marker);
    const adminAfterImportA = await adminSnapshot(admin, userId, persona.id, characterA.id);

    const firstChat = await chat(
      user,
      persona.id,
      imported.session_id!,
      "What is my favorite flower? Answer with the flower name only.",
    );

    const firstMemoryContextMemories = firstChat.memory_context?.memories ?? [];
    const firstMemoryContextHasMarker = firstMemoryContextMemories.some((item) =>
      item.content?.includes(marker),
    );

    let pollAttempts = 0;
    let afterFollowupATotal = await listMemories(user, persona.id, characterA.id);
    let afterFollowupAMarker = await listMemories(user, persona.id, characterA.id, marker);
    let adminAfterFollowupA = await adminSnapshot(admin, userId, persona.id, characterA.id);

    while (
      pollAttempts < 6 &&
      afterFollowupATotal.total === afterImportATotal.total &&
      adminAfterFollowupA.summaries.length <= adminAfterImportA.summaries.length
    ) {
      pollAttempts += 1;
      await wait(2500);
      afterFollowupATotal = await listMemories(user, persona.id, characterA.id);
      afterFollowupAMarker = await listMemories(user, persona.id, characterA.id, marker);
      adminAfterFollowupA = await adminSnapshot(admin, userId, persona.id, characterA.id);
    }

    const secondChat = await chat(
      user,
      persona.id,
      imported.session_id!,
      "Repeat it again: what is my favorite flower? Answer with the flower name only.",
    );

    const secondMemoryContextMemories = secondChat.memory_context?.memories ?? [];
    const secondMemoryContextHasMarker = secondMemoryContextMemories.some((item) =>
      item.content?.includes(marker),
    );

    const finalATotal = await listMemories(user, persona.id, characterA.id);
    const finalBTotal = await listMemories(user, persona.id, characterB.id);
    const finalAMarker = await listMemories(user, persona.id, characterA.id, marker);
    const finalBMarker = await listMemories(user, persona.id, characterB.id, marker);
    const adminFinalA = await adminSnapshot(admin, userId, persona.id, characterA.id);
    const adminFinalB = await adminSnapshot(admin, userId, persona.id, characterB.id);
    const adminSearchA = await adminSearch(admin, userId, persona.id, characterA.id, marker);
    const adminSearchB = await adminSearch(admin, userId, persona.id, characterB.id, marker);

    const importedSummaryAfterImport = findSessionSummary(
      adminAfterImportA,
      imported.session_id!,
    );
    const importedSummaryAfterFollowup = findSessionSummary(
      adminAfterFollowupA,
      imported.session_id!,
    );
    const importedSummaryAfterFinal = findSessionSummary(
      adminFinalA,
      imported.session_id!,
    );
    const profileJsonAfterImport = JSON.stringify(adminAfterImportA.profile);
    const profileJsonAfterFollowup = JSON.stringify(adminAfterFollowupA.profile);
    const profileJsonAfterFinal = JSON.stringify(adminFinalA.profile);

    const importDidNotPersistImmediately =
      afterImportATotal.total === beforeATotal.total &&
      afterImportAMarker.total === beforeAMarker.total &&
      Boolean(importedSummaryAfterImport) &&
      importedSummaryAfterImport?.includes("导入") === true;
    const firstChatStillMissedImportedMemory = !firstMemoryContextHasMarker;
    const memoryRowsEventuallyPersisted = finalATotal.total > afterImportATotal.total;
    const profileEventuallyPersisted =
      profileJsonAfterFollowup !== profileJsonAfterImport ||
      profileJsonAfterFinal !== profileJsonAfterImport ||
      importedSummaryAfterFollowup !== importedSummaryAfterImport ||
      importedSummaryAfterFinal !== importedSummaryAfterImport;
    const isolationKept =
      finalBMarker.total === beforeBMarker.total &&
      adminSearchB.length === 0;

    reportLines.push("## Raw Results");
    reportLines.push("");
    reportLines.push(
      asMarkdownJson({
        imported,
        beforeATotal,
        beforeBTotal,
        beforeAMarker,
        beforeBMarker,
        afterImportATotal,
        afterImportBTotal,
        afterImportAMarker,
        afterImportBMarker,
        adminAfterImportA: {
          total: adminAfterImportA.total,
          profile: adminAfterImportA.profile,
          summaries: adminAfterImportA.summaries,
          imported_session_summary: importedSummaryAfterImport,
        },
        firstChat: {
          reply: firstChat.reply,
          memory_context: firstChat.memory_context,
          has_marker_in_memory_context: firstMemoryContextHasMarker,
        },
        pollAttempts,
        afterFollowupATotal,
        afterFollowupAMarker,
        adminAfterFollowupA: {
          total: adminAfterFollowupA.total,
          profile: adminAfterFollowupA.profile,
          summaries: adminAfterFollowupA.summaries,
          imported_session_summary: importedSummaryAfterFollowup,
        },
        secondChat: {
          reply: secondChat.reply,
          memory_context: secondChat.memory_context,
          has_marker_in_memory_context: secondMemoryContextHasMarker,
        },
        finalATotal,
        finalBTotal,
        finalAMarker,
        finalBMarker,
        adminFinalA: {
          total: adminFinalA.total,
          profile: adminFinalA.profile,
          summaries: adminFinalA.summaries,
          imported_session_summary: importedSummaryAfterFinal,
        },
        adminFinalB: {
          total: adminFinalB.total,
          profile: adminFinalB.profile,
          summaries: adminFinalB.summaries,
        },
        adminSearchA,
        adminSearchB,
      }),
    );
    reportLines.push("");

    reportLines.push("## Verdict");
    reportLines.push("");
    reportLines.push(
      `- Import auto-persisted immediately: ${importDidNotPersistImmediately ? "FAIL" : "PASS"}`,
    );
    reportLines.push(
      `- First post-import chat retrieved imported memory in memory_context: ${
        firstChatStillMissedImportedMemory ? "FAIL" : "PASS"
      }`,
    );
    reportLines.push(
      `- Memory rows eventually persisted after follow-up chat: ${
        memoryRowsEventuallyPersisted ? "PASS" : "FAIL"
      }`,
    );
    reportLines.push(
      `- Profile/summary eventually persisted after follow-up chat: ${
        profileEventuallyPersisted ? "PASS" : "FAIL"
      }`,
    );
    reportLines.push(`- Character isolation remained intact: ${isolationKept ? "PASS" : "FAIL"}`);
    reportLines.push("");

    reportLines.push("## Interpretation");
    reportLines.push("");
    reportLines.push(
      importDidNotPersistImmediately
        ? "- The import issue still exists: uploading a transcript does not immediately create long-term memory rows."
        : "- The import flow now creates long-term memory rows immediately.",
    );
    reportLines.push(
      firstChatStillMissedImportedMemory
        ? "- The first chat after import still retrieves old context: imported content is absent from memory_context."
        : "- The first chat after import already sees imported content in memory_context.",
    );
    reportLines.push(
      memoryRowsEventuallyPersisted
        ? "- Follow-up chat eventually created memory rows in the memories list."
        : "- Follow-up chat still did not create memory rows in the memories list.",
    );
    reportLines.push(
      profileEventuallyPersisted
        ? "- Follow-up chat did update the user profile and session summary for the imported session."
        : "- Follow-up chat did not update profile or session summary either.",
    );
    reportLines.push(
      isolationKept
        ? "- Imported content stayed isolated to Character A in this run."
        : "- Imported content leaked into Character B in this run.",
    );
    reportLines.push("");

    const outputDir = path.join(process.cwd(), "docs", "validation-reports");
    await mkdir(outputDir, { recursive: true });
    const outputPath = path.join(outputDir, `import-memory-flow-${nowStamp()}.md`);
    await writeFile(outputPath, `${reportLines.join("\n")}\n`, "utf8");

    console.log(`Validation report written to ${path.relative(process.cwd(), outputPath)}`);
    reportLines.forEach((line) => {
      if (line.startsWith("- ")) {
        console.log(line);
      }
    });
  } finally {
    if (cleanupCharacterId) {
      await cleanupCharacter(user, cleanupCharacterId).catch(() => null);
    }
  }
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
