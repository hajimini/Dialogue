import { listPromptVersions } from "@/lib/ai/prompt-versions";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { EvaluationLogRecord } from "@/lib/supabase/types";

const SCORE_FIELDS = [
  { key: "role_adherence", label: "角色一致" },
  { key: "naturalness", label: "自然度" },
  { key: "emotional_accuracy", label: "情绪准确" },
  { key: "memory_accuracy", label: "记忆衔接" },
  { key: "anti_ai_score", label: "去 AI 味" },
  { key: "length_appropriate", label: "长度合适" },
] as const;

type ScoreFieldKey = (typeof SCORE_FIELDS)[number]["key"];

function normalizeScore(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  return Math.max(1, Math.min(5, Math.round(value)));
}

export async function createEvaluationLog(input: {
  userId?: string | null;
  personaId?: string | null;
  sessionId?: string | null;
  messageId?: string | null;
  promptVersion?: string | null;
  roleAdherence?: number | null;
  naturalness?: number | null;
  emotionalAccuracy?: number | null;
  memoryAccuracy?: number | null;
  antiAiScore?: number | null;
  lengthAppropriate?: number | null;
  evaluator?: string | null;
  notes?: string | null;
  feedbackType?: "up" | "down" | null;
  feedbackReason?: string | null;
  source?: EvaluationLogRecord["source"];
}) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("evaluation_logs")
    .insert({
      user_id: input.userId ?? null,
      persona_id: input.personaId ?? null,
      session_id: input.sessionId ?? null,
      message_id: input.messageId ?? null,
      prompt_version: input.promptVersion ?? null,
      role_adherence: normalizeScore(input.roleAdherence),
      naturalness: normalizeScore(input.naturalness),
      emotional_accuracy: normalizeScore(input.emotionalAccuracy),
      memory_accuracy: normalizeScore(input.memoryAccuracy),
      anti_ai_score: normalizeScore(input.antiAiScore),
      length_appropriate: normalizeScore(input.lengthAppropriate),
      evaluator: input.evaluator?.trim() || null,
      notes: input.notes?.trim() || null,
      feedback_type: input.feedbackType ?? null,
      feedback_reason: input.feedbackReason?.trim() || null,
      source: input.source ?? null,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Failed to create evaluation log.");
  }

  return data as EvaluationLogRecord;
}

export async function listEvaluationLogs(filters?: {
  source?: EvaluationLogRecord["source"];
  promptVersion?: string;
  personaId?: string;
  userId?: string;
  feedbackOnly?: boolean;
  limit?: number;
}) {
  const supabase = getSupabaseAdminClient();
  let query = supabase
    .from("evaluation_logs")
    .select("*")
    .order("created_at", { ascending: false });

  if (filters?.source) {
    query = query.eq("source", filters.source);
  }

  if (filters?.promptVersion) {
    query = query.eq("prompt_version", filters.promptVersion);
  }

  if (filters?.personaId) {
    query = query.eq("persona_id", filters.personaId);
  }

  if (filters?.userId) {
    query = query.eq("user_id", filters.userId);
  }

  if (filters?.feedbackOnly) {
    query = query.not("feedback_type", "is", null);
  }

  if (typeof filters?.limit === "number") {
    query = query.limit(filters.limit);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to read evaluation logs: ${error.message}`);
  }

  return (data ?? []) as EvaluationLogRecord[];
}

function calculateAverage(items: EvaluationLogRecord[], field: ScoreFieldKey) {
  const scores = items
    .map((item) => item[field])
    .filter((value): value is number => typeof value === "number");

  if (scores.length === 0) {
    return null;
  }

  const total = scores.reduce((sum, value) => sum + value, 0);
  return Number((total / scores.length).toFixed(2));
}

export async function getEvaluationOverview() {
  const logs = await listEvaluationLogs();
  const promptVersions = await listPromptVersions();

  const metrics = SCORE_FIELDS.map((field) => ({
    key: field.key,
    label: field.label,
    average: calculateAverage(logs, field.key),
    count: logs.filter((item) => typeof item[field.key] === "number").length,
  }));

  const byPromptVersion = promptVersions
    .map((version) => {
      const related = logs.filter((item) => item.prompt_version === version.id);
      return {
        id: version.id,
        label: version.label,
        count: related.length,
        averages: SCORE_FIELDS.map((field) => ({
          key: field.key,
          label: field.label,
          average: calculateAverage(related, field.key),
        })),
      };
    })
    .filter((item) => item.count > 0);

  const feedback = {
    up: logs.filter((item) => item.feedback_type === "up").length,
    down: logs.filter((item) => item.feedback_type === "down").length,
    reasons: Array.from(
      logs.reduce((map, item) => {
        if (!item.feedback_reason) {
          return map;
        }

        map.set(item.feedback_reason, (map.get(item.feedback_reason) ?? 0) + 1);
        return map;
      }, new Map<string, number>()),
    )
      .map(([reason, count]) => ({ reason, count }))
      .sort((left, right) => right.count - left.count),
  };

  const sources = Array.from(
    logs.reduce((map, item) => {
      const key = item.source ?? "unknown";
      map.set(key, (map.get(key) ?? 0) + 1);
      return map;
    }, new Map<string, number>()),
  )
    .map(([source, count]) => ({ source, count }))
    .sort((left, right) => right.count - left.count);

  return {
    total: logs.length,
    metrics,
    byPromptVersion,
    feedback,
    sources,
    recent: logs.slice(0, 12),
  };
}
