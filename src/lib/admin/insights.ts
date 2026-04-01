import { listAppUsers } from "@/lib/auth/session";
import {
  getSessionById,
  listRecentSessionsForAdmin,
  listSessionMessages,
} from "@/lib/chat/sessions";
import { memoryLogger } from "@/lib/memory/memory-logger";
import { queryPostgres } from "@/lib/postgres";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type {
  AppUserRecord,
  MemoryOperationLogRecord,
  MessageRecord,
  Persona,
  SessionRecord,
} from "@/lib/supabase/types";

type PersonaSummary = Pick<Persona, "id" | "name" | "occupation" | "city">;

type ConversationRow = {
  session: SessionRecord;
  user: AppUserRecord | null;
  persona: PersonaSummary | null;
  messageCount: number;
  userMessageCount: number;
  assistantMessageCount: number;
  latestMessage: MessageRecord | null;
};

type PersonaUsageStat = {
  personaId: string;
  personaName: string;
  sessionCount: number;
  messageCount: number;
  lastMessageAt: string | null;
};

type MemoryHealthSnapshot = {
  totalCalls: number;
  failureCount: number;
  slowCount: number;
  avgDuration: number;
  successRate: number;
  operations: Array<{
    operation: string;
    count: number;
    failureCount: number;
    avgDuration: number;
  }>;
  recentErrors: MemoryOperationLogRecord[];
};

type CharacterUsageStat = {
  characterId: string;
  characterName: string;
  sessionCount: number;
  messageCount: number;
};

const TEST_CHARACTER_PATTERNS = [
  /^import-isolation-/i,
  /^audit-/i,
  /^直连/i,
  /^test-/i,
  /^demo-/i,
  /^验证/i,
  /^验收/i,
];

function hasServiceRoleAccess() {
  return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim());
}

function getCurrentDayKey(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: process.env.APP_TIMEZONE || "Asia/Taipei",
  }).format(date);
}

async function loadPersonaMap() {
  const result = await queryPostgres<PersonaSummary>(
    `
      select id, name, occupation, city
      from personas
      order by created_at asc nulls last
    `,
  );

  const entries = result.rows;
  return new Map(entries.map((item) => [item.id, item]));
}

async function loadCharacterMap() {
  const result = await queryPostgres<{ id: string; name: string | null }>(
    `
      select id, name
      from user_characters
      where is_active = true
    `,
  );

  return new Map(result.rows.map((item) => [item.id, item.name ?? item.id]));
}

function isLikelyTestCharacter(name: string) {
  return TEST_CHARACTER_PATTERNS.some((pattern) => pattern.test(name));
}

async function buildConversationRow(
  session: SessionRecord,
  userMap: Map<string, AppUserRecord>,
  personaMap: Map<string, PersonaSummary>,
) {
  const messages = await listSessionMessages(session.id, 200, {
    userId: session.user_id,
    bypassOwnership: true,
  });

  return {
    session,
    user: userMap.get(session.user_id) ?? null,
    persona: personaMap.get(session.persona_id) ?? null,
    messageCount: messages.length,
    userMessageCount: messages.filter((item) => item.role === "user").length,
    assistantMessageCount: messages.filter((item) => item.role === "assistant").length,
    latestMessage: messages[messages.length - 1] ?? null,
  } satisfies ConversationRow;
}

async function loadMessagesForSessions(sessionIds: string[]) {
  if (!hasServiceRoleAccess() || sessionIds.length === 0) {
    return null;
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("messages")
    .select("id,session_id,role,content,emotion_label,created_at")
    .in("session_id", sessionIds)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  const grouped = new Map<string, MessageRecord[]>();

  for (const message of ((data ?? []) as MessageRecord[])) {
    const bucket = grouped.get(message.session_id) ?? [];
    bucket.push(message);
    grouped.set(message.session_id, bucket);
  }

  return grouped;
}

function buildConversationRowsFromBatch(params: {
  sessions: SessionRecord[];
  userMap: Map<string, AppUserRecord>;
  personaMap: Map<string, PersonaSummary>;
  messagesBySession: Map<string, MessageRecord[]>;
}) {
  return params.sessions.map((session) => {
    const messages = params.messagesBySession.get(session.id) ?? [];

    return {
      session,
      user: params.userMap.get(session.user_id) ?? null,
      persona: params.personaMap.get(session.persona_id) ?? null,
      messageCount: messages.length,
      userMessageCount: messages.filter((item) => item.role === "user").length,
      assistantMessageCount: messages.filter((item) => item.role === "assistant").length,
      latestMessage: messages[messages.length - 1] ?? null,
    } satisfies ConversationRow;
  });
}

function summarizePersonaUsage(rows: ConversationRow[]) {
  return Array.from(
    rows.reduce((map, row) => {
      const key = row.session.persona_id;
      const current = map.get(key) ?? {
        personaId: key,
        personaName: row.persona?.name ?? "Unknown Persona",
        sessionCount: 0,
        messageCount: 0,
        lastMessageAt: row.session.last_message_at,
      };

      current.sessionCount += 1;
      current.messageCount += row.messageCount;

      if (
        row.session.last_message_at &&
        (!current.lastMessageAt ||
          new Date(row.session.last_message_at).getTime() >
            new Date(current.lastMessageAt).getTime())
      ) {
        current.lastMessageAt = row.session.last_message_at;
      }

      map.set(key, current);
      return map;
    }, new Map<string, PersonaUsageStat>()),
  )
    .map(([, value]) => value)
    .sort((left, right) => right.messageCount - left.messageCount);
}

async function getMemoryHealthSnapshot(): Promise<MemoryHealthSnapshot> {
  const result = await memoryLogger.query({ limit: 240 });
  const logs = result.logs;

  if (logs.length === 0) {
    return {
      totalCalls: 0,
      failureCount: 0,
      slowCount: 0,
      avgDuration: 0,
      successRate: 1,
      operations: [],
      recentErrors: [],
    };
  }

  const failureCount = logs.filter((log) => !log.success).length;
  const slowCount = logs.filter((log) => log.duration > 2000).length;
  const avgDuration =
    logs.reduce((sum, log) => sum + log.duration, 0) / Math.max(logs.length, 1);

  const operations = Array.from(
    logs.reduce((map, log) => {
      const current = map.get(log.operation) ?? {
        operation: log.operation,
        count: 0,
        failureCount: 0,
        durationTotal: 0,
      };

      current.count += 1;
      current.durationTotal += log.duration;

      if (!log.success) {
        current.failureCount += 1;
      }

      map.set(log.operation, current);
      return map;
    }, new Map<string, { operation: string; count: number; failureCount: number; durationTotal: number }>()),
  )
    .map(([, item]) => ({
      operation: item.operation,
      count: item.count,
      failureCount: item.failureCount,
      avgDuration: item.durationTotal / Math.max(item.count, 1),
    }))
    .sort((left, right) => right.count - left.count)
    .slice(0, 8);

  return {
    totalCalls: logs.length,
    failureCount,
    slowCount,
    avgDuration,
    successRate: (logs.length - failureCount) / logs.length,
    operations,
    recentErrors: logs.filter((log) => !log.success).slice(0, 6),
  };
}

export async function listAdminConversationRows(limit = 60) {
  const [sessions, users, personaMap] = await Promise.all([
    listRecentSessionsForAdmin(limit),
    listAppUsers(),
    loadPersonaMap(),
  ]);

  const userMap = new Map(users.map((user) => [user.id, user]));

  if (!hasServiceRoleAccess()) {
    return Promise.all(
      sessions.map((session) => buildConversationRow(session, userMap, personaMap)),
    );
  }

  const messagesBySession = await loadMessagesForSessions(
    sessions.map((session) => session.id),
  );

  if (!messagesBySession) {
    return [];
  }

  return buildConversationRowsFromBatch({
    sessions,
    userMap,
    personaMap,
    messagesBySession,
  });
}

export async function getAdminConversationDetail(sessionId: string) {
  const [users, personaMap] = await Promise.all([listAppUsers(), loadPersonaMap()]);
  const userMap = new Map(users.map((user) => [user.id, user]));

  const session = await getSessionById(sessionId, {
    userId: "admin-review",
    bypassOwnership: true,
  });
  const messages = await listSessionMessages(sessionId, 300, {
    userId: session.user_id,
    bypassOwnership: true,
  });

  return {
    session,
    messages,
    user: userMap.get(session.user_id) ?? null,
    persona: personaMap.get(session.persona_id) ?? null,
  };
}

export async function getDashboardSnapshot() {
  const [users, conversationRows, memoryHealth, characterMap] = await Promise.all([
    listAppUsers(),
    listAdminConversationRows(80),
    getMemoryHealthSnapshot(),
    loadCharacterMap(),
  ]);

  const todayKey = getCurrentDayKey(new Date());
  const activeTodayUsers = new Set(
    conversationRows
      .filter((row) => {
        if (!row.session.last_message_at) return false;
        return getCurrentDayKey(new Date(row.session.last_message_at)) === todayKey;
      })
      .map((row) => row.session.user_id),
  );

  const statusBreakdown = Array.from(
    conversationRows.reduce((map, row) => {
      map.set(row.session.status, (map.get(row.session.status) ?? 0) + 1);
      return map;
    }, new Map<SessionRecord["status"], number>()),
  ).map(([status, count]) => ({ status, count }));

  const rawCharacterUsage = Array.from(
    conversationRows.reduce((map, row) => {
      const characterId = row.session.character_id ?? "unknown";
      const current = map.get(characterId) ?? {
        characterId,
        characterName: characterMap.get(characterId) ?? characterId,
        sessionCount: 0,
        messageCount: 0,
      };
      current.sessionCount += 1;
      current.messageCount += row.messageCount;
      map.set(characterId, current);
      return map;
    }, new Map<string, CharacterUsageStat>()),
  )
    .map(([, value]) => value)
    .sort((a, b) => b.messageCount - a.messageCount);

  const characterUsage = rawCharacterUsage.sort((left, right) => {
    const leftTest = isLikelyTestCharacter(left.characterName);
    const rightTest = isLikelyTestCharacter(right.characterName);

    if (leftTest !== rightTest) {
      return leftTest ? 1 : -1;
    }

    return right.messageCount - left.messageCount;
  });

  return {
    totals: {
      userCount: users.length,
      activeTodayCount: activeTodayUsers.size,
      sessionCount: conversationRows.length,
      messageCount: conversationRows.reduce((sum, row) => sum + row.messageCount, 0),
    },
    personaUsage: summarizePersonaUsage(conversationRows),
    characterUsage,
    recentConversations: conversationRows.slice(0, 12),
    memoryHealth,
    statusBreakdown,
  };
}
