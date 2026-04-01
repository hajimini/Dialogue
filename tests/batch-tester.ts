import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { Pool } from "pg";

type HardRulesConfig = {
  max_reply_length: number;
  blacklist_phrases: string[];
  blacklist_regexes: string[];
  markdown_regexes: string[];
  list_numbering_regexes: string[];
  ai_identity_phrases: string[];
};

type BatchTestCase = {
  id: string;
  category: "A" | "B" | "C" | "D" | "E" | "F";
  category_label: string;
  input: string;
  expectation: string;
  prerequisite: string | null;
  persona_id?: string | null;
  setup_messages?: string[];
  setup_strategy?: "same_session" | "previous_session";
  source?: string;
};

type BatchCasesConfig = {
  version: number;
  hard_rules: HardRulesConfig;
  cases: BatchTestCase[];
};

type SessionListItem = {
  id: string;
};

type MessageRecord = {
  id: string;
  content: string;
  created_at: string | null;
};

type ApiSuccess<T> = {
  success: true;
  data: T;
  error: null;
};

type ApiFailure = {
  success: false;
  data: null;
  error: {
    message: string;
  } | null;
};

type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

type ChatResponseData = {
  reply: string;
  session_id: string;
  prompt_version_id?: string;
  model_provider_id?: string | null;
  assistant_message: MessageRecord;
};

type ParsedArgs = {
  personaId: string | null;
  category: "A" | "B" | "C" | "D" | "E" | "F" | "ALL";
  caseIds: string[];
  promptVersion: string | null;
  modelProviderId: string | null;
  baseUrl: string;
};

type CheckResult = {
  pass: boolean;
  matches?: string[];
  actual?: number;
  limit?: number;
};

type CaseResult = {
  id: string;
  category: string;
  category_label: string;
  persona_id: string;
  input: string;
  expectation: string;
  prerequisite: string | null;
  prompt_version: string | null;
  model_provider_id: string | null;
  session_id: string | null;
  setup_session_id: string | null;
  setup_messages: string[];
  reply: string;
  reply_length: number;
  duration_ms: number;
  passed: boolean;
  checks: {
    non_empty: CheckResult;
    length: CheckResult;
    blacklist: CheckResult;
    markdown: CheckResult;
    ai_identity: CheckResult;
    list_numbering: CheckResult;
  };
  error: string | null;
};

const DEFAULT_BASE_URL =
  process.env.BATCH_TESTER_BASE_URL?.trim() || "http://localhost:3000";
const DEFAULT_EMAIL =
  process.env.BATCH_TESTER_EMAIL?.trim() || "demo@ai-companion.local";
const DEFAULT_PASSWORD =
  process.env.BATCH_TESTER_PASSWORD?.trim() || "demo123456";

async function loadEnv(repoRoot: string) {
  const content = await readFile(path.join(repoRoot, ".env.local"), "utf8");

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const separatorIndex = line.indexOf("=");
    if (separatorIndex <= 0) continue;

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1);

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

function getDatabaseUrl() {
  const databaseUrl =
    process.env.DATABASE_URL ??
    process.env.POSTGRES_URL ??
    process.env.POSTGRES_PRISMA_URL ??
    process.env.POSTGRES_URL_NON_POOLING;

  if (!databaseUrl) {
    throw new Error(
      "缺少环境变量：DATABASE_URL（也兼容 POSTGRES_URL / POSTGRES_PRISMA_URL / POSTGRES_URL_NON_POOLING）",
    );
  }

  return databaseUrl;
}

async function fetchFirstActivePersona(): Promise<string | null> {
  const sslMode = (process.env.POSTGRES_SSL ?? "require").toLowerCase();
  const pool = new Pool({
    connectionString: getDatabaseUrl(),
    ssl: sslMode === "disable" ? false : { rejectUnauthorized: false },
  });

  try {
    const result = await pool.query<{ id: string }>(
      "select id from personas where is_active = true order by created_at asc nulls last limit 1",
    );
    return result.rows[0]?.id ?? null;
  } finally {
    await pool.end();
  }
}

function parseArgs(argv: string[]): ParsedArgs {
  let personaId: string | null = process.env.BATCH_TESTER_PERSONA_ID?.trim() || null;
  let category: ParsedArgs["category"] = "ALL";
  let caseIds: string[] = [];
  let promptVersion: string | null = null;
  let modelProviderId: string | null =
    process.env.BATCH_TESTER_MODEL_PROVIDER_ID?.trim() || null;
  let baseUrl = DEFAULT_BASE_URL;

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    const next = argv[index + 1];

    if (current === "--persona" && next) {
      personaId = next.trim();
      index += 1;
      continue;
    }

    if (current === "--category" && next) {
      const normalized = next.trim().toUpperCase();
      if (["A", "B", "C", "D", "E", "F", "ALL"].includes(normalized)) {
        category = normalized as ParsedArgs["category"];
      } else {
        throw new Error(`Unsupported category: ${next}`);
      }
      index += 1;
      continue;
    }

    if (current === "--prompt-version" && next) {
      promptVersion = next.trim();
      index += 1;
      continue;
    }

    if (current === "--case-id" && next) {
      caseIds = next
        .split(",")
        .map((item) => item.trim().toUpperCase())
        .filter(Boolean);
      index += 1;
      continue;
    }

    if (current === "--model-provider" && next) {
      modelProviderId = next.trim();
      index += 1;
      continue;
    }

    if (current === "--base-url" && next) {
      baseUrl = next.trim().replace(/\/$/, "");
      index += 1;
      continue;
    }
  }

  return {
    personaId,
    category,
    caseIds,
    promptVersion,
    modelProviderId,
    baseUrl: baseUrl.replace(/\/$/, ""),
  };
}

function getTimestampParts() {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");

  return {
    iso: now.toISOString(),
    file: `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(
      now.getHours(),
    )}${pad(now.getMinutes())}${pad(now.getSeconds())}`,
  };
}

function countCharacters(text: string) {
  return Array.from(text).length;
}

function collectPhraseMatches(text: string, phrases: string[]) {
  return phrases.filter((phrase) => phrase && text.includes(phrase));
}

function collectRegexPatternMatches(text: string, patterns: string[]) {
  const matches: string[] = [];

  for (const pattern of patterns) {
    const regex = new RegExp(pattern, "im");
    if (regex.test(text)) {
      matches.push(pattern);
    }
  }

  return matches;
}

function buildChecks(reply: string, hardRules: HardRulesConfig) {
  const trimmed = reply.trim();
  const replyLength = countCharacters(trimmed);
  const blacklistMatches = [
    ...collectPhraseMatches(trimmed, hardRules.blacklist_phrases),
    ...collectRegexPatternMatches(trimmed, hardRules.blacklist_regexes),
  ];
  const markdownMatches = collectRegexPatternMatches(
    trimmed,
    hardRules.markdown_regexes,
  );
  const aiIdentityMatches = collectPhraseMatches(
    trimmed,
    hardRules.ai_identity_phrases,
  );
  const listMatches = collectRegexPatternMatches(
    trimmed,
    hardRules.list_numbering_regexes,
  );

  return {
    non_empty: {
      pass: trimmed.length > 0,
    },
    length: {
      pass: replyLength < hardRules.max_reply_length,
      actual: replyLength,
      limit: hardRules.max_reply_length,
    },
    blacklist: {
      pass: blacklistMatches.length === 0,
      matches: blacklistMatches,
    },
    markdown: {
      pass: markdownMatches.length === 0,
      matches: markdownMatches,
    },
    ai_identity: {
      pass: aiIdentityMatches.length === 0,
      matches: aiIdentityMatches,
    },
    list_numbering: {
      pass: listMatches.length === 0,
      matches: listMatches,
    },
  };
}

function didPassAllChecks(checks: CaseResult["checks"]) {
  return Object.values(checks).every((item) => item.pass);
}

function extractCookieHeader(response: Response) {
  const setCookies =
    typeof response.headers.getSetCookie === "function"
      ? response.headers.getSetCookie()
      : (() => {
          const single = response.headers.get("set-cookie");
          return single ? [single] : [];
        })();

  const cookies = setCookies
    .map((cookie) => cookie.split(";")[0]?.trim())
    .filter(Boolean);

  return cookies.join("; ");
}

async function requestJson<T>(
  url: string,
  options: RequestInit,
  cookieHeader?: string,
): Promise<ApiResponse<T>> {
  const headers = new Headers(options.headers);
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (cookieHeader) {
    headers.set("Cookie", cookieHeader);
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });
  const raw = await response.text();

  try {
    return JSON.parse(raw) as ApiResponse<T>;
  } catch {
    return {
      success: false,
      data: null,
      error: {
        message: `Non-JSON response from ${url} (status ${response.status}): ${raw.slice(0, 180)}`,
      },
    };
  }
}

async function login(baseUrl: string) {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: DEFAULT_EMAIL,
      password: DEFAULT_PASSWORD,
    }),
  });

  const json = (await response.json()) as ApiResponse<{
    user: { id: string; email: string };
  }>;

  if (!response.ok || !json.success) {
    throw new Error(json.error?.message || "Login failed.");
  }

  const cookieHeader = extractCookieHeader(response);
  if (!cookieHeader) {
    throw new Error("Login succeeded but no auth cookie was returned.");
  }

  return cookieHeader;
}

async function createSession(
  baseUrl: string,
  cookieHeader: string,
  personaId: string,
) {
  const json = await requestJson<SessionListItem>(
    `${baseUrl}/api/personas/${personaId}/sessions`,
    {
      method: "POST",
      body: JSON.stringify({}),
    },
    cookieHeader,
  );

  if (!json.success || !json.data) {
    throw new Error(json.error?.message || "Failed to create session.");
  }

  return json.data.id;
}

async function sendChatMessage(input: {
  baseUrl: string;
  cookieHeader: string;
  personaId: string;
  sessionId: string;
  message: string;
  promptVersion: string | null;
  modelProviderId: string | null;
}) {
  const json = await requestJson<ChatResponseData>(
    `${input.baseUrl}/api/chat`,
    {
      method: "POST",
      body: JSON.stringify({
        persona_id: input.personaId,
        session_id: input.sessionId,
        message: input.message,
        prompt_version_id: input.promptVersion,
        model_provider_id: input.modelProviderId,
      }),
    },
    input.cookieHeader,
  );

  if (!json.success || !json.data) {
    throw new Error(json.error?.message || "Chat request failed.");
  }

  return json.data;
}

async function loadConfig(repoRoot: string) {
  const customPath = process.env.BATCH_TESTER_TEST_CASES_PATH;
  const filePath = customPath || path.join(repoRoot, "docs", "TEST_CASES.json");
  const content = await readFile(filePath, "utf8");
  return JSON.parse(content) as BatchCasesConfig;
}

function filterCases(
  cases: BatchTestCase[],
  category: ParsedArgs["category"],
  caseIds: string[],
) {
  const categoryFiltered =
    category === "ALL"
      ? cases
      : cases.filter((testCase) => testCase.category === category);

  if (caseIds.length === 0) {
    return categoryFiltered;
  }

  const caseIdSet = new Set(caseIds);
  return categoryFiltered.filter((testCase) => caseIdSet.has(testCase.id.toUpperCase()));
}

async function runSingleCase(input: {
  testCase: BatchTestCase;
  hardRules: HardRulesConfig;
  baseUrl: string;
  cookieHeader: string;
  personaId: string;
  promptVersion: string | null;
  modelProviderId: string | null;
}) {
  const setupMessages = input.testCase.setup_messages ?? [];
  const setupStrategy = input.testCase.setup_strategy || "same_session";
  const startedAt = Date.now();
  let sessionId: string | null = null;
  let setupSessionId: string | null = null;

  try {
    if (setupMessages.length > 0 && setupStrategy === "previous_session") {
      setupSessionId = await createSession(
        input.baseUrl,
        input.cookieHeader,
        input.personaId,
      );

      for (const message of setupMessages) {
        await sendChatMessage({
          baseUrl: input.baseUrl,
          cookieHeader: input.cookieHeader,
          personaId: input.personaId,
          sessionId: setupSessionId,
          message,
          promptVersion: input.promptVersion,
          modelProviderId: input.modelProviderId,
        });
      }

      sessionId = await createSession(
        input.baseUrl,
        input.cookieHeader,
        input.personaId,
      );
    } else {
      sessionId = await createSession(
        input.baseUrl,
        input.cookieHeader,
        input.personaId,
      );
    }

    if (setupMessages.length > 0 && setupStrategy === "same_session") {
      for (const message of setupMessages) {
        await sendChatMessage({
          baseUrl: input.baseUrl,
          cookieHeader: input.cookieHeader,
          personaId: input.personaId,
          sessionId,
          message,
          promptVersion: input.promptVersion,
          modelProviderId: input.modelProviderId,
        });
      }
    }

    const response = await sendChatMessage({
      baseUrl: input.baseUrl,
      cookieHeader: input.cookieHeader,
      personaId: input.personaId,
      sessionId,
      message: input.testCase.input,
      promptVersion: input.promptVersion,
      modelProviderId: input.modelProviderId,
    });

    const checks = buildChecks(response.reply, input.hardRules);
    const passed = didPassAllChecks(checks);

    return {
      id: input.testCase.id,
      category: input.testCase.category,
      category_label: input.testCase.category_label,
      persona_id: input.personaId,
      input: input.testCase.input,
      expectation: input.testCase.expectation,
      prerequisite: input.testCase.prerequisite,
      prompt_version: input.promptVersion,
      model_provider_id: response.model_provider_id ?? input.modelProviderId,
      session_id: response.session_id || sessionId,
      setup_session_id: setupSessionId,
      setup_messages: setupMessages,
      reply: response.reply,
      reply_length: countCharacters(response.reply),
      duration_ms: Date.now() - startedAt,
      passed,
      checks,
      error: null,
    } satisfies CaseResult;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error.";

    return {
      id: input.testCase.id,
      category: input.testCase.category,
      category_label: input.testCase.category_label,
      persona_id: input.personaId,
      input: input.testCase.input,
      expectation: input.testCase.expectation,
      prerequisite: input.testCase.prerequisite,
      prompt_version: input.promptVersion,
      model_provider_id: input.modelProviderId,
      session_id: sessionId,
      setup_session_id: setupSessionId,
      setup_messages: setupMessages,
      reply: "",
      reply_length: 0,
      duration_ms: Date.now() - startedAt,
      passed: false,
      checks: {
        non_empty: { pass: false },
        length: { pass: false, actual: 0, limit: input.hardRules.max_reply_length },
        blacklist: { pass: false, matches: [] },
        markdown: { pass: false, matches: [] },
        ai_identity: { pass: false, matches: [] },
        list_numbering: { pass: false, matches: [] },
      },
      error: message,
    } satisfies CaseResult;
  }
}

async function main() {
  const repoRoot = process.cwd();
  await loadEnv(repoRoot);

  const args = parseArgs(process.argv.slice(2));
  const config = await loadConfig(repoRoot);
  const cases = filterCases(config.cases, args.category, args.caseIds);

  if (cases.length === 0) {
    throw new Error("No test cases matched the requested filters.");
  }

  let personaId = args.personaId;

  if (!personaId && cases.some((testCase) => !testCase.persona_id)) {
    console.log("No persona specified, auto-selecting first active persona...");
    personaId = await fetchFirstActivePersona();
    if (!personaId) {
      console.error("No active personas found in database.");
      console.error("Please create an active persona or specify one with --persona [ID].");
      process.exit(1);
    }
    console.log(`Auto-selected persona: ${personaId}`);
  }

  const cookieHeader = await login(args.baseUrl);
  const results: CaseResult[] = [];

  for (const [index, testCase] of cases.entries()) {
    const effectivePersonaId = personaId || testCase.persona_id;
    if (!effectivePersonaId) {
      throw new Error(
        `Case ${testCase.id} is missing persona_id and no --persona override was provided.`,
      );
    }

    const result = await runSingleCase({
      testCase,
      hardRules: config.hard_rules,
      baseUrl: args.baseUrl,
      cookieHeader,
      personaId: effectivePersonaId,
      promptVersion: args.promptVersion,
      modelProviderId: args.modelProviderId,
    });

    results.push(result);

    const status = result.passed ? "PASS" : "FAIL";
    const suffix = result.error ? ` error=${result.error}` : ` ${result.duration_ms}ms`;
    console.log(`[${index + 1}/${cases.length}] ${status} ${result.id}${suffix}`);
  }

  const passedCount = results.filter((item) => item.passed).length;
  const failedResults = results.filter((item) => !item.passed);
  const { iso, file } = getTimestampParts();
  const outputDir = path.join(repoRoot, "docs", "test-results");
  const outputPath = path.join(outputDir, `result-${file}.json`);

  await mkdir(outputDir, { recursive: true });
  await writeFile(
    outputPath,
    JSON.stringify(
      {
        generated_at: iso,
        base_url: args.baseUrl,
        persona_id: personaId,
        category: args.category,
        case_ids: args.caseIds,
        prompt_version: args.promptVersion,
        model_provider_id: args.modelProviderId,
        total: results.length,
        passed: passedCount,
        failed: failedResults.length,
        pass_rate: Number(((passedCount / results.length) * 100).toFixed(2)),
        results,
      },
      null,
      2,
    ),
    "utf8",
  );

  console.log("");
  console.log("Summary");
  console.log(`- Total: ${results.length}`);
  console.log(`- Passed: ${passedCount}`);
  console.log(`- Failed: ${failedResults.length}`);
  console.log(`- Model provider: ${args.modelProviderId ?? "default"}`);
  console.log(
    `- Case filter: ${args.caseIds.length > 0 ? args.caseIds.join(", ") : "none"}`,
  );
  console.log(`- Result file: ${path.relative(repoRoot, outputPath)}`);

  if (failedResults.length > 0) {
    console.log("- Failed cases:");
    for (const item of failedResults) {
      const failedChecks = Object.entries(item.checks)
        .filter(([, result]) => !result.pass)
        .map(([name]) => name);
      const reason = item.error ? `error=${item.error}` : `checks=${failedChecks.join(",")}`;
      console.log(`  - ${item.id}: ${reason}`);
    }
    process.exitCode = 1;
  }
}

void main().catch((error) => {
  const message = error instanceof Error ? error.message : "Unknown batch test error.";
  console.error(`Batch tester failed: ${message}`);
  process.exit(1);
});
