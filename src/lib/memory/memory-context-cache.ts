import { isMemoryContextCacheEnabled } from "@/lib/memory/config";
import type {
  MemoryRecord,
  SessionRecord,
  UserProfilePerPersonaRecord,
} from "@/lib/supabase/types";

export type CachedMemoryContext = {
  userProfile: UserProfilePerPersonaRecord | null;
  recentSummaries: SessionRecord[];
  relevantMemories: MemoryRecord[];
};

type CacheKey = string;

type CacheEntry = {
  key: CacheKey;
  sessionId: string;
  userId: string;
  personaId: string;
  characterId: string | null;
  messageCount: number;
  context: CachedMemoryContext;
  timestamp: number;
};

const DEFAULT_TTL_MS = 30 * 60 * 1000;
const MAX_REUSE_OFFSET = 3;

function toKey(sessionId: string, messageCount: number, characterId: string | null) {
  return `${sessionId}:${messageCount}:${characterId ?? 'null'}`;
}

export class MemoryContextCache {
  private readonly cache = new Map<CacheKey, CacheEntry>();

  constructor(private readonly ttlMs = DEFAULT_TTL_MS) {}

  private isEnabled() {
    return isMemoryContextCacheEnabled();
  }

  private isExpired(entry: CacheEntry) {
    return Date.now() - entry.timestamp > this.ttlMs;
  }

  private deleteIfExpired(key: CacheKey, entry: CacheEntry) {
    if (!this.isExpired(entry)) {
      return false;
    }

    this.cache.delete(key);
    return true;
  }

  get(sessionId: string, messageCount: number, characterId: string | null = null) {
    if (!this.isEnabled()) {
      return null;
    }

    for (let offset = 0; offset <= MAX_REUSE_OFFSET; offset += 1) {
      const nextCount = Math.max(0, messageCount - offset);
      const key = toKey(sessionId, nextCount, characterId);
      const entry = this.cache.get(key);

      if (!entry) {
        continue;
      }

      if (this.deleteIfExpired(key, entry)) {
        continue;
      }

      // Do not reuse an "empty" context across later message counts.
      // This avoids stale cache hits after async memory extraction/import
      // has already persisted new memories for the same session.
      if (
        offset > 0 &&
        !entry.context.userProfile &&
        entry.context.recentSummaries.length === 0 &&
        entry.context.relevantMemories.length === 0
      ) {
        continue;
      }

      return entry.context;
    }

    return null;
  }

  set(params: {
    sessionId: string;
    messageCount: number;
    userId: string;
    personaId: string;
    characterId: string | null;
    context: CachedMemoryContext;
  }) {
    if (!this.isEnabled()) {
      return;
    }

    const key = toKey(params.sessionId, params.messageCount, params.characterId);
    this.cache.set(key, {
      key,
      sessionId: params.sessionId,
      userId: params.userId,
      personaId: params.personaId,
      characterId: params.characterId,
      messageCount: params.messageCount,
      context: params.context,
      timestamp: Date.now(),
    });
  }

  invalidate(userId: string, personaId: string) {
    for (const [key, entry] of this.cache.entries()) {
      if (entry.userId === userId && entry.personaId === personaId) {
        this.cache.delete(key);
      }
    }
  }

  invalidateByPersona(personaId: string) {
    for (const [key, entry] of this.cache.entries()) {
      if (entry.personaId === personaId) {
        this.cache.delete(key);
      }
    }
  }

  clear() {
    this.cache.clear();
  }
}

export const memoryContextCache = new MemoryContextCache();
