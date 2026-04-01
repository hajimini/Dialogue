$ErrorActionPreference = "Stop"
Set-Location "D:\Dialogue\ai-companion"

function Invoke-PlaywrightCli {
  param([string[]]$CliArgs)

  $output = & npx --yes --package @playwright/cli playwright-cli @CliArgs 2>&1 | Out-String
  if ($LASTEXITCODE -ne 0) {
    throw "playwright-cli failed: $($CliArgs -join ' ')`n$output"
  }

  return $output
}

function Invoke-RunCode {
  param([string]$Code)

  $normalized = ($Code -replace "`r?`n", " ")
  $output = Invoke-PlaywrightCli @("-s=acceptance", "run-code", $normalized)
  $lines = $output -split "`r?`n"
  $resultIndex = -1

  for ($i = 0; $i -lt $lines.Length; $i++) {
    if ($lines[$i].Trim() -eq "### Result") {
      $resultIndex = $i
      break
    }
  }

  if ($resultIndex -lt 0 -or $resultIndex + 1 -ge $lines.Length) {
    throw "Unable to parse run-code output`n$output"
  }

  $jsonLiteral = $lines[$resultIndex + 1].Trim()
  $inner = $jsonLiteral | ConvertFrom-Json
  return ($inner | ConvertFrom-Json)
}

function Invoke-DbQuery {
  param(
    [string]$PersonaId,
    [string]$CharacterId,
    [string]$SessionId,
    [string]$CharacterName
  )

  $env:ACCEPTANCE_PERSONA_ID = $PersonaId
  $env:ACCEPTANCE_CHARACTER_ID = $CharacterId
  $env:ACCEPTANCE_SESSION_ID = $SessionId
  $env:ACCEPTANCE_CHARACTER_NAME = $CharacterName

  $dbJson = @'
const path = require("node:path");
const dotenv = require("dotenv");
const { Client } = require("pg");

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

(async () => {
  const client = new Client({
    connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();

  try {
    const user = (
      await client.query(
        `select id, email, nickname, role from profiles where email = $1 limit 1`,
        ["demo@ai-companion.local"],
      )
    ).rows[0] ?? null;

    const character = (
      await client.query(
        `select id, owner_id, name, personality, bio, created_at
         from user_characters
         where name = $1
         order by created_at desc nulls last
         limit 1`,
        [process.env.ACCEPTANCE_CHARACTER_NAME],
      )
    ).rows[0] ?? null;

    const session = (
      await client.query(
        `select id, user_id, persona_id, character_id, status, summary, started_at, last_message_at
         from sessions
         where id = $1
         limit 1`,
        [process.env.ACCEPTANCE_SESSION_ID],
      )
    ).rows[0] ?? null;

    const messages = (
      await client.query(
        `select id, role, content, created_at
         from messages
         where session_id = $1
         order by created_at asc`,
        [process.env.ACCEPTANCE_SESSION_ID],
      )
    ).rows;

    const memories = (
      await client.query(
        `select id, memory_type, content, character_id, source_session_id, created_at
         from memories
         where character_id = $1
           and persona_id = $2
         order by created_at desc nulls last
         limit 20`,
        [process.env.ACCEPTANCE_CHARACTER_ID, process.env.ACCEPTANCE_PERSONA_ID],
      )
    ).rows;

    const profile = (
      await client.query(
        `select id, character_id, relationship_stage, total_messages, updated_at
         from user_profiles_per_persona
         where user_id = $1
           and persona_id = $2
           and character_id = $3
         limit 1`,
        [user?.id ?? "", process.env.ACCEPTANCE_PERSONA_ID, process.env.ACCEPTANCE_CHARACTER_ID],
      )
    ).rows[0] ?? null;

    const memoryLogs = (
      await client.query(
        `select id, operation, success, character_id, duration, error_message, timestamp
         from memory_operation_logs
         where character_id = $1
         order by timestamp desc
         limit 20`,
        [process.env.ACCEPTANCE_CHARACTER_ID],
      )
    ).rows;

    process.stdout.write(JSON.stringify({
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
        importedFactsPersisted: memories.some((row) =>
          String(row.content).includes("向日葵") ||
          String(row.content).includes("海边散步")
        ),
        profilePersisted: Boolean(profile?.id),
        memoryLogsPersisted: memoryLogs.length > 0,
      },
    }));
  } finally {
    await client.end();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
'@ | node -

  if ($LASTEXITCODE -ne 0) {
    throw "Database verification failed`n$dbJson"
  }

  return ($dbJson | ConvertFrom-Json)
}

Remove-Item ".playwright-cli\console-*.log" -ErrorAction SilentlyContinue

Invoke-PlaywrightCli @("close-all") | Out-Null
Invoke-PlaywrightCli @("kill-all") | Out-Null
Invoke-PlaywrightCli @("-s=acceptance", "open", "http://localhost:3000/login") | Out-Null

$step1 = Invoke-RunCode @'
async (page) => {
  await page.goto("http://localhost:3000/login", { waitUntil: "domcontentloaded" });
  await page.locator('input[type="email"]').fill("demo@ai-companion.local");
  await page.locator('input[type="password"]').fill("demo123456");
  await Promise.all([
    page.waitForURL(/\/chat\//, { timeout: 20000 }),
    page.locator('button[type="submit"]').click(),
  ]);
  await page.waitForTimeout(1200);
  const match = page.url().match(/\/chat\/([^?]+)/);
  return JSON.stringify({
    loginUrl: page.url(),
    personaId: match ? match[1] : null,
    bodyHasChatInput: await page.locator("#chat-input").count() > 0,
  });
}
'@

$characterName = "验收角色-$([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds().ToString().Substring(5))"

$step2Template = @'
async (page) => {
  const characterName = "__CHARACTER_NAME__";
  await page.goto("http://localhost:3000/characters", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1000);
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
  const created = characters.find((item) => item.name === characterName) ?? null;
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(800);
  const bodyText = (await page.locator("body").textContent()) || "";
  return JSON.stringify({
    createSuccess: Boolean(createResponse?.success),
    charactersPageLoaded: bodyText.includes("角色"),
    characterVisibleAfterReload: bodyText.includes(characterName),
    characterId: created?.id ?? null,
    characterName,
  });
}
'@

$step2 = Invoke-RunCode ($step2Template.Replace("__CHARACTER_NAME__", $characterName))

$step3Template = @'
async (page) => {
  const personaId = "__PERSONA_ID__";
  const characterId = "__CHARACTER_ID__";
  const characterName = "__CHARACTER_NAME__";
  const transcriptPath = "D:/Dialogue/ai-companion/output/acceptance-import-transcript.txt";
  await page.goto(`http://localhost:3000/chat/${personaId}`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#chat-input", { timeout: 15000 });
  await page.waitForTimeout(1200);
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll("button"));
    const target = buttons.find((button) => {
      const text = button.textContent || "";
      return text.includes("会话") || text.includes("新");
    });
    if (target) target.click();
  });
  await page.waitForSelector('input[type="file"]', { timeout: 8000 });
  await page.locator("select").first().selectOption(characterId);
  await page.locator('input[type="file"]').setInputFiles(transcriptPath);
  await page.locator("div.fixed button").first().click();
  await page.waitForFunction(
    () => Boolean(new URL(window.location.href).searchParams.get("session")),
    { timeout: 20000 }
  );
  const sessionId = await page.evaluate(() => new URL(window.location.href).searchParams.get("session"));
  let messages = [];
  const started = Date.now();
  while (Date.now() - started < 30000) {
    const payload = await page.evaluate(async ({ sessionId }) => {
      const response = await fetch(`/api/sessions/${sessionId}/messages`);
      return await response.json();
    }, { sessionId });
    messages = payload?.data ?? [];
    if (Array.isArray(messages) && messages.length >= 3) break;
    await page.waitForTimeout(1200);
  }
  const asideText = (await page.locator("aside").textContent()) || "";
  return JSON.stringify({
    sessionId,
    importedMessageCount: Array.isArray(messages) ? messages.length : 0,
    importContainsExpectedFacts: Array.isArray(messages) && messages.some((message) =>
      String(message.content).includes("向日葵") ||
      String(message.content).includes("海边散步")
    ),
    currentCharacterShown: asideText.includes(characterName),
    newSessionDialogOpened: true,
  });
}
'@

$step3Code = $step3Template.Replace("__PERSONA_ID__", $step1.personaId).Replace("__CHARACTER_ID__", $step2.characterId).Replace("__CHARACTER_NAME__", $characterName)
$step3 = Invoke-RunCode $step3Code

$step4Template = @'
async (page) => {
  const sessionId = "__SESSION_ID__";
  await page.locator("#chat-input").fill("我最喜欢的花是什么？我周末最喜欢做什么？请直接回答。");
  await page.locator("#chat-input").press("Enter");
  let messages = [];
  const started = Date.now();
  while (Date.now() - started < 60000) {
    const payload = await page.evaluate(async ({ sessionId }) => {
      const response = await fetch(`/api/sessions/${sessionId}/messages`);
      return await response.json();
    }, { sessionId });
    messages = payload?.data ?? [];
    if (Array.isArray(messages) && messages.length >= 5) break;
    await page.waitForTimeout(1500);
  }
  const lastAssistant = Array.isArray(messages)
    ? [...messages].reverse().find((message) => message.role === "assistant")
    : null;
  return JSON.stringify({
    totalMessageCount: Array.isArray(messages) ? messages.length : 0,
    lastAssistantReply: lastAssistant?.content ?? null,
    recallHit: Boolean(lastAssistant?.content?.includes("向日葵")) &&
      Boolean(lastAssistant?.content?.includes("海边")),
  });
}
'@

$step4 = Invoke-RunCode ($step4Template.Replace("__SESSION_ID__", $step3.sessionId))

$step5 = Invoke-RunCode @'
async (page) => {
  await page.goto("http://localhost:3000/memories", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);
  const bodyText = (await page.locator("body").textContent()) || "";
  return JSON.stringify({ memoriesPageLoaded: bodyText.length > 120 });
}
'@

$step6Template = @'
async (page) => {
  await page.evaluate(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
  });
  await page.goto("http://localhost:3000/login", { waitUntil: "domcontentloaded" });
  await page.locator('input[type="email"]').fill("admin@ai-companion.local");
  await page.locator('input[type="password"]').fill("admin123456");
  await Promise.all([
    page.waitForURL(/\/admin\//, { timeout: 20000 }),
    page.locator('button[type="submit"]').click(),
  ]);
  await page.waitForTimeout(1200);
  async function checkPage(pathname, verifier) {
    await page.goto(`http://localhost:3000${pathname}`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);
    const bodyText = (await page.locator("body").textContent()) || "";
    return { pathname, url: page.url(), ok: await verifier(bodyText) };
  }
  const dashboard = await checkPage("/admin/dashboard", async (bodyText) =>
    bodyText.includes("Workspace Snapshot") || bodyText.includes("系统")
  );
  const memories = await checkPage("/admin/memories", async (bodyText) =>
    bodyText.includes("Memory Workspace") && (await page.locator("select").count()) >= 3
  );
  const conversations = await checkPage("/admin/conversations", async (bodyText) =>
    bodyText.length > 200 && (await page.locator("button").count()) >= 4
  );
  const memoryPerformance = await checkPage("/admin/memory-performance", async (bodyText) =>
    bodyText.length > 200 && (await page.locator("select").count()) >= 3
  );
  const logsResponse = await page.evaluate(async () => {
    const response = await fetch("/api/admin/memory-logs?limit=50&character_id=__CHARACTER_ID__");
    return await response.json();
  });
  const logRows = logsResponse?.data?.logs ?? logsResponse?.data ?? [];
  return JSON.stringify({
    loginUrl: page.url(),
    dashboard,
    memories,
    conversations,
    memoryPerformance,
    memoryLogsByCharacter: Array.isArray(logRows) ? logRows.length : 0,
  });
}
'@

$step6Code = $step6Template.Replace("__CHARACTER_ID__", [uri]::EscapeDataString($step2.characterId))
$step6 = Invoke-RunCode $step6Code

Invoke-PlaywrightCli @("-s=acceptance", "console", "debug") | Out-Null
$consoleLog = Get-ChildItem ".playwright-cli\console-*.log" | Sort-Object LastWriteTime -Desc | Select-Object -First 1
$consoleText = if ($consoleLog) { Get-Content -Raw $consoleLog.FullName } else { "" }
$consoleErrorCount = ([regex]::Matches($consoleText, "\[ERROR\]")).Count

$db = Invoke-DbQuery -PersonaId $step1.personaId -CharacterId $step2.characterId -SessionId $step3.sessionId -CharacterName $characterName

$summary = [ordered]@{
  userFlowPassed = ($step2.charactersPageLoaded -and $step1.bodyHasChatInput -and $step3.newSessionDialogOpened -and $step3.importContainsExpectedFacts -and $step3.currentCharacterShown -and $step5.memoriesPageLoaded)
  recallPassed = [bool]$step4.recallHit
  adminPagesPassed = ($step6.dashboard.ok -and $step6.memories.ok -and $step6.conversations.ok -and $step6.memoryPerformance.ok)
  databasePassed = ($db.checks.characterPersisted -and $db.checks.sessionPersisted -and $db.checks.messagesPersisted -and $db.checks.importedFactsPersisted -and $db.checks.profilePersisted -and $db.checks.memoryLogsPersisted)
  consoleErrorCount = $consoleErrorCount
}

$report = [ordered]@{
  generatedAt = (Get-Date).ToString("s")
  browser = [ordered]@{
    login = $step1
    character = $step2
    import = $step3
    recall = $step4
    memories = $step5
    admin = $step6
    consoleErrorCount = $consoleErrorCount
  }
  database = $db
  summary = $summary
}

$reportPath = Join-Path "docs/validation-reports" ("browser-overall-acceptance-{0}.json" -f (Get-Date -Format "yyyyMMdd-HHmmss"))
$report | ConvertTo-Json -Depth 8 | Set-Content -Encoding UTF8 $reportPath
$report | ConvertTo-Json -Depth 8
