import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

type HardRules = {
  max_reply_length: number;
  blacklist_phrases: string[];
  blacklist_regexes: string[];
  markdown_regexes: string[];
  list_numbering_regexes: string[];
  ai_identity_phrases: string[];
};

type TestCase = {
  id: string;
  category: string;
  category_label: string;
  input: string;
  expectation: string;
  prerequisite: string | null;
  persona_id?: string | null;
  setup_messages?: string[];
  setup_strategy?: "same_session" | "previous_session";
  regression?: boolean;
};

type SoftScore = {
  role_adherence: number;
  naturalness: number;
  emotional_accuracy: number;
  anti_ai_score: number;
  length_appropriate: number;
};

type DirectModelProvider = {
  providerId: string;
  apiUrl: string;
  apiKey: string;
  model: string;
};

type Persona = Record<string, string | number | null>;

type CheckResult = {
  pass: boolean;
  matches?: string[];
  actual?: number;
  limit?: number;
};

type ChatRun = {
  id: string;
  category: string;
  persona_id: string;
  input: string;
  reply: string;
  reply_length: number;
  duration_ms: number;
  checks: Record<string, CheckResult>;
};

type ScoredRun = ChatRun & {
  evaluator: string;
  scores: SoftScore;
  average_score: number;
};

const SCORE_KEYS: Array<keyof SoftScore> = [
  "role_adherence",
  "naturalness",
  "emotional_accuracy",
  "anti_ai_score",
  "length_appropriate",
];

const DEFAULT_PERSONA_ID =
  process.env.REGRESSION_TESTER_PERSONA_ID?.trim() ||
  "f9287933-a9e8-44c5-9c71-591e5449372e";
const DEFAULT_BASE_URL =
  process.env.BATCH_TESTER_BASE_URL?.trim() || "http://localhost:3000";
const DEFAULT_EMAIL =
  process.env.BATCH_TESTER_EMAIL?.trim() || "demo@ai-companion.local";
const DEFAULT_PASSWORD =
  process.env.BATCH_TESTER_PASSWORD?.trim() || "demo123456";

let nextEvalSlot = 0;

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

function parseArgs(argv: string[]) {
  let personaId = DEFAULT_PERSONA_ID;
  let promptVersion: string | null = null;
  let modelProviderId: string | null =
    process.env.BATCH_TESTER_MODEL_PROVIDER_ID?.trim() || null;
  let baseUrl = DEFAULT_BASE_URL;
  let baselinePath = path.join(process.cwd(), "docs", "eval-reports", "BASELINE.json");
  let writeBaseline = false;

  for (let i = 0; i < argv.length; i += 1) {
    const current = argv[i];
    const next = argv[i + 1];

    if (current === "--persona" && next) {
      personaId = next.trim();
      i += 1;
      continue;
    }

    if (current === "--prompt-version" && next) {
      promptVersion = next.trim();
      i += 1;
      continue;
    }

    if (current === "--model-provider" && next) {
      modelProviderId = next.trim();
      i += 1;
      continue;
    }

    if (current === "--base-url" && next) {
      baseUrl = next.trim().replace(/\/$/, "");
      i += 1;
      continue;
    }

    if (current === "--baseline" && next) {
      baselinePath = path.isAbsolute(next) ? next : path.resolve(process.cwd(), next);
      i += 1;
      continue;
    }

    if (current === "--write-baseline") {
      writeBaseline = true;
    }
  }

  return {
    personaId,
    promptVersion,
    modelProviderId,
    baseUrl: baseUrl.replace(/\/$/, ""),
    baselinePath,
    writeBaseline,
  };
}

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

function countChars(text: string) {
  return Array.from(text).length;
}

function regexMatches(text: string, patterns: string[]) {
  return patterns.filter((pattern) => new RegExp(pattern, "im").test(text));
}

function buildChecks(reply: string, rules: HardRules) {
  const text = reply.trim();
  const length = countChars(text);
  const blacklistMatches = [
    ...rules.blacklist_phrases.filter((phrase) => text.includes(phrase)),
    ...regexMatches(text, rules.blacklist_regexes),
  ];
  const markdownMatches = regexMatches(text, rules.markdown_regexes);
  const aiIdentityMatches = rules.ai_identity_phrases.filter((phrase) =>
    text.includes(phrase),
  );
  const listMatches = regexMatches(text, rules.list_numbering_regexes);

  return {
    non_empty: { pass: text.length > 0 },
    length: {
      pass: length < rules.max_reply_length,
      actual: length,
      limit: rules.max_reply_length,
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
  } satisfies Record<string, CheckResult>;
}

function allChecksPass(checks: Record<string, CheckResult>) {
  return Object.values(checks).every((item) => item.pass);
}

function summarizeFailedChecks(checks: Record<string, CheckResult>) {
  return Object.entries(checks)
    .filter(([, value]) => !value.pass)
    .map(([key, value]) => {
      if (value.matches && value.matches.length > 0) {
        return `${key}=${value.matches.join(" | ")}`;
      }

      if (typeof value.actual === "number" && typeof value.limit === "number") {
        return `${key}=${value.actual}/${value.limit}`;
      }

      return key;
    })
    .join("; ");
}

function extractCookieHeader(response: Response) {
  const setCookies =
    typeof response.headers.getSetCookie === "function"
      ? response.headers.getSetCookie()
      : (() => {
          const single = response.headers.get("set-cookie");
          return single ? [single] : [];
        })();

  return setCookies
    .map((cookie) => cookie.split(";")[0]?.trim())
    .filter(Boolean)
    .join("; ");
}

async function requestJson<T>(
  url: string,
  options: RequestInit,
  cookieHeader?: string,
) {
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
  return JSON.parse(raw) as T;
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

  const json = (await response.json()) as any;
  if (!response.ok || !json.success) {
    throw new Error(json.error?.message || "Login failed.");
  }

  const cookie = extractCookieHeader(response);
  if (!cookie) {
    throw new Error("Login returned no auth cookie.");
  }

  return cookie;
}

async function createSession(
  baseUrl: string,
  cookie: string,
  personaId: string,
  characterId: string,
) {
  const json = await requestJson<any>(
    `${baseUrl}/api/personas/${personaId}/sessions`,
    {
      method: "POST",
      body: JSON.stringify({ character_id: characterId }),
    },
    cookie,
  );

  if (!json.success || !json.data) {
    throw new Error(json.error?.message || "Failed to create session.");
  }

  return json.data.id as string;
}

async function createCharacter(baseUrl: string, cookie: string) {
  const json = await requestJson<any>(
    `${baseUrl}/api/characters`,
    {
      method: "POST",
      body: JSON.stringify({
        name: `regression-test-${Date.now()}`,
        personality: "回归测试用角色",
      }),
    },
    cookie,
  );

  if (!json.success || !json.data || !json.data.character) {
    throw new Error(json.error?.message || "Failed to create character.");
  }

  return json.data.character.id as string;
}

async function sendChat(
  baseUrl: string,
  cookie: string,
  body: Record<string, unknown>,
) {
  const json = await requestJson<any>(
    `${baseUrl}/api/chat`,
    {
      method: "POST",
      body: JSON.stringify(body),
    },
    cookie,
  );

  if (!json.success || !json.data) {
    throw new Error(json.error?.message || "Chat request failed.");
  }

  return json.data as {
    reply: string;
    session_id: string;
    model_provider_id?: string | null;
  };
}

function getDirectProviders() {
  try {
    const raw = process.env.DIRECT_MODEL_PROVIDERS?.trim();
    return raw ? (JSON.parse(raw) as DirectModelProvider[]) : [];
  } catch {
    return [];
  }
}

async function generateEvaluatorText(input: {
  system: string;
  prompt: string;
  model?: string;
  modelProviderId?: string | null;
}) {
  if (input.modelProviderId) {
    const provider = getDirectProviders().find(
      (item) => item.providerId === input.modelProviderId,
    );
    if (!provider) {
      throw new Error(`Unknown model provider: ${input.modelProviderId}`);
    }

    const response = await fetch(
      `${provider.apiUrl.replace(/\/$/, "")}/v1/chat/completions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${provider.apiKey}`,
        },
        body: JSON.stringify({
          model: input.model || provider.model,
          temperature: 0,
          max_tokens: 220,
          messages: [
            { role: "system", content: input.system },
            { role: "user", content: input.prompt },
          ],
        }),
      },
    );

    const json = (await response.json()) as any;
    const content = json.choices?.[0]?.message?.content;
    if (typeof content === "string") {
      return content.trim();
    }
    if (Array.isArray(content)) {
      return content.map((item: any) => item?.text || "").join("").trim();
    }
    throw new Error("Fallback evaluator returned empty content.");
  }

  const apiKey = process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN;
  if (!apiKey) {
    throw new Error("Missing ANTHROPIC_API_KEY or ANTHROPIC_AUTH_TOKEN.");
  }

  const response = await fetch(
    `${(process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com").replace(/\/$/, "")}/v1/messages`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model:
          input.model ||
          process.env.ANTHROPIC_DEFAULT_HAIKU_MODEL ||
          process.env.ANTHROPIC_HAIKU_MODEL ||
          "claude-haiku-4-5",
        max_tokens: 220,
        temperature: 0,
        system: input.system,
        messages: [{ role: "user", content: input.prompt }],
      }),
    },
  );

  const json = (await response.json()) as any;
  const text = (json.content || [])
    .map((item: any) => (typeof item === "string" ? item : item?.text || ""))
    .join("")
    .trim();

  if (!text) {
    throw new Error("Anthropic evaluator returned empty content.");
  }

  return text;
}

function parseScoreText(text: string): SoftScore {
  const trimmed = text.trim();

  try {
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]+?)```/i);
    const candidate = fenced?.[1]?.trim() || trimmed;
    const objectText = candidate.match(/\{[\s\S]*\}/)?.[0] || candidate;
    const parsed = JSON.parse(objectText) as any;

    return {
      role_adherence: Math.max(1, Math.min(5, Math.round(Number(parsed.role_adherence)))),
      naturalness: Math.max(1, Math.min(5, Math.round(Number(parsed.naturalness)))),
      emotional_accuracy: Math.max(
        1,
        Math.min(5, Math.round(Number(parsed.emotional_accuracy))),
      ),
      anti_ai_score: Math.max(1, Math.min(5, Math.round(Number(parsed.anti_ai_score)))),
      length_appropriate: Math.max(
        1,
        Math.min(5, Math.round(Number(parsed.length_appropriate))),
      ),
    };
  } catch {
    const keyed = Object.fromEntries(
      SCORE_KEYS.map((key) => [
        key,
        trimmed.match(new RegExp(`${key}\\s*["']?\\s*[:=]\\s*([1-5])`, "i"))?.[1] || null,
      ]),
    ) as Record<keyof SoftScore, string | null>;

    if (SCORE_KEYS.every((key) => keyed[key])) {
      return Object.fromEntries(
        SCORE_KEYS.map((key) => [key, Number(keyed[key])]),
      ) as SoftScore;
    }

    const numbers = Array.from(trimmed.matchAll(/\b([1-5])\b/g)).map((match) =>
      Number(match[1]),
    );
    if (numbers.length >= 5) {
      return {
        role_adherence: numbers[0],
        naturalness: numbers[1],
        emotional_accuracy: numbers[2],
        anti_ai_score: numbers[3],
        length_appropriate: numbers[4],
      };
    }

    throw new Error(`Evaluator did not return valid JSON: ${trimmed.slice(0, 240)}`);
  }
}

function averageScore(scores: SoftScore) {
  return Number(
    (
      SCORE_KEYS.reduce((sum, key) => sum + scores[key], 0) / SCORE_KEYS.length
    ).toFixed(2),
  );
}

async function fetchPersonas(ids: string[]) {
  if (ids.length === 0) {
    return new Map<string, Persona>();
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error("Missing Supabase env vars.");
  }

  const supabase = createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const { data, error } = await supabase
    .from("personas")
    .select(
      "id,name,age,occupation,city,personality,speaking_style,background_story,hobbies,daily_habits,family_info,default_relationship,emotional_traits,quirks",
    )
    .in("id", ids);

  if (error) {
    throw new Error(`Failed to load personas: ${error.message}`);
  }

  return new Map(
    ((data || []) as unknown as Persona[]).map((item) => [String(item.id), item]),
  );
}

function buildPersonaDescription(persona: Persona | null) {
  if (!persona) {
    return "Persona data missing.";
  }

  return [
    persona.name,
    persona.age ? `${persona.age} years old` : null,
    persona.occupation,
    persona.city ? `Lives in ${persona.city}` : null,
    persona.default_relationship ? `Relationship: ${persona.default_relationship}` : null,
    persona.personality ? `Personality: ${persona.personality}` : null,
    persona.speaking_style ? `Speaking style: ${persona.speaking_style}` : null,
    persona.emotional_traits ? `Emotional traits: ${persona.emotional_traits}` : null,
    persona.quirks ? `Quirks: ${persona.quirks}` : null,
    persona.hobbies ? `Hobbies: ${persona.hobbies}` : null,
    persona.daily_habits ? `Daily habits: ${persona.daily_habits}` : null,
    persona.family_info ? `Family info: ${persona.family_info}` : null,
    persona.background_story ? `Background: ${persona.background_story}` : null,
  ]
    .filter(Boolean)
    .join("; ");
}

async function evaluate(run: ChatRun, personas: Map<string, Persona>) {
  const prompt = [
    "You are evaluating a persona-based companion AI reply.",
    `Persona description: ${buildPersonaDescription(personas.get(run.persona_id) || null)}`,
    `User message: ${run.input}`,
    `AI reply: ${run.reply}`,
    'Return JSON only: {"role_adherence":X,"naturalness":X,"emotional_accuracy":X,"anti_ai_score":X,"length_appropriate":X}',
  ].join("\n");

  const fallbackProviderId =
    process.env.AUTO_EVAL_FALLBACK_MODEL_PROVIDER_ID?.trim() ||
    (getDirectProviders().find((provider) => provider.providerId === "direct-model-gpt54")
      ?.providerId ??
      null);

  const requestGap = Number(process.env.AUTO_EVAL_MIN_INTERVAL_MS || 2100);
  const retryDelay = Number(process.env.AUTO_EVAL_RETRY_DELAY_MS || 12000);
  const maxAttempts = Number(process.env.AUTO_EVAL_MAX_RETRIES || 4);
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const now = Date.now();
    const slot = Math.max(now, nextEvalSlot);
    nextEvalSlot = slot + requestGap;

    if (slot > now) {
      await new Promise((resolve) => setTimeout(resolve, slot - now));
    }

    try {
      const text = await generateEvaluatorText({
        system: "Return valid JSON only.",
        prompt,
      });
      const scores = parseScoreText(text);
      return {
        evaluator: `anthropic:${process.env.ANTHROPIC_DEFAULT_HAIKU_MODEL || process.env.ANTHROPIC_HAIKU_MODEL || "claude-haiku-4-5"}`,
        scores,
        average_score: averageScore(scores),
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Unknown evaluation error.");
    }

    if (fallbackProviderId) {
      try {
        const text = await generateEvaluatorText({
          system: "Return valid JSON only.",
          prompt,
          modelProviderId: fallbackProviderId,
        });
        const scores = parseScoreText(text);
        return {
          evaluator: `fallback:${fallbackProviderId}`,
          scores,
          average_score: averageScore(scores),
        };
      } catch (error) {
        lastError =
          error instanceof Error ? error : new Error("Unknown fallback evaluation error.");
      }
    }

    if (attempt < maxAttempts) {
      await new Promise((resolve) =>
        setTimeout(resolve, /429/.test(lastError?.message || "") ? retryDelay * attempt : 1500),
      );
    }
  }

  throw lastError || new Error("Unknown evaluation error.");
}

function computeAverages(items: ScoredRun[]) {
  return Object.fromEntries(
    SCORE_KEYS.map((key) => [
      key,
      Number(
        (
          items.reduce((sum, item) => sum + item.scores[key], 0) /
          Math.max(items.length, 1)
        ).toFixed(2),
      ),
    ]),
  ) as SoftScore;
}

function formatAverages(scores: SoftScore) {
  return `role=${scores.role_adherence.toFixed(2)}, natural=${scores.naturalness.toFixed(2)}, emotion=${scores.emotional_accuracy.toFixed(2)}, anti_ai=${scores.anti_ai_score.toFixed(2)}, length=${scores.length_appropriate.toFixed(2)}`;
}

function normalizeBaseline(raw: unknown) {
  const record = (raw || {}) as Record<string, unknown>;
  const averages = (record.averages || record.averageScores || {}) as Record<string, unknown>;

  return {
    evaluator:
      typeof record.evaluator === "string"
        ? record.evaluator
        : typeof record.version === "string"
          ? record.version
          : "legacy-baseline",
    averages: {
      role_adherence: Number(averages.role_adherence || 0),
      naturalness: Number(averages.naturalness || 0),
      emotional_accuracy: Number(averages.emotional_accuracy || 0),
      anti_ai_score: Number(averages.anti_ai_score || 0),
      length_appropriate: Number(averages.length_appropriate || 0),
    } satisfies SoftScore,
  };
}

async function writeRegressionReport(input: {
  repoRoot: string;
  status: "PASS" | "FAIL";
  args: ReturnType<typeof parseArgs>;
  evaluator?: string;
  baselineEvaluator?: string;
  baselinePath: string;
  baselineAverages?: SoftScore | null;
  currentAverages?: SoftScore | null;
  degraded?: Array<{ key: keyof SoftScore; current: number; baseline: number; delta: number }>;
  scoredRuns?: ScoredRun[];
  chatRuns?: ChatRun[];
  hardFailure?: { caseId: string; reason: string } | null;
  note?: string | null;
}) {
  const { iso, file } = getTimestampParts();
  const outputDir = path.join(input.repoRoot, "docs", "eval-reports");
  const outputPath = path.join(outputDir, `regression-report-${file}.md`);
  const lines = [
    "# Regression Report",
    "",
    `- Generated at: ${iso}`,
    `- Status: ${input.status}`,
    `- Persona: ${input.args.personaId}`,
    `- Prompt version: ${input.args.promptVersion ?? "default"}`,
    `- Model provider: ${input.args.modelProviderId ?? "default"}`,
    `- Baseline file: ${path.relative(input.repoRoot, input.baselinePath)}`,
    `- Evaluator: ${input.evaluator ?? "n/a"}`,
    `- Baseline evaluator: ${input.baselineEvaluator ?? "n/a"}`,
  ];

  if (input.note) {
    lines.push(`- Note: ${input.note}`);
  }

  if (input.currentAverages) {
    lines.push(`- Current averages: ${formatAverages(input.currentAverages)}`);
  }

  if (input.baselineAverages) {
    lines.push(`- Baseline averages: ${formatAverages(input.baselineAverages)}`);
  }

  if (input.hardFailure) {
    lines.push(`- Hard failure: ${input.hardFailure.caseId} ${input.hardFailure.reason}`);
  }

  lines.push("");

  if (input.degraded && input.degraded.length > 0) {
    lines.push("## Degraded Dimensions", "");
    for (const item of input.degraded) {
      lines.push(
        `- ${item.key}: baseline=${item.baseline.toFixed(2)} current=${item.current.toFixed(2)} delta=${item.delta.toFixed(2)}`,
      );
    }
    lines.push("");
  }

  if (input.scoredRuns && input.scoredRuns.length > 0) {
    lines.push("## Scored Cases", "");
    lines.push("| Case | Category | Avg | Evaluator | Reply Length |");
    lines.push("| --- | --- | ---: | --- | ---: |");
    for (const run of input.scoredRuns) {
      lines.push(
        `| ${run.id} | ${run.category} | ${run.average_score.toFixed(2)} | ${run.evaluator} | ${run.reply_length} |`,
      );
    }
    lines.push("");
  } else if (input.chatRuns && input.chatRuns.length > 0) {
    lines.push("## Completed Cases Before Exit", "");
    lines.push("| Case | Category | Reply Length | Duration (ms) |");
    lines.push("| --- | --- | ---: | ---: |");
    for (const run of input.chatRuns) {
      lines.push(
        `| ${run.id} | ${run.category} | ${run.reply_length} | ${run.duration_ms} |`,
      );
    }
    lines.push("");
  }

  await mkdir(outputDir, { recursive: true });
  await writeFile(outputPath, `${lines.join("\n")}\n`, "utf8");
  return outputPath;
}

async function main() {
  const repoRoot = process.cwd();
  const args = parseArgs(process.argv.slice(2));
  await loadEnv(repoRoot);

  const config = JSON.parse(
    await readFile(path.join(repoRoot, "docs", "TEST_CASES.json"), "utf8"),
  ) as { hard_rules: HardRules; cases: TestCase[] };
  const cases = config.cases.filter((item) => item.regression === true);

  if (cases.length === 0) {
    throw new Error("No regression=true cases found in docs/TEST_CASES.json.");
  }

  const cookie = await login(args.baseUrl);
  const characterId = await createCharacter(args.baseUrl, cookie);
  const runs: ChatRun[] = [];

  for (let index = 0; index < cases.length; index += 1) {
    const testCase = cases[index];
    const personaId = testCase.persona_id?.trim() || args.personaId;
    const startedAt = Date.now();
    let sessionId: string | null = null;

    try {
      const setupMessages = testCase.setup_messages || [];

      if (setupMessages.length > 0 && testCase.setup_strategy === "previous_session") {
        const setupSessionId = await createSession(
          args.baseUrl,
          cookie,
          personaId,
          characterId,
        );
        for (const message of setupMessages) {
          await sendChat(args.baseUrl, cookie, {
            persona_id: personaId,
            session_id: setupSessionId,
            character_id: characterId,
            message,
            prompt_version_id: args.promptVersion,
            model_provider_id: args.modelProviderId,
          });
        }
        sessionId = await createSession(args.baseUrl, cookie, personaId, characterId);
      } else {
        sessionId = await createSession(args.baseUrl, cookie, personaId, characterId);
      }

      if (setupMessages.length > 0 && testCase.setup_strategy !== "previous_session") {
        for (const message of setupMessages) {
          await sendChat(args.baseUrl, cookie, {
            persona_id: personaId,
            session_id: sessionId,
            character_id: characterId,
            message,
            prompt_version_id: args.promptVersion,
            model_provider_id: args.modelProviderId,
          });
        }
      }

      const chat = await sendChat(args.baseUrl, cookie, {
        persona_id: personaId,
        session_id: sessionId,
        character_id: characterId,
        message: testCase.input,
        prompt_version_id: args.promptVersion,
        model_provider_id: args.modelProviderId,
      });

      const checks = buildChecks(chat.reply, config.hard_rules);
      const run: ChatRun = {
        id: testCase.id,
        category: testCase.category,
        persona_id: personaId,
        input: testCase.input,
        reply: chat.reply,
        reply_length: countChars(chat.reply),
        duration_ms: Date.now() - startedAt,
        checks,
      };

      if (!allChecksPass(checks)) {
        const reportPath = await writeRegressionReport({
          repoRoot,
          status: "FAIL",
          args,
          baselinePath: args.baselinePath,
          chatRuns: [...runs, run],
          hardFailure: {
            caseId: run.id,
            reason: summarizeFailedChecks(checks),
          },
          note: "Stopped immediately because a hard check failed.",
        });
        console.error(
          `[${index + 1}/${cases.length}] FAIL ${run.id} ${summarizeFailedChecks(checks)}`,
        );
        console.error(`- Report file: ${path.relative(repoRoot, reportPath)}`);
        console.error("REGRESSION FAIL: hard check failed, stopped immediately.");
        process.exit(1);
      }

      runs.push(run);
      console.log(`[${index + 1}/${cases.length}] PASS ${run.id} ${run.duration_ms}ms`);
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Unknown error";
      const reportPath = await writeRegressionReport({
        repoRoot,
        status: "FAIL",
        args,
        baselinePath: args.baselinePath,
        chatRuns: runs,
        hardFailure: {
          caseId: testCase.id,
          reason,
        },
        note: "Stopped immediately because execution failed before completion.",
      });
      console.error(
        `[${index + 1}/${cases.length}] FAIL ${testCase.id} ${reason}`,
      );
      console.error(`- Report file: ${path.relative(repoRoot, reportPath)}`);
      console.error("REGRESSION FAIL: hard check failed, stopped immediately.");
      process.exit(1);
    }
  }

  const personas = await fetchPersonas(Array.from(new Set(runs.map((item) => item.persona_id))));
  const scored: ScoredRun[] = [];

  for (let index = 0; index < runs.length; index += 1) {
    const run = runs[index];
    const evaluation = await evaluate(run, personas);
    const merged: ScoredRun = { ...run, ...evaluation };
    scored.push(merged);
    console.log(
      `[score ${index + 1}/${runs.length}] ${run.id} avg=${merged.average_score.toFixed(2)} via=${merged.evaluator}`,
    );
  }

  const averages = computeAverages(scored);
  const evaluator = Array.from(new Set(scored.map((item) => item.evaluator))).join(", ");
  const baselinePayload = {
    generated_at: new Date().toISOString(),
    persona_id: args.personaId,
    prompt_version: args.promptVersion,
    model_provider_id: args.modelProviderId,
    total_cases: scored.length,
    evaluator,
    averages,
    cases: scored,
  };

  if (args.writeBaseline) {
    await mkdir(path.dirname(args.baselinePath), { recursive: true });
    await writeFile(args.baselinePath, JSON.stringify(baselinePayload, null, 2), "utf8");
    const reportPath = await writeRegressionReport({
      repoRoot,
      status: "PASS",
      args,
      evaluator,
      baselineEvaluator: evaluator,
      baselinePath: args.baselinePath,
      baselineAverages: averages,
      currentAverages: averages,
      scoredRuns: scored,
      note: "Baseline file was refreshed during this run.",
    });
    console.log(
      `REGRESSION PASS: baseline written to ${path.relative(repoRoot, args.baselinePath)}`,
    );
    console.log(`- Report file: ${path.relative(repoRoot, reportPath)}`);
    console.log(`- Evaluator: ${evaluator}`);
    console.log(`- Averages: ${formatAverages(averages)}`);
    return;
  }

  const baseline = normalizeBaseline(
    JSON.parse(await readFile(args.baselinePath, "utf8")),
  );

  const degraded = SCORE_KEYS.map((key) => ({
    key,
    current: averages[key],
    baseline: baseline.averages[key],
    delta: Number((averages[key] - baseline.averages[key]).toFixed(2)),
  })).filter((item) => item.delta < -0.3);

  console.log("");
  console.log("Regression summary");
  console.log(`- Cases: ${scored.length}`);
  console.log(`- Persona: ${args.personaId}`);
  console.log(`- Prompt version: ${args.promptVersion ?? "default"}`);
  console.log(`- Model provider: ${args.modelProviderId ?? "default"}`);
  console.log(`- Evaluator: ${evaluator}`);
  console.log(`- Baseline evaluator: ${baseline.evaluator}`);
  console.log(`- Baseline: ${path.relative(repoRoot, args.baselinePath)}`);
  console.log(`- Current averages: ${formatAverages(averages)}`);
  console.log(`- Baseline averages: ${formatAverages(baseline.averages)}`);

  if (degraded.length > 0) {
    const reportPath = await writeRegressionReport({
      repoRoot,
      status: "FAIL",
      args,
      evaluator,
      baselineEvaluator: baseline.evaluator,
      baselinePath: args.baselinePath,
      baselineAverages: baseline.averages,
      currentAverages: averages,
      degraded,
      scoredRuns: scored,
      note: "One or more dimensions dropped by more than 0.3.",
    });
    for (const item of degraded) {
      console.error(
        `ALERT ${item.key} baseline=${item.baseline.toFixed(2)} current=${item.current.toFixed(2)} delta=${item.delta.toFixed(2)}`,
      );
    }
    console.error(`- Report file: ${path.relative(repoRoot, reportPath)}`);
    console.error("REGRESSION FAIL");
    process.exit(1);
  }

  const reportPath = await writeRegressionReport({
    repoRoot,
    status: "PASS",
    args,
    evaluator,
    baselineEvaluator: baseline.evaluator,
    baselinePath: args.baselinePath,
    baselineAverages: baseline.averages,
    currentAverages: averages,
    scoredRuns: scored,
  });
  console.log(`- Report file: ${path.relative(repoRoot, reportPath)}`);
  console.log("REGRESSION PASS");
}

void main().catch((error) => {
  const message = error instanceof Error ? error.message : "Unknown regression error.";
  console.error(`REGRESSION FAIL: ${message}`);
  process.exit(1);
});
