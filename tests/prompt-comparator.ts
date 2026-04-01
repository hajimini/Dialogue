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

type ConfigArgs = {
  personaId: string;
  promptVersion: string | null;
  label: string | null;
};

type ParsedArgs = {
  versionA: ConfigArgs;
  versionB: ConfigArgs;
  categories: Array<BatchTestCase["category"]>;
  baseUrl: string;
  modelProviderId: string | null;
};

type CheckResult = {
  pass: boolean;
  matches?: string[];
  actual?: number;
  limit?: number;
};

type HardCheckBundle = {
  non_empty: CheckResult;
  length: CheckResult;
  blacklist: CheckResult;
  markdown: CheckResult;
  ai_identity: CheckResult;
  list_numbering: CheckResult;
};

type VersionReplyResult = {
  label: string;
  persona_id: string;
  prompt_version: string | null;
  model_provider_id: string | null;
  session_id: string | null;
  setup_session_id: string | null;
  reply: string;
  reply_length: number;
  duration_ms: number;
  passed: boolean;
  checks: HardCheckBundle;
  error: string | null;
};

type ComparisonCaseResult = {
  id: string;
  category: string;
  category_label: string;
  input: string;
  expectation: string;
  prerequisite: string | null;
  version_a: VersionReplyResult;
  version_b: VersionReplyResult;
  verdict: string;
};

const DEFAULT_BASE_URL =
  process.env.BATCH_TESTER_BASE_URL?.trim() || "http://localhost:3000";
const DEFAULT_EMAIL =
  process.env.BATCH_TESTER_EMAIL?.trim() || "demo@ai-companion.local";
const DEFAULT_PASSWORD =
  process.env.BATCH_TESTER_PASSWORD?.trim() || "demo123456";
const DEFAULT_CATEGORIES: Array<BatchTestCase["category"]> = ["A", "B"];

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

async function fetchActivePersonas(limit: number): Promise<string[]> {
  const sslMode = (process.env.POSTGRES_SSL ?? "require").toLowerCase();
  const pool = new Pool({
    connectionString: getDatabaseUrl(),
    ssl: sslMode === "disable" ? false : { rejectUnauthorized: false },
  });

  try {
    const result = await pool.query<{ id: string }>(
      "select id from personas where is_active = true order by created_at asc nulls last limit $1",
      [limit],
    );
    return result.rows.map((row) => row.id);
  } finally {
    await pool.end();
  }
}

async function parseArgs(argv: string[]): Promise<ParsedArgs> {
  let personaA = "";
  let personaB = "";
  let promptVersionA: string | null = null;
  let promptVersionB: string | null = null;
  let labelA: string | null = null;
  let labelB: string | null = null;
  let categories = [...DEFAULT_CATEGORIES];
  let baseUrl = DEFAULT_BASE_URL;
  let modelProviderId: string | null =
    process.env.BATCH_TESTER_MODEL_PROVIDER_ID?.trim() || null;

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    const next = argv[index + 1];

    if (!next && current !== "--all-categories") {
      continue;
    }

    if (current === "--persona-a" && next) {
      personaA = next.trim();
      index += 1;
      continue;
    }

    if (current === "--persona-b" && next) {
      personaB = next.trim();
      index += 1;
      continue;
    }

    if (current === "--prompt-version-a" && next) {
      promptVersionA = next.trim();
      index += 1;
      continue;
    }

    if (current === "--prompt-version-b" && next) {
      promptVersionB = next.trim();
      index += 1;
      continue;
    }

    if (current === "--label-a" && next) {
      labelA = next.trim();
      index += 1;
      continue;
    }

    if (current === "--label-b" && next) {
      labelB = next.trim();
      index += 1;
      continue;
    }

    if (current === "--categories" && next) {
      const parsed = next
        .split(",")
        .map((item) => item.trim().toUpperCase())
        .filter(Boolean);

      if (parsed.includes("ALL")) {
        categories = ["A", "B", "C", "D", "E", "F"];
      } else {
        const valid = parsed.filter((item): item is BatchTestCase["category"] =>
          ["A", "B", "C", "D", "E", "F"].includes(item),
        );
        if (valid.length === 0) {
          throw new Error(`Unsupported categories: ${next}`);
        }
        categories = valid;
      }

      index += 1;
      continue;
    }

    if (current === "--all-categories") {
      categories = ["A", "B", "C", "D", "E", "F"];
      continue;
    }

    if (current === "--base-url" && next) {
      baseUrl = next.trim().replace(/\/$/, "");
      index += 1;
      continue;
    }

    if (current === "--model-provider" && next) {
      modelProviderId = next.trim();
      index += 1;
    }
  }

  if (!personaA || !personaB) {
    console.log("No personas specified, auto-selecting two active personas...");
    const activePersonas = await fetchActivePersonas(2);

    if (activePersonas.length < 2) {
      console.error(`Found only ${activePersonas.length} active persona(s) in database.`);
      console.error("Please create at least 2 active personas or specify them with --persona-a and --persona-b.");
      process.exit(1);
    }

    personaA = personaA || activePersonas[0];
    personaB = personaB || activePersonas[1];
    console.log(`Auto-selected personas: A=${personaA}, B=${personaB}`);
  }

  return {
    versionA: {
      personaId: personaA,
      promptVersion: promptVersionA,
      label: labelA,
    },
    versionB: {
      personaId: personaB,
      promptVersion: promptVersionB,
      label: labelB,
    },
    categories,
    baseUrl: baseUrl.replace(/\/$/, ""),
    modelProviderId,
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

function buildChecks(reply: string, hardRules: HardRulesConfig): HardCheckBundle {
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

function didPassAllChecks(checks: HardCheckBundle) {
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
  const filePath = path.join(repoRoot, "docs", "TEST_CASES.json");
  const content = await readFile(filePath, "utf8");
  return JSON.parse(content) as BatchCasesConfig;
}

function filterCases(
  cases: BatchTestCase[],
  categories: Array<BatchTestCase["category"]>,
) {
  return cases.filter((testCase) => categories.includes(testCase.category));
}

function buildVersionLabel(
  prefix: string,
  config: ConfigArgs,
  modelProviderId: string | null,
) {
  if (config.label) {
    return config.label;
  }

  const parts = [
    prefix,
    `persona=${config.personaId}`,
    `prompt=${config.promptVersion || "active"}`,
    `model=${modelProviderId || "default"}`,
  ];

  return parts.join(" | ");
}

async function runSingleVersionCase(input: {
  testCase: BatchTestCase;
  hardRules: HardRulesConfig;
  baseUrl: string;
  cookieHeader: string;
  personaId: string;
  promptVersion: string | null;
  modelProviderId: string | null;
  label: string;
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
      label: input.label,
      persona_id: input.personaId,
      prompt_version: input.promptVersion,
      model_provider_id: response.model_provider_id ?? input.modelProviderId,
      session_id: response.session_id || sessionId,
      setup_session_id: setupSessionId,
      reply: response.reply,
      reply_length: countCharacters(response.reply),
      duration_ms: Date.now() - startedAt,
      passed,
      checks,
      error: null,
    } satisfies VersionReplyResult;
  } catch (error) {
    return {
      label: input.label,
      persona_id: input.personaId,
      prompt_version: input.promptVersion,
      model_provider_id: input.modelProviderId,
      session_id: sessionId,
      setup_session_id: setupSessionId,
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
      error: error instanceof Error ? error.message : "Unknown error.",
    } satisfies VersionReplyResult;
  }
}

function getFailedCheckNames(checks: HardCheckBundle) {
  return Object.entries(checks)
    .filter(([, result]) => !result.pass)
    .map(([name]) => name);
}

function humanizeFailedChecks(checks: HardCheckBundle, error: string | null) {
  if (error) {
    return `请求失败: ${error}`;
  }

  const failedChecks = getFailedCheckNames(checks);
  if (failedChecks.length === 0) {
    return "通过";
  }

  const labels: Record<string, string> = {
    non_empty: "空回复",
    length: "长度超限",
    blacklist: "AI套话/黑名单",
    markdown: "Markdown格式",
    ai_identity: "AI身份泄露",
    list_numbering: "列表序号",
  };

  return failedChecks.map((item) => labels[item] || item).join("、");
}

function buildVerdict(versionA: VersionReplyResult, versionB: VersionReplyResult) {
  if (versionA.passed && !versionB.passed) {
    return `${versionA.label} 更稳：${versionA.label} 通过 / ${versionB.label} 失败（${humanizeFailedChecks(versionB.checks, versionB.error)}）`;
  }

  if (!versionA.passed && versionB.passed) {
    return `${versionB.label} 更稳：${versionA.label} 失败（${humanizeFailedChecks(versionA.checks, versionA.error)}） / ${versionB.label} 通过`;
  }

  if (!versionA.passed && !versionB.passed) {
    return `两边都失败：${versionA.label}（${humanizeFailedChecks(versionA.checks, versionA.error)}） / ${versionB.label}（${humanizeFailedChecks(versionB.checks, versionB.error)}）`;
  }

  if (versionA.reply === versionB.reply) {
    return "两边都通过，且回复相同。";
  }

  return `两边都通过，建议人工比较：${versionA.label} ${versionA.reply_length}字 / ${versionB.label} ${versionB.reply_length}字`;
}

function buildSummary(results: ComparisonCaseResult[]) {
  let versionAPass = 0;
  let versionBPass = 0;
  let versionAOnlyWins = 0;
  let versionBOnlyWins = 0;
  let bothPass = 0;
  let bothFail = 0;
  let versionALatencyTotal = 0;
  let versionBLatencyTotal = 0;
  let versionALengthTotal = 0;
  let versionBLengthTotal = 0;

  for (const item of results) {
    versionALatencyTotal += item.version_a.duration_ms;
    versionBLatencyTotal += item.version_b.duration_ms;
    versionALengthTotal += item.version_a.reply_length;
    versionBLengthTotal += item.version_b.reply_length;

    if (item.version_a.passed) versionAPass += 1;
    if (item.version_b.passed) versionBPass += 1;

    if (item.version_a.passed && item.version_b.passed) {
      bothPass += 1;
    } else if (!item.version_a.passed && !item.version_b.passed) {
      bothFail += 1;
    } else if (item.version_a.passed) {
      versionAOnlyWins += 1;
    } else if (item.version_b.passed) {
      versionBOnlyWins += 1;
    }
  }

  const caseCount = Math.max(results.length, 1);

  return {
    total: results.length,
    versionAPass,
    versionBPass,
    versionAOnlyWins,
    versionBOnlyWins,
    bothPass,
    bothFail,
    versionAAvgLatency: Number((versionALatencyTotal / caseCount).toFixed(2)),
    versionBAvgLatency: Number((versionBLatencyTotal / caseCount).toFixed(2)),
    versionAAvgLength: Number((versionALengthTotal / caseCount).toFixed(2)),
    versionBAvgLength: Number((versionBLengthTotal / caseCount).toFixed(2)),
  };
}

function buildRecommendation(
  summary: ReturnType<typeof buildSummary>,
  labelA: string,
  labelB: string,
) {
  if (summary.versionAPass > summary.versionBPass) {
    return `${labelA} 更好：硬性通过数更高（${summary.versionAPass} vs ${summary.versionBPass}）。`;
  }

  if (summary.versionBPass > summary.versionAPass) {
    return `${labelB} 更好：硬性通过数更高（${summary.versionBPass} vs ${summary.versionAPass}）。`;
  }

  if (summary.versionAOnlyWins > summary.versionBOnlyWins) {
    return `${labelA} 略优：总通过数相同，但单边赢面更多（${summary.versionAOnlyWins} vs ${summary.versionBOnlyWins}）。`;
  }

  if (summary.versionBOnlyWins > summary.versionAOnlyWins) {
    return `${labelB} 略优：总通过数相同，但单边赢面更多（${summary.versionBOnlyWins} vs ${summary.versionAOnlyWins}）。`;
  }

  return "两边在硬性检查层面没有明显胜负，建议重点看人工对比区里的差异回复。";
}

function escapeCell(text: string) {
  return text.replace(/\|/g, "\\|").replace(/\r?\n/g, "<br>");
}

function buildMarkdownReport(input: {
  generatedAt: string;
  labelA: string;
  labelB: string;
  categories: string[];
  summary: ReturnType<typeof buildSummary>;
  recommendation: string;
  results: ComparisonCaseResult[];
}) {
  const lines = [
    "# Prompt 对比报告",
    "",
    `- 生成时间: ${input.generatedAt}`,
    `- 版本 A: ${input.labelA}`,
    `- 版本 B: ${input.labelB}`,
    `- 测试分类: ${input.categories.join(", ")}`,
    "",
    "## 结论",
    "",
    `- ${input.recommendation}`,
    `- A 通过数: ${input.summary.versionAPass}/${input.summary.total}`,
    `- B 通过数: ${input.summary.versionBPass}/${input.summary.total}`,
    `- A 单边胜出: ${input.summary.versionAOnlyWins}`,
    `- B 单边胜出: ${input.summary.versionBOnlyWins}`,
    `- 双方都通过: ${input.summary.bothPass}`,
    `- 双方都失败: ${input.summary.bothFail}`,
    `- A 平均字数/延迟: ${input.summary.versionAAvgLength} 字 / ${input.summary.versionAAvgLatency} ms`,
    `- B 平均字数/延迟: ${input.summary.versionBAvgLength} 字 / ${input.summary.versionBAvgLatency} ms`,
    "",
    "## 逐条对比",
    "",
  ];

  for (const item of input.results) {
    lines.push(
      `### ${item.id} [${item.category}] ${item.category_label}`,
      "",
      `用户输入："${item.input}"`,
      "",
      `期待：${item.expectation}`,
    );

    if (item.prerequisite) {
      lines.push("", `前置：${item.prerequisite}`);
    }

    lines.push(
      "",
      `| ${input.labelA} | ${input.labelB} |`,
      "| --- | --- |",
      `| ${escapeCell(item.version_a.reply || "(空)")} | ${escapeCell(item.version_b.reply || "(空)")} |`,
      "",
      `硬性检查：${input.labelA} ${humanizeFailedChecks(item.version_a.checks, item.version_a.error)} / ${input.labelB} ${humanizeFailedChecks(item.version_b.checks, item.version_b.error)}`,
      "",
      `自动判断：${item.verdict}`,
      "",
    );
  }

  return lines.join("\n");
}

async function main() {
  const repoRoot = process.cwd();
  await loadEnv(repoRoot);

  const args = await parseArgs(process.argv.slice(2));
  const config = await loadConfig(repoRoot);
  const cases = filterCases(config.cases, args.categories);

  if (cases.length === 0) {
    throw new Error("No test cases matched the requested categories.");
  }

  const cookieHeader = await login(args.baseUrl);
  const labelA = buildVersionLabel("版本 A", args.versionA, args.modelProviderId);
  const labelB = buildVersionLabel("版本 B", args.versionB, args.modelProviderId);
  const results: ComparisonCaseResult[] = [];

  for (const [index, testCase] of cases.entries()) {
    const versionAResult = await runSingleVersionCase({
      testCase,
      hardRules: config.hard_rules,
      baseUrl: args.baseUrl,
      cookieHeader,
      personaId: args.versionA.personaId,
      promptVersion: args.versionA.promptVersion,
      modelProviderId: args.modelProviderId,
      label: labelA,
    });

    const versionBResult = await runSingleVersionCase({
      testCase,
      hardRules: config.hard_rules,
      baseUrl: args.baseUrl,
      cookieHeader,
      personaId: args.versionB.personaId,
      promptVersion: args.versionB.promptVersion,
      modelProviderId: args.modelProviderId,
      label: labelB,
    });

    const verdict = buildVerdict(versionAResult, versionBResult);
    results.push({
      id: testCase.id,
      category: testCase.category,
      category_label: testCase.category_label,
      input: testCase.input,
      expectation: testCase.expectation,
      prerequisite: testCase.prerequisite,
      version_a: versionAResult,
      version_b: versionBResult,
      verdict,
    });

    const statusA = versionAResult.passed ? "PASS" : "FAIL";
    const statusB = versionBResult.passed ? "PASS" : "FAIL";
    console.log(
      `[${index + 1}/${cases.length}] ${testCase.id} A=${statusA} B=${statusB}`,
    );
  }

  const summary = buildSummary(results);
  const recommendation = buildRecommendation(summary, labelA, labelB);
  const { iso, file } = getTimestampParts();
  const outputDir = path.join(repoRoot, "docs", "comparisons");
  const outputPath = path.join(outputDir, `comparison-${file}.md`);

  await mkdir(outputDir, { recursive: true });
  await writeFile(
    outputPath,
    buildMarkdownReport({
      generatedAt: iso,
      labelA,
      labelB,
      categories: args.categories,
      summary,
      recommendation,
      results,
    }),
    "utf8",
  );

  console.log("");
  console.log("Summary");
  console.log(`- Recommendation: ${recommendation}`);
  console.log(`- A pass: ${summary.versionAPass}/${summary.total}`);
  console.log(`- B pass: ${summary.versionBPass}/${summary.total}`);
  console.log(`- Comparison file: ${path.relative(repoRoot, outputPath)}`);
}

void main().catch((error) => {
  const message =
    error instanceof Error ? error.message : "Unknown prompt comparison error.";
  console.error(`Prompt comparator failed: ${message}`);
  process.exit(1);
});
