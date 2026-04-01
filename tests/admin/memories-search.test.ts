import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env.local for integration tests
dotenv.config({ path: path.join(__dirname, '..', '..', '.env.local') });

import { Mem0Adapter } from "@/lib/memory/adapters/mem0-adapter";
import { registerLocalUser } from "@/lib/auth/session";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { AddMemoryParams } from "@/lib/memory/types";

// Mock embedding service to return consistent vectors for testing
jest.mock("@/lib/memory/services/embedding-service", () => {
  return {
    EmbeddingService: jest.fn().mockImplementation(() => ({
      embed: jest.fn((text: string) => {
        // Create simple keyword-based embeddings for testing
        const vector = new Array(1536).fill(0);
        const keywords = text.toLowerCase().split(/\s+/);

        // Map keywords to vector positions for semantic similarity
        const keywordMap: Record<string, number[]> = {
          '李四': [0, 1, 2],
          '名字': [0, 1, 2],
          '叫': [0, 1, 2],
          '什么': [0, 1, 2],
          '我': [0, 1, 2],
          '喜欢': [10, 11, 12],
          '篮球': [10, 11, 12],
          '游泳': [10, 11, 12],
          '爱好': [10, 11, 12],
          '最': [10, 11, 12],
          '软件工程师': [20, 21, 22],
          '科技公司': [20, 21, 22],
          '工作': [20, 21, 22],
          '做': [20, 21, 22],
          '职业': [20, 21, 22],
          '北京': [30, 31, 32],
          '朝阳区': [30, 31, 32],
          '住': [30, 31, 32],
          '哪里': [30, 31, 32],
          '地址': [30, 31, 32],
        };

        keywords.forEach(keyword => {
          const positions = keywordMap[keyword];
          if (positions) {
            positions.forEach(pos => {
              vector[pos] = 1.0;
            });
          }
        });

        // Normalize
        const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
        if (magnitude > 0) {
          return vector.map(val => val / magnitude);
        }
        return vector;
      }),
    })),
  };
});

describe("Admin Memory Search Quality", () => {
  const supabase = getSupabaseAdminClient();
  const testEmail = `admin-search-${Date.now()}@example.com`;
  let testUserId: string;
  let testPersonaId: string;
  let testCharacterId: string;
  let memoryAdapter: Mem0Adapter;

  beforeAll(async () => {
    // Create test user
    const user = await registerLocalUser({
      email: testEmail,
      password: "password123",
      nickname: "Admin Search Test User",
    });
    testUserId = user.id;

    // Get a persona
    const { data: personas } = await supabase
      .from("personas")
      .select("id")
      .limit(1)
      .single();
    testPersonaId = personas?.id || "";

    // Create test character
    const { data: character } = await supabase
      .from("user_characters")
      .insert({
        owner_id: testUserId,
        name: "Test Character",
        personality: "Test personality",
        is_active: true,
      })
      .select("id")
      .single();
    testCharacterId = character?.id || "";

    // Initialize memory adapter
    memoryAdapter = new Mem0Adapter({
      apiKey: "",
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://localhost",
      supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
      embeddingConfig: {
        provider: "openai",
        apiKey: process.env.EMBEDDING_API_KEY ?? "",
        model: "text-embedding-3-large",
      },
      rerankerConfig: {
        provider: "none",
        apiKey: process.env.RERANKER_API_KEY ?? "",
      },
      retrievalLimit: 10,
    });

    // Create test memories
    const memories = [
      "用户叫李四，今年28岁",
      "李四喜欢打篮球和游泳",
      "李四在一家科技公司工作，是软件工程师",
      "李四住在北京朝阳区",
    ];

    for (const content of memories) {
      const addParams: AddMemoryParams = {
        userId: testUserId,
        personaId: testPersonaId,
        characterId: testCharacterId,
        content,
        memoryType: "user_fact",
        importance: 0.8,
      };
      await memoryAdapter.add(addParams);
    }

    // Wait for embeddings to be indexed
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }, 30000);

  afterAll(async () => {
    // Cleanup
    await supabase.from("memories").delete().eq("user_id", testUserId);
    await supabase.from("user_characters").delete().eq("owner_id", testUserId);
    await supabase.auth.admin.deleteUser(testUserId);
    await supabase.from("profiles").delete().eq("id", testUserId);
  });

  test("搜索名字应该命中相关记忆", async () => {
    const results = await memoryAdapter.search({
      userId: testUserId,
      personaId: testPersonaId,
      characterId: testCharacterId,
      query: "我叫什么名字",
      limit: 10,
    });

    expect(results.memories.length).toBeGreaterThan(0);
    const hasNameInfo = results.memories.some((m) => m.content.includes("李四"));
    expect(hasNameInfo).toBe(true);
  });

  test("搜索爱好应该命中相关记忆", async () => {
    const results = await memoryAdapter.search({
      userId: testUserId,
      personaId: testPersonaId,
      characterId: testCharacterId,
      query: "我最喜欢什么",
      limit: 10,
    });

    expect(results.memories.length).toBeGreaterThan(0);
    const hasHobbyInfo = results.memories.some(
      (m) => m.content.includes("篮球") || m.content.includes("游泳"),
    );
    expect(hasHobbyInfo).toBe(true);
  });

  test("搜索职业应该命中相关记忆", async () => {
    const results = await memoryAdapter.search({
      userId: testUserId,
      personaId: testPersonaId,
      characterId: testCharacterId,
      query: "我做什么工作",
      limit: 10,
    });

    expect(results.memories.length).toBeGreaterThan(0);
    const hasJobInfo = results.memories.some(
      (m) => m.content.includes("软件工程师") || m.content.includes("科技公司"),
    );
    expect(hasJobInfo).toBe(true);
  });

  test("搜索住址应该命中相关记忆", async () => {
    const results = await memoryAdapter.search({
      userId: testUserId,
      personaId: testPersonaId,
      characterId: testCharacterId,
      query: "我住在哪里",
      limit: 10,
    });

    expect(results.memories.length).toBeGreaterThan(0);
    const hasAddressInfo = results.memories.some(
      (m) => m.content.includes("北京") || m.content.includes("朝阳区"),
    );
    expect(hasAddressInfo).toBe(true);
  });
});
