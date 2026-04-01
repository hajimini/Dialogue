import type { MemoryOperationLogRecord } from "@/lib/supabase/types";
import { getMemorySupabaseClient } from "@/lib/memory/storage";

export type MemoryLogEntry = MemoryOperationLogRecord;

export type MemoryLogQuery = {
  limit?: number;
  offset?: number;
  operation?: string;
  userId?: string;
  personaId?: string;
  characterId?: string;
  success?: boolean;
};

function extractErrorMessage(error: unknown) {
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") {
      return message;
    }
  }

  return String(error);
}

function isMemoryLogSchemaError(error: unknown) {
  const message = extractErrorMessage(error).toLowerCase();
  return (
    message.includes("memory_operation_logs") ||
    message.includes("schema cache") ||
    message.includes("column") ||
    message.includes("does not exist")
  );
}

function formatPersistenceError(
  error: unknown,
  payload: ReturnType<MemoryLogger["normalizeEntry"]>,
) {
  if (error && typeof error === "object") {
    const candidate = error as {
      message?: string;
      details?: string;
      hint?: string;
      code?: string;
      name?: string;
    };

    return {
      message: candidate.message ?? String(error),
      details: candidate.details ?? null,
      hint: candidate.hint ?? null,
      code: candidate.code ?? null,
      name: candidate.name ?? null,
      operation: payload.operation,
      character_id: payload.character_id,
      payload_keys: Object.keys(payload),
    };
  }

  return {
    message: String(error),
    details: null,
    hint: null,
    code: null,
    name: null,
    operation: payload.operation,
    character_id: payload.character_id,
    payload_keys: Object.keys(payload),
  };
}

export class MemoryLogger {
  private normalizeEntry(entry: MemoryLogEntry) {
    return {
      ...entry,
      error_message: entry.error_message ?? null,
      metadata: entry.metadata ?? null,
      persona_id: entry.persona_id ?? null,
      character_id: entry.character_id ?? null,
      memory_id: entry.memory_id ?? null,
    };
  }

  async log(entry: MemoryLogEntry) {
    const payload = this.normalizeEntry(entry);

    console.log(JSON.stringify({ type: "memory-operation", ...payload }));

    try {
      const supabase = getMemorySupabaseClient();
      const { error } = await supabase.from("memory_operation_logs").insert(payload);
      if (error) {
        console.warn(
          `[MemoryLogger] Failed to persist memory log: ${JSON.stringify(
            formatPersistenceError(error, payload),
          )}`,
        );
      }
    } catch (error) {
      console.warn(
        `[MemoryLogger] Failed to persist memory log: ${JSON.stringify(
          formatPersistenceError(error, payload),
        )}`,
      );
    }
  }

  async query(params: MemoryLogQuery = {}) {
    const limit = Math.max(1, Math.min(500, params.limit ?? 100));
    const offset = Math.max(0, params.offset ?? 0);
    const supabase = getMemorySupabaseClient();

    let query = supabase
      .from("memory_operation_logs")
      .select("*", { count: "exact" })
      .order("timestamp", { ascending: false });

    if (params.operation) {
      query = query.eq("operation", params.operation);
    }

    if (params.userId) {
      query = query.eq("user_id", params.userId);
    }

    if (params.personaId) {
      query = query.eq("persona_id", params.personaId);
    }

    if (params.characterId) {
      query = query.eq("character_id", params.characterId);
    }

    if (typeof params.success === "boolean") {
      query = query.eq("success", params.success);
    }

    const { data, error, count } = await query.range(offset, offset + limit - 1);

    if (error) {
      if (isMemoryLogSchemaError(error)) {
        throw new Error(
          `memory_operation_logs schema is not ready: ${extractErrorMessage(error)}`,
        );
      }

      throw new Error(`Failed to read memory logs: ${error.message}`);
    }

    return {
      logs: (data ?? []) as MemoryLogEntry[],
      totalCount: count ?? 0,
    };
  }
}

export const memoryLogger = new MemoryLogger();
