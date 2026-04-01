import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import dotenv from "dotenv";
import pg from "pg";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const baseUrl = "http://localhost:3000";
const sessionName = "acceptance";
const transcriptPath = "D:/Dialogue/ai-companion/output/acceptance-import-transcript.txt";
const reportDir = path.resolve(process.cwd(), "docs/validation-reports");
const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const reportPath = path.join(reportDir, `browser-overall-acceptance-${timestamp}.json`);
const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL or POSTGRES_URL is required.");
}

fs.mkdirSync(reportDir, { recursive: true });

function runCli(args, { timeout = 180000, allowFailure = false } = {}) {
  const command = process.platform === "win32" ? "npx.cmd" : "npx";
  const result = spawnSync(
    command,
    ["--yes", "--package", "@playwright/cli", "playwright-cli", ...args],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      timeout,
      env: process.env,
      shell: process.platform === "win32",
    },
  );

  if (!allowFailure && result.status !== 0) {
    throw new Error(
      [
        `playwright-cli ${args.join(" ")} failed`,
        result.error ? String(result.error) : "",
        result.stdout?.trim(),
        result.stderr?.trim(),
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }

  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

function extractConsoleMarker(output, marker) {
  const line = output
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .find((entry) => entry.includes(marker));

  if (!line) {
    return null;
  }

  const index = line.indexOf(marker);
  return line.slice(index + marker.length);
}

function normalizeMemoryLogsResponse(payload) {
  const rows = payload?.data?.logs ?? payload?.data ?? payload?.logs ?? [];
  return Array.isArray(rows) ? rows : [];
}

async function runDatabaseChecks(browserResult) {
  const client = new pg.Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();

  try {
    const userResult = await client.query(
      `
        select id, email, nickname, role
        from profiles
        where email = $1
        limit 1
      `,
      ["demo@ai-companion.local"],
    );
    const user = userResult.rows[0] ?? null;

    const characterResult = await client.query(
      `
        select id, owner_id, name, personality, bio, created_at
        from user_characters
        where name = $1
        order by created_at desc nulls last
        limit 1
      `,
      [browserResult.characterName],
    );
    const character = characterResult.rows[0] ?? null;

    const sessionResult = await client.query(
      `
        select id, user_id, persona_id, character_id, status, summary, started_at, last_message_at
        from sessions
        where id = $1
        limit 1
      `,
      [browserResult.sessionId],
    );
    const session = sessionResult.rows[0] ?? null;

    const messageResult = await client.query(
      `
        select id, role, content, created_at
        from messages
        where session_id = $1
        order by created_at asc
      `,
      [browserResult.sessionId],
    );

    const memoryResult = await client.query(
      `
        select id, memory_type, content, character_id, source_session_id, created_at
        from memories
        where character_id = $1
          and persona_id = $2
        order by created_at desc nulls last
        limit 20
      `,
      [browserResult.characterId, browserResult.personaId],
    );

    const profileResult = await client.query(
      `
        select id, character_id, relationship_stage, total_messages, updated_at
        from user_profiles_per_persona
        where user_id = $1
          and persona_id = $2
          and character_id = $3
        limit 1
      `,
      [user?.id ?? "", browserResult.personaId, browserResult.characterId],
    );

    const memoryLogResult = await client.query(
      `
        select id, operation, success, character_id, duration, error_message, timestamp
        from memory_operation_logs
        where character_id = $1
        order by timestamp desc
        limit 20
      `,
      [browserResult.characterId],
    );

    return {
      user,
      character,
      session,
      messages: messageResult.rows,
      memories: memoryResult.rows,
      profile: profileResult.rows[0] ?? null,
      memoryLogs: memoryLogResult.rows,
      checks: {
        characterPersisted: Boolean(character?.id),
        sessionPersisted: Boolean(session?.id),
        messagesPersisted: messageResult.rows.length >= 5,
        importedFactsPersisted: memoryResult.rows.some(
          (row) =>
            String(row.content).includes("向日葵") ||
            String(row.content).includes("海边散步"),
        ),
        profilePersisted: Boolean(profileResult.rows[0]?.id),
        memoryLogsPersisted: memoryLogResult.rows.length > 0,
      },
    };
  } finally {
    await client.end();
  }
}

const browserCode = `
async (page) => {
  const base = ${JSON.stringify(baseUrl)};
  const transcriptPath = ${JSON.stringify(transcriptPath)};
  const result = {
    userFlow: {},
    adminFlow: {},
    consoleErrors: [],
    pageErrors: [],
  };

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      result.consoleErrors.push(msg.text());
    }
  });
  page.on("pageerror", (err) => {
    result.pageErrors.push(String(err));
  });

  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  async function login(email, password, targetPattern) {
    await page.goto(base + "/login", { waitUntil: "domcontentloaded" });
    await page.locator('input[type="email"]').fill(email);
    await page.locator('input[type="password"]').fill(password);
    await Promise.all([
      page.waitForURL(targetPattern, { timeout: 20000 }),
      page.locator('button[type="submit"]').click(),
    ]);
    await wait(1200);
    return page.url();
  }

  async function ensureCharacterExists(characterName) {
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
    }, { characterName });

    const listResponse = await page.evaluate(async () => {
      const response = await fetch("/api/characters");
      return await response.json();
    });

    const characters = listResponse?.data?.characters ?? [];
    const character = characters.find((item) => item.name === characterName) ?? null;

    return {
      createResponse,
      character,
    };
  }

  async function pollSessionMessages(sessionId, minimumCount, timeoutMs = 45000) {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      const payload = await page.evaluate(async ({ sessionId }) => {
        const response = await fetch("/api/sessions/" + sessionId + "/messages");
        return await response.json();
      }, { sessionId });

      const rows = payload?.data ?? [];
      if (Array.isArray(rows) && rows.length >= minimumCount) {
        return rows;
      }

      await wait(1200);
    }

    throw new Error("Timed out waiting for session messages.");
  }

  result.userFlow.loginUrl = await login(
    "demo@ai-companion.local",
    "demo123456",
    /\\/chat\\//
  );

  const personaMatch = page.url().match(/\\/chat\\/([^?]+)/);
  const personaId = personaMatch ? personaMatch[1] : null;
  if (!personaId) {
    throw new Error("Failed to resolve persona id from chat URL.");
  }

  result.userFlow.personaId = personaId;
  result.characterName = "验收角色-" + Date.now().toString().slice(-8);

  await page.goto(base + "/characters", { waitUntil: "domcontentloaded" });
  await wait(1000);
  result.userFlow.charactersPageLoaded = (await page.locator("body").textContent() || "").includes("角色");

  const created = await ensureCharacterExists(result.characterName);
  result.userFlow.characterCreateApiSuccess = Boolean(created?.createResponse?.success);
  result.characterId = created?.character?.id ?? null;
  result.userFlow.characterVisibleAfterReload = false;

  await page.reload({ waitUntil: "domcontentloaded" });
  await wait(1000);
  result.userFlow.characterVisibleAfterReload =
    (await page.locator("body").textContent() || "").includes(result.characterName);

  if (!result.characterId) {
    throw new Error("Failed to create or resolve acceptance character.");
  }

  await page.goto(base + "/chat/" + personaId, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#chat-input", { timeout: 15000 });
  await wait(1200);
  result.userFlow.chatPageLoaded = true;

  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll("button"));
    const target = buttons.find((button) => {
      const text = button.textContent || "";
      return text.includes("会话") || text.includes("新");
    });
    if (target) target.click();
  });

  await page.waitForSelector('input[type="file"]', { timeout: 8000 });
  result.userFlow.newSessionDialogOpened = true;

  await page.locator("select").first().selectOption(result.characterId);
  await page.locator('input[type="file"]').setInputFiles(transcriptPath);

  const dialogButtons = page.locator("div.fixed button");
  await dialogButtons.first().click();

  const startedAt = Date.now();
  let sessionId = null;
  while (Date.now() - startedAt < 20000) {
    sessionId = await page.evaluate(() => {
      return new URL(window.location.href).searchParams.get("session");
    });
    if (sessionId) break;
    await wait(800);
  }

  if (!sessionId) {
    throw new Error("Session id did not appear after import.");
  }

  result.sessionId = sessionId;
  result.userFlow.sessionId = sessionId;

  const importedMessages = await pollSessionMessages(sessionId, 3, 30000);
  result.userFlow.importedMessageCount = importedMessages.length;
  result.userFlow.importContainsExpectedFacts = importedMessages.some((message) =>
    String(message.content || "").includes("向日葵") ||
    String(message.content || "").includes("海边散步")
  );

  const sidebarText = await page.locator("aside").textContent();
  result.userFlow.currentCharacterShown = (sidebarText || "").includes(result.characterName);

  await page.locator("#chat-input").fill("我最喜欢的花是什么？我周末最喜欢做什么？请直接回答。");
  await page.locator("#chat-input").press("Enter");

  const allMessages = await pollSessionMessages(sessionId, importedMessages.length + 2, 60000);
  const lastAssistant = [...allMessages].reverse().find((message) => message.role === "assistant");
  result.userFlow.lastAssistantReply = lastAssistant?.content ?? null;
  result.userFlow.recallHit =
    Boolean(lastAssistant?.content?.includes("向日葵")) &&
    Boolean(lastAssistant?.content?.includes("海边"));

  await page.goto(base + "/memories", { waitUntil: "domcontentloaded" });
  await wait(1200);
  const memoriesBody = await page.locator("body").textContent();
  result.userFlow.memoriesPageLoaded = Boolean(memoriesBody && memoriesBody.length > 120);

  await page.evaluate(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
  });

  result.adminFlow.loginUrl = await login(
    "admin@ai-companion.local",
    "admin123456",
    /\\/admin\\//
  );

  async function checkAdminPage(pathname, verifier) {
    await page.goto(base + pathname, { waitUntil: "domcontentloaded" });
    await wait(1500);
    const bodyText = await page.locator("body").textContent();
    return {
      pathname,
      url: page.url(),
      ok: await verifier(bodyText || ""),
    };
  }

  result.adminFlow.dashboard = await checkAdminPage(
    "/admin/dashboard",
    async (bodyText) => bodyText.includes("Workspace Snapshot") || bodyText.includes("系统")
  );
  result.adminFlow.memories = await checkAdminPage(
    "/admin/memories",
    async (bodyText) => bodyText.includes("Memory Workspace") && (await page.locator("select").count()) >= 3
  );
  result.adminFlow.conversations = await checkAdminPage(
    "/admin/conversations",
    async (bodyText) => bodyText.length > 200 && (await page.locator("button").count()) >= 4
  );
  result.adminFlow.memoryPerformance = await checkAdminPage(
    "/admin/memory-performance",
    async (bodyText) => bodyText.length > 200 && (await page.locator("select").count()) >= 3
  );

  const logsResponse = await page.evaluate(async ({ characterId }) => {
    const response = await fetch("/api/admin/memory-logs?limit=50&character_id=" + encodeURIComponent(characterId));
    return await response.json();
  }, { characterId: result.characterId });

  result.adminFlow.memoryLogsByCharacter = Array.isArray(logsResponse?.data?.logs)
    ? logsResponse.data.logs.length
    : Array.isArray(logsResponse?.data)
      ? logsResponse.data.length
      : 0;

  console.log("ACCEPTANCE_RESULT::" + JSON.stringify(result));
  return "overall-browser-acceptance-complete";
}
`;

runCli(["close-all"], { allowFailure: true });
runCli(["kill-all"], { allowFailure: true });
runCli([`-s=${sessionName}`, "open", `${baseUrl}/login`], { timeout: 30000 });
runCli([`-s=${sessionName}`, "run-code", browserCode], { timeout: 240000 });
const consoleDump = runCli([`-s=${sessionName}`, "console"], { timeout: 30000 }).stdout;
const payloadText = extractConsoleMarker(consoleDump, "ACCEPTANCE_RESULT::");

if (!payloadText) {
  throw new Error("Failed to extract browser acceptance payload from console output.");
}

const browserResult = JSON.parse(payloadText);
const databaseResult = await runDatabaseChecks(browserResult);

const report = {
  generatedAt: new Date().toISOString(),
  baseUrl,
  browserResult: {
    ...browserResult,
    consoleErrors: browserResult.consoleErrors ?? [],
    pageErrors: browserResult.pageErrors ?? [],
  },
  databaseResult,
  summary: {
    userFlowPassed:
      browserResult.userFlow?.charactersPageLoaded &&
      browserResult.userFlow?.chatPageLoaded &&
      browserResult.userFlow?.newSessionDialogOpened &&
      browserResult.userFlow?.importContainsExpectedFacts &&
      browserResult.userFlow?.currentCharacterShown &&
      browserResult.userFlow?.memoriesPageLoaded,
    recallPassed: Boolean(browserResult.userFlow?.recallHit),
    adminPagesPassed:
      browserResult.adminFlow?.dashboard?.ok &&
      browserResult.adminFlow?.memories?.ok &&
      browserResult.adminFlow?.conversations?.ok &&
      browserResult.adminFlow?.memoryPerformance?.ok,
    databasePassed:
      databaseResult.checks.characterPersisted &&
      databaseResult.checks.sessionPersisted &&
      databaseResult.checks.messagesPersisted &&
      databaseResult.checks.importedFactsPersisted &&
      databaseResult.checks.profilePersisted &&
      databaseResult.checks.memoryLogsPersisted,
  },
};

fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf8");
console.log(JSON.stringify({ reportPath, summary: report.summary }, null, 2));
