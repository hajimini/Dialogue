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
          '张三': [0, 1, 2],
          '名字': [0, 1, 2],
          '叫': [0, 1, 2],
          '什么': [0, 1, 2],
          '我': [0, 1, 2],
          '喜欢': [10, 11, 12],
          '篮球': [10, 11, 12],
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

describe("Character Memory Isolation", () => {
  const supabase = getSupabaseAdminClient();
  const testEmail = `memory-isolation-${Date.now()}@example.com`;
  let testUserId: string;
  let testPersonaId: string;
  let characterAId: string;
  let characterBId: string;
  let memoryAdapter: Mem0Adapter;

  beforeAll(async () => {
    // Create test user
    const user = await registerLocalUser({
      email: testEmail,
      password: "password123",
      nickname: "Memory Test User",
    });
    testUserId = user.id;

    // Get a persona
    const { data: personas } = await supabase
      .from("personas")
      .select("id")
      .limit(1)
      .single();
    testPersonaId = personas?.id || "";

    // Create two test characters
    const { data: charA } = await supabase
      .from("user_characters")
      .insert({
        owner_id: testUserId,
        name: "Character A",
        personality: "Character A personality",
        is_active: true,
      })
      .select("id")
      .single();
    characterAId = charA?.id || "";

    const { data: charB } = await supabase
      .from("user_characters")
      .insert({
        owner_id: testUserId,
        name: "Character B",
        personality: "Character B personality",
        is_active: true,
      })
      .select("id")
      .single();
    characterBId = charB?.id || "";

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
  }, 30000);

  afterAll(async () => {
    // Cleanup
    await supabase.from("memories").delete().eq("user_id", testUserId);
    await supabase.from("user_characters").delete().eq("owner_id", testUserId);
    await supabase.auth.admin.deleteUser(testUserId);
    await supabase.from("profiles").delete().eq("id", testUserId);
  });

  test("Character B 不能读取 Character A 的记忆", async () => {
    // Character A 创建记忆
    const addParams: AddMemoryParams = {
      userId: testUserId,
      personaId: testPersonaId,
      characterId: characterAId,
      content: "我叫张三，喜欢打篮球",
      memoryType: "user_fact",
      importance: 0.8,
    };

    await memoryAdapter.add(addParams);

    // Character B 搜索
    const results = await memoryAdapter.search({
      userId: testUserId,
      personaId: testPersonaId,
      characterId: characterBId,
      query: "我叫什么名字",
      limit: 10,
    });

    expect(results.memories).toHaveLength(0);
  });

  test("Character A 可以读取自己的记忆", async () => {
    // Character A 搜索
    const results = await memoryAdapter.search({
      userId: testUserId,
      personaId: testPersonaId,
      characterId: characterAId,
      query: "我叫什么名字",
      limit: 10,
    });

    expect(results.memories.length).toBeGreaterThan(0);
    expect(results.memories[0].content).toContain("张三");
  });
});
