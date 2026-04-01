import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { Persona, UserProfilePerPersonaRecord } from "@/lib/supabase/types";

const mockSupabase = {
  from: jest.fn(),
};

const mockResolveMemoryStorageUserId = jest.fn<(userId: string) => Promise<string>>();
const mockEmbed = jest.fn<(text: string) => Promise<number[]>>();
const mockRerank = jest.fn<
  (query: string, documents: string[]) => Promise<Array<{ index: number; relevanceScore: number }>>
>();
const mockInvalidate = jest.fn<(userId: string, personaId: string) => void>();
const mockClearCache = jest.fn<() => void>();
const mockLog = jest.fn<() => Promise<void>>();
const mockRecordMetric = jest.fn<(name: string, value: number) => void>();

jest.mock("@/lib/memory/storage", () => ({
  getMemorySupabaseClient: jest.fn(() => mockSupabase),
  resolveMemoryStorageUserId: (userId: string) => mockResolveMemoryStorageUserId(userId),
}));

jest.mock("@/lib/memory/services/embedding-service", () => ({
  EmbeddingService: jest.fn().mockImplementation(() => ({
    embed: mockEmbed,
  })),
}));

jest.mock("@/lib/memory/services/reranker-service", () => ({
  RerankerService: jest.fn().mockImplementation(() => ({
    rerank: mockRerank,
  })),
}));

jest.mock("@/lib/memory/memory-context-cache", () => ({
  memoryContextCache: {
    invalidate: mockInvalidate,
    clear: mockClearCache,
  },
}));

jest.mock("@/lib/memory/memory-logger", () => ({
  memoryLogger: {
    log: mockLog,
  },
}));

jest.mock("@/lib/memory/metrics", () => ({
  memoryMetrics: {
    record: mockRecordMetric,
  },
}));

import { Mem0Adapter } from "../adapters/mem0-adapter";
import type { Mem0AdapterConfig } from "../config";

function createConfig(): Mem0AdapterConfig {
  return {
    apiKey: "test-mem0-key",
    supabaseUrl: "https://test.supabase.co",
    supabaseKey: "test-supabase-key",
    embeddingConfig: {
      provider: "openai",
      apiKey: "test-openai-key",
      model: "text-embedding-3-large",
    },
    rerankerConfig: {
      provider: "none",
      apiKey: "",
    },
    retrievalLimit: 5,
  };
}

function createPersona(): Persona {
  return {
    id: "persona-1",
    name: "小晚",
    avatar_url: null,
    gender: "female",
    age: 24,
    occupation: "策展助理",
    city: "上海",
    personality: "自然、细腻",
    speaking_style: "简短口语",
    background_story: null,
    hobbies: null,
    daily_habits: null,
    family_info: null,
    default_relationship: "friend",
    forbidden_patterns: null,
    example_dialogues: null,
    emotional_traits: null,
    quirks: null,
    is_active: true,
    created_at: "2026-03-28T00:00:00.000Z",
    updated_at: "2026-03-28T00:00:00.000Z",
  };
}

function createProfile(): UserProfilePerPersonaRecord {
  return {
    id: "profile-1",
    user_id: "storage-user-1",
    persona_id: "persona-1",
    character_id: "character-1",
    relationship_stage: "warming",
    total_messages: 10,
    updated_at: "2026-03-28T00:00:00.000Z",
    profile_data: {
      summary: "用户最近在连续聊一只橘猫和一个展。",
      facts: ["会记得聊天细节"],
      preferences: ["喜欢短句回复"],
      relationship_notes: ["已经进入熟悉阶段"],
      recent_topics: ["橘猫", "展览"],
      anchors: ["橘猫", "那个展", "楼下"],
    },
  };
}

describe("Memory system integration flows", () => {
  let adapter: Mem0Adapter;

  beforeEach(() => {
    jest.clearAllMocks();
    mockResolveMemoryStorageUserId.mockResolvedValue("storage-user-1");
    mockEmbed.mockResolvedValue([1, 0, 0]);
    mockRerank.mockResolvedValue([]);
    mockLog.mockResolvedValue(undefined);

    adapter = new Mem0Adapter(createConfig());
  });

  it("saves session memories, updates profile, and records metrics", async () => {
    const addSpy = jest
      .spyOn(adapter, "add")
      .mockResolvedValueOnce({
        id: "memory-1",
        userId: "demo-local-user",
        personaId: "persona-1",
        memoryType: "user_fact",
        content: "用户今天去看了那个展",
        importance: 0.7,
        sourceSessionId: "session-1",
        createdAt: "2026-03-28T00:00:00.000Z",
        updatedAt: "2026-03-28T00:00:00.000Z",
      })
      .mockResolvedValueOnce({
        id: "memory-2",
        userId: "demo-local-user",
        personaId: "persona-1",
        memoryType: "shared_event",
        content: "他说那个展后劲很强",
        importance: 0.6,
        sourceSessionId: "session-1",
        createdAt: "2026-03-28T00:00:00.000Z",
        updatedAt: "2026-03-28T00:00:00.000Z",
      });
    const upsertSpy = jest
      .spyOn(
        adapter as unknown as {
          upsertUserProfile(
            userId: string,
            personaId: string,
            characterId: string,
            profile: Record<string, unknown>,
          ): Promise<UserProfilePerPersonaRecord>;
        },
        "upsertUserProfile",
      )
      .mockResolvedValue(createProfile());
    const updateSessionSpy = jest
      .spyOn(
        adapter as unknown as {
          updateSession(
            sessionId: string,
            updates: { summary: string; topics: string[] },
          ): Promise<void>;
        },
        "updateSession",
      )
      .mockResolvedValue(undefined);

    const result = await adapter.saveSessionMemories({
      userId: "demo-local-user",
      personaId: "persona-1",
      characterId: "character-1",
      sessionId: "session-1",
      topics: ["展览", "橘猫"],
      summary: "用户聊了那个展，也提到楼下那只猫。",
      memories: [
        {
          memory_type: "user_fact",
          content: "用户今天去看了那个展",
          importance: 0.7,
        },
        {
          memory_type: "shared_event",
          content: "他说那个展后劲很强",
          importance: 0.6,
        },
      ],
      profile: {
        summary: "最近连续聊展览和橘猫。",
        anchors: ["那个展", "橘猫"],
        recent_topics: ["展览", "橘猫"],
        relationship_stage: "warming",
        total_messages: 10,
      },
    });

    expect(addSpy).toHaveBeenCalledTimes(2);
    expect(upsertSpy).toHaveBeenCalledWith(
      "demo-local-user",
      "persona-1",
      "character-1",
      expect.objectContaining({
        anchors: ["那个展", "橘猫"],
      }),
    );
    expect(updateSessionSpy).toHaveBeenCalledWith("session-1", {
      summary: "用户聊了那个展，也提到楼下那只猫。",
      topics: ["展览", "橘猫"],
    });
    expect(result.memories).toHaveLength(2);
    expect(result.profile.id).toBe("profile-1");
    expect(mockInvalidate).toHaveBeenCalledWith("demo-local-user", "persona-1");
    expect(mockRecordMetric).toHaveBeenCalledWith(
      "memory.saveSession.duration",
      expect.any(Number),
    );
  });

  it("enhances continuation queries before retrieving memory context", async () => {
    jest.spyOn(adapter, "getUserProfile").mockResolvedValue(createProfile());
    jest
      .spyOn(
        adapter as unknown as {
          getRecentSummaries(
            userId: string,
            personaId: string,
            characterId: string,
          ): Promise<
            Array<{
              id: string;
              user_id: string;
              persona_id: string;
              status: "active" | "ended" | "archived";
              summary: string | null;
              topics: string[] | null;
              started_at: string | null;
              last_message_at: string | null;
              ended_at: string | null;
            }>
          >;
        },
        "getRecentSummaries",
      )
      .mockResolvedValue([
        {
          id: "session-1",
          user_id: "storage-user-1",
          persona_id: "persona-1",
          status: "ended",
          summary: "用户前面一直在聊那个展。",
          topics: ["展览", "情绪"],
          started_at: null,
          last_message_at: null,
          ended_at: null,
        },
      ]);
    const searchSpy = jest.spyOn(adapter, "search").mockResolvedValue({
      memories: [
        {
          id: "memory-1",
          userId: "demo-local-user",
          personaId: "persona-1",
          memoryType: "shared_event",
          content: "用户今天去看了那个展",
          importance: 0.8,
          sourceSessionId: null,
          createdAt: "2026-03-28T00:00:00.000Z",
          updatedAt: "2026-03-28T00:00:00.000Z",
        },
      ],
      totalCount: 1,
    });

    const context = await adapter.getMemoryContext({
      userId: "demo-local-user",
      personaId: "persona-1",
      characterId: "character-1",
      persona: createPersona(),
      query: "那个展后来怎么样",
      limit: 2,
    });

    expect(searchSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.stringContaining("那个展后来怎么样"),
      }),
    );
    expect(searchSpy.mock.calls[0]?.[0].query).toEqual(
      expect.stringContaining("橘猫 那个展 楼下"),
    );
    expect(searchSpy.mock.calls[0]?.[0].query).toEqual(
      expect.stringContaining("展览 情绪"),
    );
    expect(context.relevantMemories).toHaveLength(1);
    expect(mockRecordMetric).toHaveBeenCalledWith(
      "memory.getContext.duration",
      expect.any(Number),
    );
  });

  it("falls back gracefully when semantic search finds nothing", async () => {
    jest.spyOn(adapter, "getUserProfile").mockResolvedValue(null);
    jest
      .spyOn(
        adapter as unknown as {
          getRecentSummaries(
            userId: string,
            personaId: string,
            characterId: string,
          ): Promise<unknown[]>;
        },
        "getRecentSummaries",
      )
      .mockResolvedValue([]);
    jest.spyOn(adapter, "search").mockResolvedValue({
      memories: [],
      totalCount: 0,
    });

    const context = await adapter.getMemoryContext({
      userId: "demo-local-user",
      personaId: "persona-1",
      characterId: "character-1",
      persona: createPersona(),
      query: "今天有点累",
      limit: 3,
    });

    expect(context.userProfile).toBeNull();
    expect(context.recentSummaries).toEqual([]);
    expect(context.relevantMemories).toEqual([]);
  });
});
