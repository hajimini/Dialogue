import { beforeEach, describe, expect, it } from "@jest/globals";
import {
  MemoryContextCache,
  type CachedMemoryContext,
} from "@/lib/memory/memory-context-cache";

function createContext(label: string): CachedMemoryContext {
  return {
    userProfile: null,
    recentSummaries: [],
    relevantMemories: [
      {
        id: `${label}-memory`,
        user_id: "user-1",
        persona_id: "persona-1",
        memory_type: "user_fact",
        content: label,
        embedding: null,
        importance: 0.6,
        source_session_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ],
  };
}

function createEmptyContext(): CachedMemoryContext {
  return {
    userProfile: null,
    recentSummaries: [],
    relevantMemories: [],
  };
}

describe("MemoryContextCache", () => {
  let originalCacheEnabled: string | undefined;

  beforeEach(() => {
    originalCacheEnabled = process.env.MEMORY_CONTEXT_CACHE_ENABLED;
    process.env.MEMORY_CONTEXT_CACHE_ENABLED = "true";
  });

  afterEach(() => {
    if (typeof originalCacheEnabled === "undefined") {
      delete process.env.MEMORY_CONTEXT_CACHE_ENABLED;
      return;
    }

    process.env.MEMORY_CONTEXT_CACHE_ENABLED = originalCacheEnabled;
  });

  it("reuses cached context across the next three message counts", () => {
    const cache = new MemoryContextCache();
    const context = createContext("anchor");

    cache.set({
      sessionId: "session-1",
      messageCount: 5,
      userId: "user-1",
      personaId: "persona-1",
      characterId: null,
      context,
    });

    expect(cache.get("session-1", 5)).toEqual(context);
    expect(cache.get("session-1", 6)).toEqual(context);
    expect(cache.get("session-1", 7)).toEqual(context);
    expect(cache.get("session-1", 8)).toEqual(context);
    expect(cache.get("session-1", 9)).toBeNull();
  });

  it("does not reuse an empty context across later message counts", () => {
    const cache = new MemoryContextCache();

    cache.set({
      sessionId: "session-1",
      messageCount: 5,
      userId: "user-1",
      personaId: "persona-1",
      characterId: null,
      context: createEmptyContext(),
    });

    expect(cache.get("session-1", 5)).toEqual(createEmptyContext());
    expect(cache.get("session-1", 6)).toBeNull();
    expect(cache.get("session-1", 7)).toBeNull();
  });

  it("does not reuse empty cached context across later message counts", () => {
    const cache = new MemoryContextCache();
    const emptyContext: CachedMemoryContext = {
      userProfile: null,
      recentSummaries: [],
      relevantMemories: [],
    };

    cache.set({
      sessionId: "session-1",
      messageCount: 5,
      userId: "user-1",
      personaId: "persona-1",
      characterId: null,
      context: emptyContext,
    });

    expect(cache.get("session-1", 5)).toEqual(emptyContext);
    expect(cache.get("session-1", 6)).toBeNull();
  });

  it("invalidates cache entries for the same user and persona", () => {
    const cache = new MemoryContextCache();

    cache.set({
      sessionId: "session-1",
      messageCount: 3,
      userId: "user-1",
      personaId: "persona-1",
      characterId: null,
      context: createContext("first"),
    });
    cache.set({
      sessionId: "session-2",
      messageCount: 4,
      userId: "user-1",
      personaId: "persona-2",
      characterId: null,
      context: createContext("second"),
    });

    cache.invalidate("user-1", "persona-1");

    expect(cache.get("session-1", 3)).toBeNull();
    expect(cache.get("session-2", 4)).not.toBeNull();
  });

  it("invalidates all entries under one persona", () => {
    const cache = new MemoryContextCache();

    cache.set({
      sessionId: "session-1",
      messageCount: 3,
      userId: "user-1",
      personaId: "persona-1",
      characterId: null,
      context: createContext("first"),
    });
    cache.set({
      sessionId: "session-2",
      messageCount: 3,
      userId: "user-2",
      personaId: "persona-1",
      characterId: null,
      context: createContext("second"),
    });

    cache.invalidateByPersona("persona-1");

    expect(cache.get("session-1", 3)).toBeNull();
    expect(cache.get("session-2", 3)).toBeNull();
  });

  it("returns null when cache is disabled", () => {
    process.env.MEMORY_CONTEXT_CACHE_ENABLED = "false";
    const cache = new MemoryContextCache();
    const context = createContext("disabled");

    cache.set({
      sessionId: "session-1",
      messageCount: 1,
      userId: "user-1",
      personaId: "persona-1",
      characterId: null,
      context,
    });

    expect(cache.get("session-1", 1)).toBeNull();
  });

  it("expires entries after ttl", async () => {
    const cache = new MemoryContextCache(5);
    const context = createContext("ttl");

    cache.set({
      sessionId: "session-1",
      messageCount: 1,
      userId: "user-1",
      personaId: "persona-1",
      characterId: null,
      context,
    });

    await new Promise((resolve) => setTimeout(resolve, 15));

    expect(cache.get("session-1", 1)).toBeNull();
  });
});
