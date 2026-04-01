import { getCurrentAppUser, getFallbackDemoUser } from "@/lib/auth/session";
import { queryPostgres } from "@/lib/postgres";
import type { MessageRecord, SessionRecord } from "@/lib/supabase/types";

export type SessionListItem = Pick<
  SessionRecord,
  "id" | "status" | "started_at" | "last_message_at" | "character_id"
>;

type SessionIdRow = {
  id: string;
};

type CharacterIdRow = {
  id: string;
};

type SessionAvailabilityRow = SessionRecord & {
  character_active: boolean | null;
};

function toSessionListItem(
  session: SessionListItem | SessionRecord,
): SessionListItem {
  return {
    id: session.id,
    status: session.status,
    started_at: session.started_at,
    last_message_at: session.last_message_at,
    character_id: session.character_id,
  };
}

async function ensureCharacterForUser(characterId: string, userId: string) {
  const normalizedCharacterId = characterId.trim();
  if (!normalizedCharacterId) {
    throw new Error("character_id is required.");
  }

  const result = await queryPostgres<CharacterIdRow>(
    `
      select id
      from user_characters
      where id = $1 and owner_id = $2 and is_active = true
      limit 1
    `,
    [normalizedCharacterId, userId],
  );

  const character = result.rows[0];
  if (!character) {
    throw new Error("Character not found.");
  }

  return normalizedCharacterId;
}

export async function hasActiveCharacterForUser(characterId: string, userId: string) {
  const normalizedCharacterId = characterId.trim();
  if (!normalizedCharacterId) {
    return false;
  }

  const result = await queryPostgres<CharacterIdRow>(
    `
      select id
      from user_characters
      where id = $1 and owner_id = $2 and is_active = true
      limit 1
    `,
    [normalizedCharacterId, userId],
  );

  return Boolean(result.rows[0]);
}

async function findPreferredCharacterForUser(userId: string) {
  const result = await queryPostgres<CharacterIdRow>(
    `
      select id
      from user_characters
      where owner_id = $1 and is_active = true
      order by case when name = '默认角色' then 0 else 1 end, created_at desc nulls last
      limit 1
    `,
    [userId],
  );

  return result.rows[0]?.id ?? null;
}

async function getOrCreateDefaultCharacterForUser(userId: string) {
  const existingCharacterId = await findPreferredCharacterForUser(userId);
  if (existingCharacterId) {
    return existingCharacterId;
  }

  const inserted = await queryPostgres<CharacterIdRow>(
    `
      insert into user_characters (owner_id, name, personality, is_active)
      values ($1, '默认角色', '系统默认角色', true)
      returning id
    `,
    [userId],
  );

  const characterId = inserted.rows[0]?.id ?? null;
  if (!characterId) {
    throw new Error("Unable to create a fallback character.");
  }

  return characterId;
}

export async function ensureSessionHasUsableCharacter(
  sessionId: string,
  userId: string,
  characterId: string | null | undefined,
) {
  const normalizedCharacterId = characterId?.trim() ?? "";

  if (normalizedCharacterId) {
    const existing = await queryPostgres<CharacterIdRow>(
      `
        select id
        from user_characters
        where id = $1 and owner_id = $2 and is_active = true
        limit 1
      `,
      [normalizedCharacterId, userId],
    );

    if (existing.rows[0]?.id) {
      return normalizedCharacterId;
    }
  }

  const fallbackCharacterId = await getOrCreateDefaultCharacterForUser(userId);
  await queryPostgres(
    `
      update sessions
      set character_id = $2
      where id = $1
    `,
    [sessionId, fallbackCharacterId],
  );

  return fallbackCharacterId;
}

function isUsableSession(
  session:
    | Pick<SessionRecord, "character_id">
    | Pick<SessionAvailabilityRow, "character_id" | "character_active">
    | null
    | undefined,
) {
  if (!session?.character_id) {
    return false;
  }

  if ("character_active" in session) {
    return session.character_active === true;
  }

  return true;
}

async function resolveCurrentUserId(userId?: string) {
  if (userId) return userId;

  const currentUser = await getCurrentAppUser();
  if (currentUser?.id) {
    return currentUser.id;
  }

  const fallbackUser = await getFallbackDemoUser();
  if (fallbackUser?.id) {
    return fallbackUser.id;
  }

  throw new Error("Unable to resolve the current user.");
}

export async function listPersonaSessions(
  personaId: string,
  limit = 20,
  options?: { userId?: string; includeLegacy?: boolean },
) {
  const userId = await resolveCurrentUserId(options?.userId);
  const result = await queryPostgres<SessionAvailabilityRow>(
    `
      select
        s.*,
        c.is_active as character_active
      from sessions s
      left join user_characters c
        on c.id = s.character_id
       and c.owner_id = s.user_id
      where s.user_id = $1 and s.persona_id = $2
        and (
          $4 = true
          or (
            s.character_id is not null
            and c.id is not null
            and c.is_active = true
          )
        )
      order by s.last_message_at desc nulls last
      limit $3
    `,
    [userId, personaId, limit, options?.includeLegacy ?? false],
  );

  return result.rows.map(toSessionListItem);
}

export async function createSession(
  personaId: string,
  options?: { userId?: string; characterId?: string },
) {
  const userId = await resolveCurrentUserId(options?.userId);
  const characterId = await ensureCharacterForUser(options?.characterId ?? "", userId);
  const result = await queryPostgres<SessionRecord>(
    `
      insert into sessions (user_id, persona_id, character_id, status)
      values ($1, $2, $3, 'active')
      returning *
    `,
    [userId, personaId, characterId],
  );

  const session = result.rows[0];
  if (!session) {
    throw new Error("Unable to create the session.");
  }

  return session;
}

export async function getLatestUsableSession(
  personaId: string,
  options?: { userId?: string },
) {
  const userId = await resolveCurrentUserId(options?.userId);
  const sessions = await listPersonaSessions(personaId, 20, {
    ...options,
    userId,
    includeLegacy: true,
  });

  for (const session of sessions) {
    const usableCharacterId = await ensureSessionHasUsableCharacter(
      session.id,
      userId,
      session.character_id,
    );

    return {
      ...session,
      character_id: usableCharacterId,
    };
  }

  return null;
}

export async function listSessionMessages(
  sessionId: string,
  limit = 1000,
  options?: { userId?: string; bypassOwnership?: boolean },
) {
  void options;
  const result = await queryPostgres<MessageRecord>(
    `
      select *
      from messages
      where session_id = $1
      order by created_at asc
      limit $2
    `,
    [sessionId, limit],
  );

  return result.rows;
}

export async function getRecentSessionMessages(
  sessionId: string,
  limit = 20,
  options?: { userId?: string },
) {
  void options;
  const result = await queryPostgres<MessageRecord>(
    `
      select *
      from messages
      where session_id = $1
      order by created_at desc
      limit $2
    `,
    [sessionId, limit],
  );

  return result.rows.reverse();
}

export async function insertMessage(
  sessionId: string,
  role: MessageRecord["role"],
  content: string,
  options?: { userId?: string },
) {
  void options;
  const inserted = await queryPostgres<MessageRecord>(
    `
      insert into messages (session_id, role, content)
      values ($1, $2, $3)
      returning *
    `,
    [sessionId, role, content],
  );

  const message = inserted.rows[0];
  if (!message) {
    throw new Error("Unable to save the message.");
  }

  await queryPostgres(
    `
      update sessions
      set last_message_at = now()
      where id = $1
    `,
    [sessionId],
  );

  return message;
}

export async function getSessionById(
  sessionId: string,
  options?: { userId?: string; bypassOwnership?: boolean },
) {
  const userId = await resolveCurrentUserId(options?.userId);
  const result = options?.bypassOwnership
    ? await queryPostgres<SessionAvailabilityRow>(
        `
          select
            s.*,
            c.is_active as character_active
          from sessions s
          left join user_characters c
            on c.id = s.character_id
           and c.owner_id = s.user_id
          where s.id = $1
          limit 1
        `,
        [sessionId],
      )
    : await queryPostgres<SessionAvailabilityRow>(
        `
          select
            s.*,
            c.is_active as character_active
          from sessions s
          left join user_characters c
            on c.id = s.character_id
           and c.owner_id = s.user_id
          where s.id = $1 and s.user_id = $2
          limit 1
        `,
        [sessionId, userId],
      );

  const session = result.rows[0];
  if (!session) {
    throw new Error("Session not found.");
  }

  return session;
}

export async function ensureSessionForPersona(
  sessionId: string,
  personaId: string,
  options?: { userId?: string; bypassOwnership?: boolean; allowLegacy?: boolean },
) {
  const session = await getSessionById(sessionId, options);

  if (session.persona_id !== personaId) {
    throw new Error("The selected session does not belong to this persona.");
  }

  if (!options?.allowLegacy && !isUsableSession(session)) {
    throw new Error("The selected session is not usable.");
  }

  if (options?.allowLegacy) {
    return session;
  }

  const usableCharacterId = await ensureSessionHasUsableCharacter(
    session.id,
    session.user_id,
    session.character_id,
  );

  return {
    ...session,
    character_id: usableCharacterId,
  };
}

export async function getChatBootstrap(
  personaId: string,
  requestedSessionId?: string,
  options?: { userId?: string },
) {
  let currentSession: SessionListItem | SessionRecord | null = null;

  if (requestedSessionId) {
    try {
      currentSession = await ensureSessionForPersona(requestedSessionId, personaId, {
        userId: options?.userId,
      });
    } catch {
      currentSession = await getLatestUsableSession(personaId, options);
    }
  } else {
    currentSession = await getLatestUsableSession(personaId, options);
  }

  const sessions = await listPersonaSessions(personaId, 20, options);
  const messages = currentSession
    ? await listSessionMessages(currentSession.id, 1000, options)
    : [];

  return {
    currentSession: currentSession ? toSessionListItem(currentSession) : null,
    sessions,
    messages,
    requiresCharacterSelection: !currentSession,
  };
}

export async function updateSessionSummary(
  sessionId: string,
  payload: Pick<SessionRecord, "summary" | "topics">,
  options?: { userId?: string },
) {
  void options;
  const result = await queryPostgres<SessionRecord>(
    `
      update sessions
      set summary = $2, topics = $3
      where id = $1
      returning *
    `,
    [sessionId, payload.summary, payload.topics],
  );

  const session = result.rows[0];
  if (!session) {
    throw new Error("Unable to update the session summary.");
  }

  return session;
}

export async function listRecentSummariesForPersona(
  personaId: string,
  limit = 3,
  options?: { userId?: string },
) {
  const userId = await resolveCurrentUserId(options?.userId);
  const result = await queryPostgres<SessionRecord>(
    `
      select *
      from sessions
      where user_id = $1 and persona_id = $2 and summary is not null
      order by last_message_at desc nulls last
      limit $3
    `,
    [userId, personaId, limit],
  );

  return result.rows;
}

export async function listRecentSessionsForAdmin(limit = 100) {
  const result = await queryPostgres<SessionRecord>(
    `
      select *
      from sessions
      order by last_message_at desc nulls last
      limit $1
    `,
    [limit],
  );

  return result.rows;
}

export async function deleteSession(
  sessionId: string,
  options?: { userId?: string },
) {
  const userId = await resolveCurrentUserId(options?.userId);
  const sessionResult = await queryPostgres<SessionIdRow>(
    `
      delete from sessions
      where id = $1 and user_id = $2
      returning id
    `,
    [sessionId, userId],
  );

  const session = sessionResult.rows[0];
  if (!session) {
    throw new Error("Session not found.");
  }

  return { id: session.id };
}

export async function deletePersonaSessions(
  personaId: string,
  options?: { userId?: string },
) {
  const userId = await resolveCurrentUserId(options?.userId);
  const result = await queryPostgres<SessionIdRow>(
    `
      delete from sessions
      where persona_id = $1 and user_id = $2
      returning id
    `,
    [personaId, userId],
  );

  return { deletedCount: result.rowCount ?? result.rows.length };
}
