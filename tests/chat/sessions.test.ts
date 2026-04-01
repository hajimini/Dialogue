import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env.local for integration tests
dotenv.config({ path: path.join(__dirname, '..', '..', '.env.local') });

import { createSession, getSessionById } from "@/lib/chat/sessions";
import { registerLocalUser } from "@/lib/auth/session";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

describe("Session Management", () => {
  const supabase = getSupabaseAdminClient();
  const testEmail = `session-test-${Date.now()}@example.com`;
  let testUserId: string;
  let testPersonaId: string;
  let testCharacterId: string;

  beforeAll(async () => {
    // Create test user
    const user = await registerLocalUser({
      email: testEmail,
      password: "password123",
      nickname: "Session Test User",
    });
    testUserId = user.id;

    // Get a persona
    const { data: personas } = await supabase
      .from("personas")
      .select("id")
      .limit(1)
      .single();
    testPersonaId = personas?.id || "";

    // Create a test character
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
  });

  afterAll(async () => {
    // Cleanup
    await supabase.from("sessions").delete().eq("user_id", testUserId);
    await supabase.from("user_characters").delete().eq("owner_id", testUserId);
    await supabase.auth.admin.deleteUser(testUserId);
    await supabase.from("profiles").delete().eq("id", testUserId);
  });

  test("新会话写入真实用户 UUID", async () => {
    const session = await createSession(testPersonaId, {
      userId: testUserId,
      characterId: testCharacterId,
    });

    expect(session.user_id).toBe(testUserId);
    expect(session.user_id).not.toBe("demo-local-user");
    expect(session.persona_id).toBe(testPersonaId);
    expect(session.character_id).toBe(testCharacterId);
    expect(session.status).toBe("active");
  });

  test("会话可以通过 ID 查询", async () => {
    const session = await createSession(testPersonaId, {
      userId: testUserId,
      characterId: testCharacterId,
    });

    const retrieved = await getSessionById(session.id, { userId: testUserId });

    expect(retrieved.id).toBe(session.id);
    expect(retrieved.user_id).toBe(testUserId);
    expect(retrieved.persona_id).toBe(testPersonaId);
  });
});
