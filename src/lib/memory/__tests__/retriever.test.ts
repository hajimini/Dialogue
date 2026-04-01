import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { Persona } from "@/lib/supabase/types";

const mockGet = jest.fn();
const mockSet = jest.fn();
const mockGatewayGetMemoryContext = jest.fn();
const mockGatewaySearch = jest.fn();
const mockFilterConflictingPersonaMemories = jest.fn((memories) => memories);

jest.mock("@/lib/memory/factory", () => ({
  getMemoryGateway: () => ({
    getMemoryContext: mockGatewayGetMemoryContext,
    search: mockGatewaySearch,
  }),
}));

jest.mock("@/lib/memory/memory-context-cache", () => ({
  memoryContextCache: {
    get: (...args: unknown[]) => mockGet(args),
    set: (...args: unknown[]) => mockSet(args),
  },
}));

jest.mock("@/lib/persona/identity", () => ({
  filterConflictingPersonaMemories: (...args: unknown[]) =>
    mockFilterConflictingPersonaMemories(args[0]),
}));

import { getMemoryContext } from "../retriever";

function createPersona(): Persona {
  return {
    id: "persona-1",
    name: "小芮嫣",
    avatar_url: null,
    gender: "female",
    age: 24,
    occupation: "调香师",
    city: "台北",
    personality: "自然、细腻",
    speaking_style: "口语化",
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
    created_at: "2026-04-01T00:00:00.000Z",
    updated_at: "2026-04-01T00:00:00.000Z",
  };
}

describe("retriever fallback behavior", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGet.mockReturnValue(null);
  });

  it("falls back to latest memories when contextual retrieval returns empty for a session", async () => {
    mockGatewayGetMemoryContext.mockResolvedValue({
      userProfile: null,
      recentSummaries: [],
      relevantMemories: [],
    } as never);
    mockGatewaySearch.mockResolvedValue({
      memories: [
        {
          id: "memory-1",
          userId: "user-1",
          personaId: "persona-1",
          memoryType: "user_fact",
          content: "最喜欢的花是向日葵",
          importance: 0.8,
          sourceSessionId: "session-1",
          createdAt: "2026-04-01T00:00:00.000Z",
          updatedAt: "2026-04-01T00:00:00.000Z",
        },
      ],
      totalCount: 1,
    } as never);

    const result = await getMemoryContext({
      userId: "user-1",
      personaId: "persona-1",
      characterId: "character-1",
      persona: createPersona(),
      query: "我最喜欢的花是什么？",
      limit: 5,
      sessionId: "session-1",
      messageCount: 7,
    });

    expect(mockGatewaySearch).toHaveBeenCalledWith({
      userId: "user-1",
      personaId: "persona-1",
      characterId: "character-1",
      query: "",
      limit: 10,
    });
    expect(result.relevantMemories).toHaveLength(1);
    expect(result.relevantMemories[0]?.content).toContain("向日葵");
  });
});
