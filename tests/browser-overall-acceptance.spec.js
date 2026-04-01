const fs = require("node:fs");
const path = require("node:path");
const dotenv = require("dotenv");
const { Client } = require("pg");
const { test } = require("@playwright/test");

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const BASE_URL = "http://localhost:3000";
const TRANSCRIPT_PATH = "D:/Dialogue/ai-companion/output/acceptance-import-transcript.txt";
const REPORT_DIR = path.resolve(process.cwd(), "docs/validation-reports");
const DATABASE_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL;

function nowStamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

async function queryDatabase(browserResult) {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();

  try {
    const user = (
      await client.query(
        `
          select id, email, nickname, role
          from profiles
          where email = $1
          limit 1
        `,
        ["demo@ai-companion.local"],
      )
    ).rows[0] ?? null;

    const character = (
      await client.query(
        `
          select id, owner_id, name, personality, bio, created_at
          from user_characters
          where name = $1
          order by created_at desc nulls last
          limit 1
        `,
        [browserResult.characterName],
      )
    ).rows[0] ?? null;

    const session = (
      await client.query(
        `
          select id, user_id, persona_id, character_id, status, summary, started_at, last_message_at
          from sessions
          where id = $1
          limit 1
        `,
        [browserResult.sessionId],
      )
    ).rows[0] ?? null;

    const messages = (
      await client.query(
        `
          select id, role, content, created_at
          from messages
          where session_id = $1
          order by created_at asc
        `,
        [browserResult.sessionId],
      )
    ).rows;

    const memories = (
      await client.query(
        `
          select id, memory_type, content, character_id, source_session_id, created_at
          from memories
          where character_id = $1
            and persona_id = $2
          order by created_at desc nulls last
          limit 20
        `,
        [browserResult.characterId, browserResult.personaId],
      )
    ).rows;

    const profile = (
      await client.query(
        `
          select id, character_id, relationship_stage, total_messages, updated_at
          from user_profiles_per_persona
          where user_id = $1
            and persona_id = $2
            and character_id = $3
          limit 1
        `,
        [user?.id ?? "", browserResult.personaId, browserResult.characterId],
      )
    ).rows[0] ?? null;

    const memoryLogs = (
      await client.query(
        `
          select id, operation, success, character_id, duration, error_message, timestamp
          from memory_operation_logs
          where character_id = $1
          order by timestamp desc
          limit 20
        `,
        [browserResult.characterId],
      )
    ).rows;

    return {
      user,
      character,
      session,
      messages,
      memories,
      profile,
      memoryLogs,
      checks: {
        characterPersisted: Boolean(character?.id),
        sessionPersisted: Boolean(session?.id),
        messagesPersisted: messages.length >= 5,
        importedFactsPersisted: memories.some(
          (row) =>
            String(row.content).includes("向日葵") ||
            String(row.content).includes("海边散步"),
        ),
        profilePersisted: Boolean(profile?.id),
        memoryLogsPersisted: memoryLogs.length > 0,
      },
    };
  } finally {
    await client.end();
  }
}

test.setTimeout(300000);

test("overall browser acceptance", async ({ page }) => {
  if (!DATABASE_URL) {
    throw new Error("DATABASE_URL or POSTGRES_URL is required.");
  }

  fs.mkdirSync(REPORT_DIR, { recursive: true });

  const consoleErrors = [];
  const pageErrors = [];

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      consoleErrors.push(msg.text());
    }
  });
  page.on("pageerror", (error) => {
    pageErrors.push(String(error));
  });

  const result = {
    generatedAt: new Date().toISOString(),
    characterName: `验收角色-${Date.now().toString().slice(-8)}`,
    userFlow: {},
    adminFlow: {},
    consoleErrors,
    pageErrors,
  };

  async function login(email, password, urlPattern) {
    await page.goto(`${BASE_URL}/login`, { waitUntil: "domcontentloaded" });
    await page.locator('input[type="email"]').fill(email);
    await page.locator('input[type="password"]').fill(password);
    await Promise.all([
      page.waitForURL(urlPattern, { timeout: 20000 }),
      page.locator('button[type="submit"]').click(),
    ]);
    await page.waitForTimeout(1200);
    return page.url();
  }

  async function pollMessages(sessionId, minimumCount, timeoutMs = 60000) {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      const payload = await page.evaluate(async ({ sessionId }) => {
        const response = await fetch(`/api/sessions/${sessionId}/messages`);
        return await response.json();
      }, { sessionId });

      const rows = payload?.data ?? [];
      if (Array.isArray(rows) && rows.length >= minimumCount) {
        return rows;
      }

      await page.waitForTimeout(1200);
    }

    throw new Error("Timed out waiting for session messages.");
  }

  result.userFlow.loginUrl = await login(
    "demo@ai-companion.local",
    "demo123456",
    /\/chat\//,
  );

  const personaMatch = page.url().match(/\/chat\/([^?]+)/);
  result.personaId = personaMatch ? personaMatch[1] : null;
  result.userFlow.chatPageLoaded = Boolean(result.personaId);
  if (!result.personaId) {
    throw new Error("Failed to resolve persona id from chat URL.");
  }

  await page.goto(`${BASE_URL}/characters`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1000);
  result.userFlow.charactersPageLoaded = ((await page.locator("body").textContent()) || "").includes("角色");

  const createResponse = await page.evaluate(async ({ characterName }) => {
    const response = await fetch("/api/characters", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: characterName,
        personality: "真实浏览器验收用角色，细节敏感。",
        bio: "用于验证导入记忆、会话绑定与角色隔离。",
      }),
    });
    return await response.json();
  }, { characterName: result.characterName });
  result.userFlow.characterCreateApiSuccess = Boolean(createResponse?.success);

  const charactersPayload = await page.evaluate(async () => {
    const response = await fetch("/api/characters");
    return await response.json();
  });
  const createdCharacter =
    (charactersPayload?.data?.characters ?? []).find((item) => item.name === result.characterName) ?? null;
  result.characterId = createdCharacter?.id ?? null;

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1000);
  result.userFlow.characterVisibleAfterReload =
    ((await page.locator("body").textContent()) || "").includes(result.characterName);

  if (!result.characterId) {
    throw new Error("Failed to create or resolve acceptance character.");
  }

  await page.goto(`${BASE_URL}/chat/${result.personaId}`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#chat-input", { timeout: 15000 });
  await page.waitForTimeout(1200);

  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll("button"));
    const target = buttons.find((button) => {
      const text = button.textContent || "";
      return text.includes("会话") || text.includes("新");
    });
    if (target) {
      target.click();
    }
  });

  await page.waitForSelector('input[type="file"]', { timeout: 8000 });
  result.userFlow.newSessionDialogOpened = true;
  await page.locator("select").first().selectOption(result.characterId);
  await page.locator('input[type="file"]').setInputFiles(TRANSCRIPT_PATH);
  await page.locator("div.fixed button").first().click();

  await page.waitForFunction(
    () => Boolean(new URL(window.location.href).searchParams.get("session")),
    { timeout: 20000 },
  );
  result.sessionId = await page.evaluate(() => new URL(window.location.href).searchParams.get("session"));
  result.userFlow.sessionId = result.sessionId;

  const importedMessages = await pollMessages(result.sessionId, 3, 30000);
  result.userFlow.importedMessageCount = importedMessages.length;
  result.userFlow.importContainsExpectedFacts = importedMessages.some(
    (message) =>
      String(message.content).includes("向日葵") ||
      String(message.content).includes("海边散步"),
  );

  const asideText = (await page.locator("aside").textContent()) || "";
  result.userFlow.currentCharacterShown = asideText.includes(result.characterName);

  await page.locator("#chat-input").fill("我最喜欢的花是什么？我周末最喜欢做什么？请直接回答。");
  await page.locator("#chat-input").press("Enter");

  const allMessages = await pollMessages(result.sessionId, importedMessages.length + 2, 60000);
  const lastAssistant = [...allMessages].reverse().find((message) => message.role === "assistant") ?? null;
  result.userFlow.lastAssistantReply = lastAssistant?.content ?? null;
  result.userFlow.recallHit =
    Boolean(lastAssistant?.content?.includes("向日葵")) &&
    Boolean(lastAssistant?.content?.includes("海边"));

  await page.goto(`${BASE_URL}/memories`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);
  result.userFlow.memoriesPageLoaded = (((await page.locator("body").textContent()) || "").length > 120);

  await page.evaluate(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
  });

  result.adminFlow.loginUrl = await login(
    "admin@ai-companion.local",
    "admin123456",
    /\/admin\//,
  );

  async function checkAdminPage(pathname, verifier) {
    await page.goto(`${BASE_URL}${pathname}`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);
    const bodyText = (await page.locator("body").textContent()) || "";
    return {
      pathname,
      url: page.url(),
      ok: await verifier(bodyText),
    };
  }

  result.adminFlow.dashboard = await checkAdminPage(
    "/admin/dashboard",
    async (bodyText) => bodyText.includes("Workspace Snapshot") || bodyText.includes("系统"),
  );
  result.adminFlow.memories = await checkAdminPage(
    "/admin/memories",
    async (bodyText) => bodyText.includes("Memory Workspace") && (await page.locator("select").count()) >= 3,
  );
  result.adminFlow.conversations = await checkAdminPage(
    "/admin/conversations",
    async (bodyText) => bodyText.length > 200 && (await page.locator("button").count()) >= 4,
  );
  result.adminFlow.memoryPerformance = await checkAdminPage(
    "/admin/memory-performance",
    async (bodyText) => bodyText.length > 200 && (await page.locator("select").count()) >= 3,
  );

  const logsResponse = await page.evaluate(async ({ characterId }) => {
    const response = await fetch(`/api/admin/memory-logs?limit=50&character_id=${encodeURIComponent(characterId)}`);
    return await response.json();
  }, { characterId: result.characterId });
  const logRows = logsResponse?.data?.logs ?? logsResponse?.data ?? [];
  result.adminFlow.memoryLogsByCharacter = Array.isArray(logRows) ? logRows.length : 0;

  const databaseResult = await queryDatabase(result);
  const summary = {
    userFlowPassed:
      result.userFlow.charactersPageLoaded &&
      result.userFlow.chatPageLoaded &&
      result.userFlow.newSessionDialogOpened &&
      result.userFlow.importContainsExpectedFacts &&
      result.userFlow.currentCharacterShown &&
      result.userFlow.memoriesPageLoaded,
    recallPassed: Boolean(result.userFlow.recallHit),
    adminPagesPassed:
      result.adminFlow.dashboard.ok &&
      result.adminFlow.memories.ok &&
      result.adminFlow.conversations.ok &&
      result.adminFlow.memoryPerformance.ok,
    databasePassed:
      databaseResult.checks.characterPersisted &&
      databaseResult.checks.sessionPersisted &&
      databaseResult.checks.messagesPersisted &&
      databaseResult.checks.importedFactsPersisted &&
      databaseResult.checks.profilePersisted &&
      databaseResult.checks.memoryLogsPersisted,
  };

  const report = {
    generatedAt: result.generatedAt,
    baseUrl: BASE_URL,
    browserResult: result,
    databaseResult,
    summary,
  };

  const reportPath = path.join(REPORT_DIR, `browser-overall-acceptance-${nowStamp()}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf8");

  console.log(JSON.stringify({ reportPath, summary }, null, 2));
});
