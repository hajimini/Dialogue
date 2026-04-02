import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { Persona, MemoryRecord, UserProfilePerPersonaRecord } from "@/lib/supabase/types";

const mockSupabase = {
  from: jest.fn(),
  rpc: jest.fn(),
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

function createMemoryRecord(overrides: Partial<MemoryRecord> = {}): MemoryRecord {
  return {
    id: "memory-1",
    user_id: "storage-user-1",
    persona_id: "persona-1",
    memory_type: "user_fact",
    content: "用户提过那只橘猫会来楼下",
    embedding: [1, 0, 0],
    importance: 0.7,
    source_session_id: "session-1",
    created_at: "2026-03-28T00:00:00.000Z",
    updated_at: "2026-03-28T00:00:00.000Z",
    ...overrides,
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
    personality: "敏感细腻",
    speaking_style: "自然口语",
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
    character_id: "char-1",
    relationship_stage: "warming",
    total_messages: 8,
    updated_at: "2026-03-28T00:00:00.000Z",
    profile_data: {
      summary: "用户最近一直在聊楼下那只橘猫。",
      facts: ["用户会喂楼下的橘猫"],
      preferences: ["喜欢逛展"],
      relationship_notes: ["对细节很敏感"],
      recent_topics: ["橘猫", "看展"],
      anchors: ["橘猫", "楼下", "那个展"],
    },
  };
}

function createInsertChain(record: MemoryRecord) {
  return {
    insert: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    single: jest.fn(async () => ({ data: record, error: null })),
  };
}

function createListChain(records: MemoryRecord[]) {
  return {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn(async () => ({
      data: records,
      error: null,
      count: records.length,
    })),
  };
}

function _createSearchChain(records: MemoryRecord[]) {
  return {
    rpc: jest.fn(async () => ({
      data: records,
      error: null,
      count: records.length,
    })),
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
  };
}

describe("Mem0Adapter", () => {
  let config: Mem0AdapterConfig;
  let adapter: Mem0Adapter;

  beforeEach(() => {
    jest.clearAllMocks();

    config = {
      apiKey: "test-mem0-key",
      supabaseUrl: "https://test.supabase.co",
      supabaseKey: "test-supabase-key",
      embeddingConfig: {
        provider: "openai",
        apiKey: "test-openai-key",
        model: "text-embedding-3-large",
      },
      rerankerConfig: {
        provider: "jina",
        apiKey: "test-jina-key",
      },
      retrievalLimit: 5,
    };

    mockResolveMemoryStorageUserId.mockResolvedValue("storage-user-1");
    mockEmbed.mockResolvedValue([1, 0, 0]);
    mockRerank.mockResolvedValue([]);
    mockLog.mockResolvedValue(undefined);

    adapter = new Mem0Adapter(config);
  });

  it("initializes dependent services from config", () => {
    expect(adapter).toBeDefined();
  });

  it("adds a memory and normalizes the storage user id", async () => {
    const insertedRecord = createMemoryRecord();
    const insertChain = createInsertChain(insertedRecord);
    mockSupabase.from.mockReturnValueOnce(insertChain);

    const result = await adapter.add({
      userId: "demo-local-user",
      personaId: "persona-1",
      characterId: "char-1",
      memoryType: "user_fact",
      content: "用户提过那只橘猫会来楼下",
      importance: 0.7,
      sourceSessionId: "session-1",
    });

    expect(insertChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "storage-user-1",
        persona_id: "persona-1",
      }),
    );
    expect(result.userId).toBe("demo-local-user");
    expect(result.embedding).toEqual([1, 0, 0]);
    expect(mockInvalidate).toHaveBeenCalledWith("demo-local-user", "persona-1");
    expect(mockRecordMetric).toHaveBeenCalledWith(
      "memory.add.duration",
      expect.any(Number),
    );
  });

  it("lists memories directly when the search query is empty", async () => {
    const listChain = createListChain([
      createMemoryRecord({ id: "memory-1", updated_at: "2026-03-28T10:00:00.000Z" }),
      createMemoryRecord({ id: "memory-2", updated_at: "2026-03-28T09:00:00.000Z" }),
    ]);
    mockSupabase.from.mockReturnValueOnce(listChain);

    const result = await adapter.search({
      userId: "demo-local-user",
      personaId: "persona-1",
      characterId: "char-1",
      query: "   ",
    });

    expect(listChain.order).toHaveBeenCalledWith("updated_at", { ascending: false });
    expect(listChain.limit).toHaveBeenCalledTimes(1);
    expect(result.totalCount).toBe(2);
    expect(result.memories.map((memory) => memory.id)).toEqual(["memory-1", "memory-2"]);
  });

  it("reranks semantic search results and exposes scored memories", async () => {
    // Mock RPC response format (not full MemoryRecord, just RPC fields)
    const rpcResults = [
      {
        id: "memory-1",
        content: "用户最近在聊那个展",
        memory_type: "user_fact",
        importance: 0.7,
        similarity: 0.85,
        created_at: "2026-03-28T00:00:00.000Z",
      },
      {
        id: "memory-2",
        content: "楼下那只橘猫今天又来了",
        memory_type: "user_fact",
        importance: 0.7,
        similarity: 0.90,
        created_at: "2026-03-28T00:00:00.000Z",
      },
    ];

    (
      mockSupabase.rpc as unknown as {
        mockResolvedValueOnce: (value: unknown) => void;
      }
    ).mockResolvedValueOnce({
      data: rpcResults,
      error: null,
    });

    mockRerank.mockResolvedValue([
      { index: 1, relevanceScore: 0.96 },
      { index: 0, relevanceScore: 0.74 },
    ]);

    const incrementRetrievalCounts = jest
      .spyOn(
        adapter as unknown as {
          incrementRetrievalCounts(memoryIds: string[]): Promise<void>;
        },
        "incrementRetrievalCounts",
      )
      .mockResolvedValue(undefined);

    const result = await adapter.search({
      userId: "demo-local-user",
      personaId: "persona-1",
      characterId: "char-1",
      query: "那只猫今天又来了",
      limit: 2,
    });

    expect(mockEmbed).toHaveBeenCalledWith("那只猫今天又来了");
    expect(mockRerank).toHaveBeenCalledWith("那只猫今天又来了", [
      "用户最近在聊那个展",
      "楼下那只橘猫今天又来了",
    ]);
    expect(incrementRetrievalCounts).toHaveBeenCalledWith(["memory-2", "memory-1"]);
    expect(result.memories[0].id).toBe("memory-2");
    expect(result.scoredMemories?.[0].rerankerScore).toBe(0.96);
  });

  it("expands continuation queries with profile anchors and recent topics", () => {
    const helpers = adapter as unknown as {
      buildEnhancedQuery(params: {
        originalQuery: string;
        queryAnchors: string[];
        profileAnchors: string[];
        recentTopics: string[];
        hasContinuationCue: boolean;
      }): string;
    };

    const enhancedQuery = helpers.buildEnhancedQuery({
      originalQuery: "那只猫今天又来了",
      queryAnchors: ["那只猫", "猫"],
      profileAnchors: ["橘猫", "楼下", "喂猫", "多余锚点"],
      recentTopics: ["天气", "晚饭", "看展", "额外主题"],
      hasContinuationCue: true,
    });

    expect(enhancedQuery).toContain("那只猫今天又来了");
    expect(enhancedQuery).toContain("橘猫 楼下 喂猫");
    expect(enhancedQuery).toContain("天气 晚饭 看展");
    expect(enhancedQuery).not.toContain("多余锚点");
    expect(enhancedQuery).not.toContain("额外主题");
  });

  it("builds memory context with doubled search limit and trims final results", async () => {
    const searchSpy = jest.spyOn(adapter, "search").mockResolvedValue({
      memories: [
        {
          id: "memory-1",
          userId: "demo-local-user",
          personaId: "persona-1",
          memoryType: "user_fact",
          content: "楼下那只橘猫今天又来了",
          importance: 0.8,
          sourceSessionId: null,
          createdAt: "2026-03-28T00:00:00.000Z",
          updatedAt: "2026-03-28T00:00:00.000Z",
        },
        {
          id: "memory-2",
          userId: "demo-local-user",
          personaId: "persona-1",
          memoryType: "shared_event",
          content: "用户今天去看了那个展",
          importance: 0.6,
          sourceSessionId: null,
          createdAt: "2026-03-28T00:00:00.000Z",
          updatedAt: "2026-03-28T00:00:00.000Z",
        },
        {
          id: "memory-3",
          userId: "demo-local-user",
          personaId: "persona-1",
          memoryType: "relationship",
          content: "最近聊天节奏更自然了",
          importance: 0.5,
          sourceSessionId: null,
          createdAt: "2026-03-28T00:00:00.000Z",
          updatedAt: "2026-03-28T00:00:00.000Z",
        },
      ],
      totalCount: 3,
    });
    jest.spyOn(adapter, "getUserProfile").mockResolvedValue(createProfile());
    jest
      .spyOn(
        adapter as unknown as {
          getRecentSummaries(
            userId: string,
            personaId: string,
            characterId: string,
          ): Promise<
            Array<{ id: string; topics: string[] | null; summary: string | null; user_id: string; persona_id: string; status: "active" | "ended" | "archived"; started_at: string | null; last_message_at: string | null; ended_at: string | null }>
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
          summary: "今天又聊到那只猫。",
          topics: ["橘猫", "晚饭"],
          started_at: null,
          last_message_at: null,
          ended_at: null,
        },
      ]);

    const context = await adapter.getMemoryContext({
      userId: "demo-local-user",
      personaId: "persona-1",
      characterId: "char-1",
      persona: createPersona(),
      query: "那只猫今天又来了",
      limit: 2,
    });

    expect(searchSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "demo-local-user",
        personaId: "persona-1",
        limit: 4,
      }),
    );
    expect(context.userProfile?.id).toBe("profile-1");
    expect(context.recentSummaries).toHaveLength(1);
    expect(context.relevantMemories).toHaveLength(2);
    expect(mockRecordMetric).toHaveBeenCalledWith(
      "memory.getContext.duration",
      expect.any(Number),
    );
  });
});
