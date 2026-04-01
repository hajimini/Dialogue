import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { generateClaudeText } from "../src/lib/ai/claude.ts";

type PersonaRecord = {
  id: string;
  name: string;
  age: number | null;
  occupation: string | null;
  city: string | null;
  personality: string | null;
  speaking_style: string | null;
  background_story: string | null;
  hobbies: string | null;
  daily_habits: string | null;
  family_info: string | null;
  default_relationship: string | null;
  emotional_traits: string | null;
  quirks: string | null;
};

type BatchCaseCheck = {
  pass: boolean;
  matches?: string[];
  actual?: number;
  limit?: number;
};

type BatchCaseResult = {
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
    non_empty: BatchCaseCheck;
    length: BatchCaseCheck;
    blacklist: BatchCaseCheck;
    markdown: BatchCaseCheck;
    ai_identity: BatchCaseCheck;
    list_numbering: BatchCaseCheck;
  };
  error: string | null;
};

type BatchTestRun = {
  generated_at: string;
  base_url: string;
  persona_id: string | null;
  category: string;
  prompt_version: string | null;
  model_provider_id: string | null;
  total: number;
  passed: number;
  failed: number;
  pass_rate: number;
  results: BatchCaseResult[];
};

type SoftScore = {
  role_adherence: number;
  naturalness: number;
  emotional_accuracy: number;
  anti_ai_score: number;
  length_appropriate: number;
};

type EvaluatedCase = {
  id: string;
  category: string;
  persona_id: string;
  user_message: string;
  ai_reply: string;
  reply_length: number;
  hard_passed: boolean;
  evaluation_error: string | null;
  scores: SoftScore | null;
  average_score: number | null;
};

type EvaluatedRun = {
  label: string;
  displayLabel: string;
  resultFilePath: string;
  batchRun: BatchTestRun;
  evaluatedCases: EvaluatedCase[];
  lowScoreCases: Array<
    EvaluatedCase & {
      scores: SoftScore;
      low_dimensions: Array<keyof SoftScore>;
    }
  >;
  averages: SoftScore;
  evaluatedCount: number;
  failedEvaluationCount: number;
};

type RunSummary = {
  label: string;
  display_label: string;
  result_file: string;
  model_provider_id: string | null;
  evaluated_count: number;
  low_score_count: number;
  averages: SoftScore;
};

type ReportSnapshot = {
  generated_at: string;
  mode: "single" | "compare";
  primary: RunSummary;
  compare: RunSummary | null;
};

type ParsedArgs = {
  resultFile: string | null;
  compareFile: string | null;
};

type ComparisonDiff = {
  id: string;
  category: string;
  user_message: string;
  primary_reply: string;
  compare_reply: string;
  primary_average: number;
  compare_average: number;
  delta: number;
};

const SCORE_KEYS: Array<keyof SoftScore> = [
  "role_adherence",
  "naturalness",
  "emotional_accuracy",
  "anti_ai_score",
  "length_appropriate",
];

const SCORE_LABELS: Record<keyof SoftScore, string> = {
  role_adherence: "角色一致性",
  naturalness: "自然度",
  emotional_accuracy: "情绪回应",
  anti_ai_score: "去AI味",
  length_appropriate: "长度适配",
};

let nextAvailableRequestAt = 0;

function parseArgs(argv: string[]): ParsedArgs {
  let resultFile: string | null = null;
  let compareFile: string | null = null;

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    const next = argv[index + 1];

    if ((current === "--file" || current === "--input") && next) {
      resultFile = next.trim();
      index += 1;
      continue;
    }

    if ((current === "--compare-file" || current === "--compare") && next) {
      compareFile = next.trim();
      index += 1;
    }
  }

  return { resultFile, compareFile };
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

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toAbsolutePath(repoRoot: string, inputPath: string) {
  return path.isAbsolute(inputPath)
    ? inputPath
    : path.resolve(repoRoot, inputPath);
}

function escapeCell(text: string) {
  return text.replace(/\|/g, "\\|").replace(/\r?\n/g, "<br>");
}

function formatDelta(current: number, previous: number) {
  const delta = Number((current - previous).toFixed(2));
  return delta > 0 ? `+${delta.toFixed(2)}` : delta.toFixed(2);
}

function getModelDisplayName(modelProviderId: string | null) {
  if (!modelProviderId) {
    return "默认模型";
  }

  if (modelProviderId === "direct-model-gpt54") {
    return "gpt-5.4";
  }

  return modelProviderId;
}

function buildRunDisplayLabel(run: { model_provider_id: string | null }, filePath: string) {
  const modelName = getModelDisplayName(run.model_provider_id);
  const providerTag = run.model_provider_id ?? "default";
  return `${modelName} [${providerTag}] - ${path.basename(filePath)}`;
}

async function loadEnvFile(repoRoot: string) {
  const envPath = path.join(repoRoot, ".env.local");
  const content = await readFile(envPath, "utf8");

  const forceOverrideKeys = ["ANTHROPIC_BASE_URL", "ANTHROPIC_AUTH_TOKEN"];

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

    if (forceOverrideKeys.includes(key) || !process.env[key]) {
      process.env[key] = value;
    }
  }

  if (process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY.startsWith("sk-2UzzUYh")) {
    delete process.env.ANTHROPIC_API_KEY;
  }
}

async function getSortedFilePaths(dirPath: string, extension: string) {
  const entries = await readdir(dirPath);
  const matches = await Promise.all(
    entries
      .filter((entry) => entry.toLowerCase().endsWith(extension.toLowerCase()))
      .map(async (entry) => {
        const fullPath = path.join(dirPath, entry);
        const fileStat = await stat(fullPath);
        return {
          fullPath,
          mtimeMs: fileStat.mtimeMs,
        };
      }),
  );

  return matches
    .sort((left, right) => right.mtimeMs - left.mtimeMs)
    .map((item) => item.fullPath);
}

async function resolveResultPaths(repoRoot: string, args: ParsedArgs) {
  const resultDir = path.join(repoRoot, "docs", "test-results");
  const latestFiles = await getSortedFilePaths(resultDir, ".json");

  if (latestFiles.length === 0) {
    throw new Error(`No .json files found in ${resultDir}`);
  }

  const primary = args.resultFile
    ? toAbsolutePath(repoRoot, args.resultFile)
    : latestFiles[0];
  const compare = args.compareFile
    ? toAbsolutePath(repoRoot, args.compareFile)
    : null;

  if (compare && compare === primary) {
    throw new Error("Primary file and compare file must be different.");
  }

  return {
    primary,
    compare,
  };
}

function parseJsonCandidate(text: string) {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]+?)```/i);
  const raw = fenced?.[1]?.trim() || trimmed;

  try {
    return JSON.parse(raw) as unknown;
  } catch {
    const objectMatch = raw.match(/\{[\s\S]*\}/);
    if (!objectMatch) {
      throw new Error("Evaluator did not return valid JSON.");
    }
    return JSON.parse(objectMatch[0]) as unknown;
  }
}

function clampScore(value: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    throw new Error(`Invalid score value: ${String(value)}`);
  }

  return Math.max(1, Math.min(5, Math.round(numeric)));
}

function normalizeScore(json: unknown): SoftScore {
  if (!json || typeof json !== "object") {
    throw new Error("Score payload is not an object.");
  }

  const record = json as Record<string, unknown>;

  return {
    role_adherence: clampScore(record.role_adherence),
    naturalness: clampScore(record.naturalness),
    emotional_accuracy: clampScore(record.emotional_accuracy),
    anti_ai_score: clampScore(record.anti_ai_score),
    length_appropriate: clampScore(record.length_appropriate),
  };
}

function buildPersonaDescription(persona: PersonaRecord | null) {
  if (!persona) {
    return "人设资料缺失。";
  }

  const parts = [
    persona.name,
    persona.age ? `${persona.age}岁` : null,
    persona.occupation || null,
    persona.city ? `常驻${persona.city}` : null,
    persona.default_relationship ? `默认关系：${persona.default_relationship}` : null,
    persona.personality ? `性格：${persona.personality}` : null,
    persona.speaking_style ? `说话风格：${persona.speaking_style}` : null,
    persona.emotional_traits ? `情绪特点：${persona.emotional_traits}` : null,
    persona.quirks ? `习惯/怪癖：${persona.quirks}` : null,
    persona.hobbies ? `爱好：${persona.hobbies}` : null,
    persona.daily_habits ? `日常习惯：${persona.daily_habits}` : null,
    persona.family_info ? `家庭信息：${persona.family_info}` : null,
    persona.background_story ? `背景：${persona.background_story}` : null,
  ].filter(Boolean);

  return parts.join("；");
}

async function fetchPersonas(personaIds: string[]) {
  if (personaIds.length === 0) {
    return new Map<string, PersonaRecord>();
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.");
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
      [
        "id",
        "name",
        "age",
        "occupation",
        "city",
        "personality",
        "speaking_style",
        "background_story",
        "hobbies",
        "daily_habits",
        "family_info",
        "default_relationship",
        "emotional_traits",
        "quirks",
      ].join(","),
    )
    .in("id", personaIds);

  if (error) {
    throw new Error(`Failed to load personas: ${error.message}`);
  }

  const personaRows = (data ?? []) as unknown as PersonaRecord[];
  return new Map(personaRows.map((persona) => [persona.id, persona]));
}

async function evaluateSingleCase(input: {
  result: BatchCaseResult;
  personas: Map<string, PersonaRecord>;
}) {
  const personaDescription = buildPersonaDescription(
    input.personas.get(input.result.persona_id) ?? null,
  );

  const prompt = [
    "你是对话质量评估专家，负责评估AI人设陪伴对话的质量。",
    "",
    `人设描述：${personaDescription}`,
    `用户输入：${input.result.input}`,
    `AI回复：${input.result.reply}`,
    "",
    "请从以下5个维度评分（1-5分），只输出JSON，不要解释：",
    "{",
    '  "role_adherence": X,',
    '  "naturalness": X,',
    '  "emotional_accuracy": X,',
    '  "anti_ai_score": X,',
    '  "length_appropriate": X',
    "}",
  ].join("\n");

  const requestIntervalMs = Number(process.env.AUTO_EVAL_MIN_INTERVAL_MS || 2100);
  const retryDelayMs = Number(process.env.AUTO_EVAL_RETRY_DELAY_MS || 12000);
  const maxAttempts = Number(process.env.AUTO_EVAL_MAX_RETRIES || 4);

  try {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const now = Date.now();
        const slotTime = Math.max(now, nextAvailableRequestAt);
        nextAvailableRequestAt = slotTime + requestIntervalMs;

        if (slotTime > now) {
          await sleep(slotTime - now);
        }

        const text = await generateClaudeText({
          system: "你是严谨的对话质量评估器。你只能输出合法 JSON。",
          messages: [{ role: "user", content: prompt }],
          model:
            process.env.ANTHROPIC_DEFAULT_HAIKU_MODEL ||
            process.env.ANTHROPIC_HAIKU_MODEL ||
            "claude-haiku-4-5",
          maxTokens: 220,
          temperature: 0,
        });

        const scores = normalizeScore(parseJsonCandidate(text));
        const averageScore = Number(
          (
            SCORE_KEYS.reduce((sum, key) => sum + scores[key], 0) / SCORE_KEYS.length
          ).toFixed(2),
        );

        return {
          id: input.result.id,
          category: input.result.category,
          persona_id: input.result.persona_id,
          user_message: input.result.input,
          ai_reply: input.result.reply,
          reply_length: input.result.reply_length,
          hard_passed: true,
          evaluation_error: null,
          scores,
          average_score: averageScore,
        } satisfies EvaluatedCase;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error("Unknown evaluation error.");

        const isRetryable =
          /429/.test(lastError.message) ||
          /502/.test(lastError.message) ||
          /503/.test(lastError.message) ||
          /504/.test(lastError.message) ||
          /Network error/.test(lastError.message);

        if (!isRetryable || attempt === maxAttempts) {
          throw lastError;
        }

        await sleep(retryDelayMs * attempt);
      }
    }

    throw lastError ?? new Error("Unknown evaluation error.");
  } catch (error) {
    return {
      id: input.result.id,
      category: input.result.category,
      persona_id: input.result.persona_id,
      user_message: input.result.input,
      ai_reply: input.result.reply,
      reply_length: input.result.reply_length,
      hard_passed: true,
      evaluation_error:
        error instanceof Error ? error.message : "Unknown evaluation error.",
      scores: null,
      average_score: null,
    } satisfies EvaluatedCase;
  }
}

async function runWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
) {
  const results = new Array<R>(items.length);
  let currentIndex = 0;

  async function runner() {
    while (currentIndex < items.length) {
      const index = currentIndex;
      currentIndex += 1;
      results[index] = await worker(items[index], index);
    }
  }

  const workerCount = Math.max(1, Math.min(concurrency, items.length));
  await Promise.all(Array.from({ length: workerCount }, () => runner()));
  return results;
}

function computeAverages(cases: EvaluatedCase[]): SoftScore {
  const scoredCases = cases.filter((item): item is EvaluatedCase & { scores: SoftScore } =>
    Boolean(item.scores),
  );

  if (scoredCases.length === 0) {
    return {
      role_adherence: 0,
      naturalness: 0,
      emotional_accuracy: 0,
      anti_ai_score: 0,
      length_appropriate: 0,
    };
  }

  return Object.fromEntries(
    SCORE_KEYS.map((key) => [
      key,
      Number(
        (
          scoredCases.reduce((sum, item) => sum + item.scores[key], 0) /
          scoredCases.length
        ).toFixed(2),
      ),
    ]),
  ) as SoftScore;
}

function findLowScoreCases(cases: EvaluatedCase[]) {
  return cases
    .filter((item): item is EvaluatedCase & { scores: SoftScore } => Boolean(item.scores))
    .map((item) => ({
      ...item,
      low_dimensions: SCORE_KEYS.filter((key) => item.scores[key] < 3),
    }))
    .filter((item) => item.low_dimensions.length > 0)
    .sort((left, right) => {
      const leftMin = Math.min(...left.low_dimensions.map((key) => left.scores[key]));
      const rightMin = Math.min(...right.low_dimensions.map((key) => right.scores[key]));
      return leftMin - rightMin || (left.average_score ?? 0) - (right.average_score ?? 0);
    });
}

function summarizeRun(run: EvaluatedRun, repoRoot: string): RunSummary {
  return {
    label: run.label,
    display_label: run.displayLabel,
    result_file: path.relative(repoRoot, run.resultFilePath),
    model_provider_id: run.batchRun.model_provider_id,
    evaluated_count: run.evaluatedCount,
    low_score_count: run.lowScoreCases.length,
    averages: run.averages,
  };
}

function normalizeSnapshot(json: unknown): ReportSnapshot | null {
  if (!json || typeof json !== "object") {
    return null;
  }

  const record = json as Record<string, unknown>;

  if (record.primary && typeof record.primary === "object") {
    return {
      generated_at:
        typeof record.generated_at === "string"
          ? record.generated_at
          : new Date().toISOString(),
      mode: record.compare ? "compare" : "single",
      primary: record.primary as RunSummary,
      compare: (record.compare as RunSummary | null) ?? null,
    };
  }

  if (
    typeof record.result_file === "string" &&
    typeof record.evaluated_count === "number" &&
    typeof record.low_score_count === "number" &&
    record.averages &&
    typeof record.averages === "object"
  ) {
    return {
      generated_at:
        typeof record.generated_at === "string"
          ? record.generated_at
          : new Date().toISOString(),
      mode: "single",
      primary: {
        label: "primary",
        display_label: "primary",
        result_file: record.result_file,
        model_provider_id:
          typeof record.model_provider_id === "string" ? record.model_provider_id : null,
        evaluated_count: record.evaluated_count,
        low_score_count: record.low_score_count,
        averages: record.averages as SoftScore,
      },
      compare: null,
    };
  }

  return null;
}

async function loadPreviousSnapshot(reportDir: string) {
  try {
    const latestReportPath = (await getSortedFilePaths(reportDir, ".md"))[0];
    if (!latestReportPath) {
      return null;
    }

    const content = await readFile(latestReportPath, "utf8");
    const match = content.match(/<!--\s*AUTO_EVAL_SUMMARY:\s*(\{[\s\S]*\})\s*-->/);
    if (!match) {
      return null;
    }

    const snapshot = normalizeSnapshot(JSON.parse(match[1]));
    if (!snapshot) {
      return null;
    }

    return {
      reportPath: latestReportPath,
      snapshot,
    };
  } catch {
    return null;
  }
}

async function loadBatchRun(filePath: string) {
  const content = await readFile(filePath, "utf8");
  return JSON.parse(content) as BatchTestRun;
}

async function evaluateRun(input: {
  label: string;
  resultFilePath: string;
  batchRun: BatchTestRun;
  personas: Map<string, PersonaRecord>;
  concurrency: number;
}) {
  const passedResults = input.batchRun.results.filter((item) => item.passed);
  if (passedResults.length === 0) {
    throw new Error(`No passed cases found in ${path.basename(input.resultFilePath)}.`);
  }

  const evaluatedCases = await runWithConcurrency(
    passedResults,
    input.concurrency,
    async (result, index) => {
      const evaluation = await evaluateSingleCase({
        result,
        personas: input.personas,
      });
      const state = evaluation.scores ? "OK" : "ERR";
      const suffix = evaluation.scores
        ? `avg=${evaluation.average_score?.toFixed(2)}`
        : `error=${evaluation.evaluation_error}`;
      console.log(
        `[${input.label} ${index + 1}/${passedResults.length}] ${state} ${evaluation.id} ${suffix}`,
      );
      return evaluation;
    },
  );

  const lowScoreCases = findLowScoreCases(evaluatedCases);

  return {
    label: input.label,
    displayLabel: buildRunDisplayLabel(input.batchRun, input.resultFilePath),
    resultFilePath: input.resultFilePath,
    batchRun: input.batchRun,
    evaluatedCases,
    lowScoreCases,
    averages: computeAverages(evaluatedCases),
    evaluatedCount: evaluatedCases.filter((item) => item.scores).length,
    failedEvaluationCount: evaluatedCases.filter((item) => item.evaluation_error).length,
  } satisfies EvaluatedRun;
}

function buildLowScoreTable(run: EvaluatedRun) {
  const lines = [
    `### ${run.displayLabel}`,
    "",
  ];

  if (run.lowScoreCases.length === 0) {
    lines.push("当前没有任一维度低于 3.0 的回复。", "");
    return lines;
  }

  lines.push(
    "| Case | 类别 | 低分维度 | 平均分 | 用户输入 | AI回复 |",
    "| --- | --- | --- | ---: | --- | --- |",
  );

  for (const item of run.lowScoreCases) {
    const lowDimensions = item.low_dimensions
      .map((key) => `${SCORE_LABELS[key]}=${item.scores[key]}`)
      .join(", ");

    lines.push(
      `| ${item.id} | ${item.category} | ${escapeCell(lowDimensions)} | ${(item.average_score ?? 0).toFixed(2)} | ${escapeCell(item.user_message)} | ${escapeCell(item.ai_reply)} |`,
    );
  }

  lines.push("");
  return lines;
}

function buildCrossRunComparison(primary: EvaluatedRun, compare: EvaluatedRun) {
  const lines = [
    "## 模型对比",
    "",
    `- 左侧模型: ${primary.displayLabel}`,
    `- 右侧模型: ${compare.displayLabel}`,
    "",
    `| 维度 | ${primary.displayLabel} | ${compare.displayLabel} | 差值(右侧-左侧) |`,
    "| --- | ---: | ---: | ---: |",
  ];

  for (const key of SCORE_KEYS) {
    lines.push(
      `| ${SCORE_LABELS[key]} | ${primary.averages[key].toFixed(2)} | ${compare.averages[key].toFixed(2)} | ${formatDelta(compare.averages[key], primary.averages[key])} |`,
    );
  }

  lines.push(
    "",
    `- 主结果低分回复数: ${primary.lowScoreCases.length}`,
    `- 对照结果低分回复数: ${compare.lowScoreCases.length}`,
    "",
    "### 分差最大的 Case",
    "",
    `| Case | 类别 | ${primary.displayLabel} 均分 | ${compare.displayLabel} 均分 | 差值 | 用户输入 | ${primary.displayLabel} 回复 | ${compare.displayLabel} 回复 |`,
    "| --- | --- | ---: | ---: | ---: | --- | --- | --- |",
  );

  const primaryById = new Map(
    primary.evaluatedCases
      .filter((item): item is EvaluatedCase & { scores: SoftScore } => Boolean(item.scores))
      .map((item) => [item.id, item]),
  );
  const compareById = new Map(
    compare.evaluatedCases
      .filter((item): item is EvaluatedCase & { scores: SoftScore } => Boolean(item.scores))
      .map((item) => [item.id, item]),
  );

  const diffs = Array.from(primaryById.entries())
    .map(([id, primaryCase]) => {
      const compareCase = compareById.get(id);
      if (!compareCase) return null;

      return {
        id,
        category: primaryCase.category,
        user_message: primaryCase.user_message,
        primary_reply: primaryCase.ai_reply,
        compare_reply: compareCase.ai_reply,
        primary_average: primaryCase.average_score ?? 0,
        compare_average: compareCase.average_score ?? 0,
        delta: Number(
          ((compareCase.average_score ?? 0) - (primaryCase.average_score ?? 0)).toFixed(2),
        ),
      };
    })
    .filter((item): item is ComparisonDiff => item !== null)
    .sort((left, right) => Math.abs(right.delta) - Math.abs(left.delta))
    .slice(0, 12);

  for (const item of diffs) {
    lines.push(
      `| ${item.id} | ${item.category} | ${item.primary_average.toFixed(2)} | ${item.compare_average.toFixed(2)} | ${item.delta > 0 ? "+" : ""}${item.delta.toFixed(2)} | ${escapeCell(item.user_message)} | ${escapeCell(item.primary_reply)} | ${escapeCell(item.compare_reply)} |`,
    );
  }

  lines.push("");
  return lines;
}

function buildPreviousComparison(
  currentSnapshot: ReportSnapshot,
  previousSnapshot: ReportSnapshot | null,
  previousReportPath: string | null,
) {
  const lines = ["## 对比上次评估", ""];

  if (!previousSnapshot || !previousReportPath) {
    lines.push("没有找到上一次自动评分报告，暂不做对比。", "");
    return lines;
  }

  lines.push(`- 对比报告: \`${path.relative(process.cwd(), previousReportPath)}\``);
  lines.push("");
  lines.push(`### ${currentSnapshot.primary.display_label}`, "");
  lines.push("| 维度 | 上次 | 本次 | 差值 |");
  lines.push("| --- | ---: | ---: | ---: |");

  for (const key of SCORE_KEYS) {
    lines.push(
      `| ${SCORE_LABELS[key]} | ${previousSnapshot.primary.averages[key].toFixed(2)} | ${currentSnapshot.primary.averages[key].toFixed(2)} | ${formatDelta(currentSnapshot.primary.averages[key], previousSnapshot.primary.averages[key])} |`,
    );
  }

  lines.push(
    `| 低分回复数 | ${previousSnapshot.primary.low_score_count.toFixed(0)} | ${currentSnapshot.primary.low_score_count.toFixed(0)} | ${currentSnapshot.primary.low_score_count - previousSnapshot.primary.low_score_count >= 0 ? "+" : ""}${currentSnapshot.primary.low_score_count - previousSnapshot.primary.low_score_count} |`,
    "",
  );

  if (currentSnapshot.compare && previousSnapshot.compare) {
    lines.push(`### ${currentSnapshot.compare.display_label}`, "");
    lines.push("| 维度 | 上次 | 本次 | 差值 |");
    lines.push("| --- | ---: | ---: | ---: |");

    for (const key of SCORE_KEYS) {
      lines.push(
        `| ${SCORE_LABELS[key]} | ${previousSnapshot.compare.averages[key].toFixed(2)} | ${currentSnapshot.compare.averages[key].toFixed(2)} | ${formatDelta(currentSnapshot.compare.averages[key], previousSnapshot.compare.averages[key])} |`,
      );
    }

    lines.push(
      `| 低分回复数 | ${previousSnapshot.compare.low_score_count.toFixed(0)} | ${currentSnapshot.compare.low_score_count.toFixed(0)} | ${currentSnapshot.compare.low_score_count - previousSnapshot.compare.low_score_count >= 0 ? "+" : ""}${currentSnapshot.compare.low_score_count - previousSnapshot.compare.low_score_count} |`,
      "",
    );
  }

  return lines;
}

function buildMarkdownReport(input: {
  generatedAt: string;
  primary: EvaluatedRun;
  compare: EvaluatedRun | null;
  currentSnapshot: ReportSnapshot;
  previousSnapshot: ReportSnapshot | null;
  previousReportPath: string | null;
}) {
  const evaluatorModel =
    process.env.ANTHROPIC_DEFAULT_HAIKU_MODEL ||
    process.env.ANTHROPIC_HAIKU_MODEL ||
    "claude-haiku-4-5";

  const lines = [
    "# 自动评分报告",
    "",
    `- 生成时间: ${input.generatedAt}`,
    `- 评分模型: \`${evaluatorModel}\``,
    `- 左侧结果: ${input.primary.displayLabel}`,
    `- 左侧评分数: ${input.primary.evaluatedCount}`,
    `- 左侧评分失败数: ${input.primary.failedEvaluationCount}`,
  ];

  if (input.compare) {
    lines.push(
      `- 右侧结果: ${input.compare.displayLabel}`,
      `- 右侧评分数: ${input.compare.evaluatedCount}`,
      `- 右侧评分失败数: ${input.compare.failedEvaluationCount}`,
    );
  }

  lines.push(
    "",
    "## 平均分",
    "",
    `| 维度 | ${input.primary.displayLabel} |` +
      (input.compare ? ` ${input.compare.displayLabel} |` : ""),
    "| --- | ---: |" + (input.compare ? " ---: |" : ""),
  );

  for (const key of SCORE_KEYS) {
    lines.push(
      `| ${SCORE_LABELS[key]} | ${input.primary.averages[key].toFixed(2)} |${
        input.compare ? ` ${input.compare.averages[key].toFixed(2)} |` : ""
      }`,
    );
  }

  lines.push("", "## 重点关注", "");
  lines.push(...buildLowScoreTable(input.primary));

  if (input.compare) {
    lines.push(...buildLowScoreTable(input.compare));
    lines.push(...buildCrossRunComparison(input.primary, input.compare));
  }

  lines.push(
    ...buildPreviousComparison(
      input.currentSnapshot,
      input.previousSnapshot,
      input.previousReportPath,
    ),
  );

  const failedCases = [
    ...input.primary.evaluatedCases
      .filter((item) => item.evaluation_error)
      .map((item) => ({
        label: input.primary.displayLabel,
        caseId: item.id,
        error: item.evaluation_error,
      })),
    ...(input.compare
      ? input.compare.evaluatedCases
          .filter((item) => item.evaluation_error)
          .map((item) => ({
            label: input.compare!.displayLabel,
            caseId: item.id,
            error: item.evaluation_error,
          }))
      : []),
  ];

  if (failedCases.length > 0) {
    lines.push("## 评分失败", "", "| 结果集 | Case | 错误 |", "| --- | --- | --- |");
    for (const item of failedCases) {
      lines.push(`| ${item.label} | ${item.caseId} | ${escapeCell(item.error ?? "Unknown error")} |`);
    }
    lines.push("");
  }

  lines.push(`<!-- AUTO_EVAL_SUMMARY: ${JSON.stringify(input.currentSnapshot)} -->`);

  return lines.join("\n");
}

async function main() {
  const repoRoot = process.cwd();
  const args = parseArgs(process.argv.slice(2));
  await loadEnvFile(repoRoot);

  console.log("=== Auto Evaluator Pre-flight Checks ===");

  const apiKey = process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN;
  const baseUrl = process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com";
  const endpoint = `${baseUrl.replace(/\/$/, "")}/v1/messages`;
  const evaluatorModel =
    process.env.ANTHROPIC_DEFAULT_HAIKU_MODEL ||
    process.env.ANTHROPIC_HAIKU_MODEL ||
    "claude-haiku-4-5";

  console.log(`- API Endpoint: ${endpoint}`);
  console.log(`- Evaluator Model: ${evaluatorModel}`);
  console.log(`- API Key: ${apiKey ? `${apiKey.slice(0, 10)}...${apiKey.slice(-4)}` : "MISSING"}`);

  if (!apiKey) {
    throw new Error(
      "Missing ANTHROPIC_API_KEY or ANTHROPIC_AUTH_TOKEN in .env.local. Cannot proceed with evaluation.",
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  console.log(`- Supabase URL: ${supabaseUrl || "MISSING"}`);
  console.log(`- Supabase Key: ${supabaseKey ? "SET" : "MISSING"}`);

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local. Cannot fetch persona data.",
    );
  }

  console.log("- All prerequisites satisfied");
  console.log("");

  const resolvedPaths = await resolveResultPaths(repoRoot, args);
  const reportDir = path.join(repoRoot, "docs", "eval-reports");
  const previousSnapshotEntry = await loadPreviousSnapshot(reportDir);

  const primaryBatchRun = await loadBatchRun(resolvedPaths.primary);
  const compareBatchRun = resolvedPaths.compare
    ? await loadBatchRun(resolvedPaths.compare)
    : null;

  const personaIds = Array.from(
    new Set([
      ...primaryBatchRun.results.map((item) => item.persona_id),
      ...(compareBatchRun ? compareBatchRun.results.map((item) => item.persona_id) : []),
    ]),
  );
  const personas = await fetchPersonas(personaIds);
  const concurrency = Number(process.env.AUTO_EVAL_CONCURRENCY || 1);

  const primaryRun = await evaluateRun({
    label: "primary",
    resultFilePath: resolvedPaths.primary,
    batchRun: primaryBatchRun,
    personas,
    concurrency,
  });

  const compareRun = compareBatchRun
    ? await evaluateRun({
        label: "compare",
        resultFilePath: resolvedPaths.compare as string,
        batchRun: compareBatchRun,
        personas,
        concurrency,
      })
    : null;

  const { iso, file } = getTimestampParts();
  const currentSnapshot: ReportSnapshot = {
    generated_at: iso,
    mode: compareRun ? "compare" : "single",
    primary: summarizeRun(primaryRun, repoRoot),
    compare: compareRun ? summarizeRun(compareRun, repoRoot) : null,
  };

  const markdown = buildMarkdownReport({
    generatedAt: iso,
    primary: primaryRun,
    compare: compareRun,
    currentSnapshot,
    previousSnapshot: previousSnapshotEntry?.snapshot ?? null,
    previousReportPath: previousSnapshotEntry?.reportPath ?? null,
  });

  await mkdir(reportDir, { recursive: true });
  const reportPath = path.join(reportDir, `report-${file}.md`);
  await writeFile(reportPath, markdown, "utf8");

  console.log("");
  console.log("Summary");
  console.log(`- Primary result: ${path.relative(repoRoot, resolvedPaths.primary)}`);
  console.log(`- Primary evaluated: ${primaryRun.evaluatedCount}`);
  console.log(`- Primary low-score cases: ${primaryRun.lowScoreCases.length}`);
  console.log(
    `- Primary averages: role=${primaryRun.averages.role_adherence.toFixed(2)}, natural=${primaryRun.averages.naturalness.toFixed(2)}, emotion=${primaryRun.averages.emotional_accuracy.toFixed(2)}, anti_ai=${primaryRun.averages.anti_ai_score.toFixed(2)}, length=${primaryRun.averages.length_appropriate.toFixed(2)}`,
  );

  if (compareRun) {
    console.log(`- Compare result: ${path.relative(repoRoot, resolvedPaths.compare as string)}`);
    console.log(`- Compare evaluated: ${compareRun.evaluatedCount}`);
    console.log(`- Compare low-score cases: ${compareRun.lowScoreCases.length}`);
    console.log(
      `- Compare averages: role=${compareRun.averages.role_adherence.toFixed(2)}, natural=${compareRun.averages.naturalness.toFixed(2)}, emotion=${compareRun.averages.emotional_accuracy.toFixed(2)}, anti_ai=${compareRun.averages.anti_ai_score.toFixed(2)}, length=${compareRun.averages.length_appropriate.toFixed(2)}`,
    );
  }

  console.log(`- Report file: ${path.relative(repoRoot, reportPath)}`);
}

void main().catch((error) => {
  const message = error instanceof Error ? error.message : "Unknown auto evaluation error.";
  console.error(`Auto evaluator failed: ${message}`);
  process.exit(1);
});
