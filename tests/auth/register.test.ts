import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env.local for integration tests
dotenv.config({ path: path.join(__dirname, '..', '..', '.env.local') });

import { registerLocalUser } from "@/lib/auth/session";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

describe("User Registration", () => {
  const supabase = getSupabaseAdminClient();
  const testEmail = `test-${Date.now()}@example.com`;

  afterAll(async () => {
    // Cleanup: delete test user
    const { data: users } = await supabase.auth.admin.listUsers();
    const testUser = users.users.find((u) => u.email === testEmail);
    if (testUser) {
      await supabase.auth.admin.deleteUser(testUser.id);
      await supabase.from("profiles").delete().eq("id", testUser.id);
    }
  });

  test("注册后用户写入 Supabase Auth + profiles", async () => {
    const user = await registerLocalUser({
      email: testEmail,
      password: "password123",
      nickname: "Test User",
    });

    expect(user.id).toBeDefined();
    expect(user.email).toBe(testEmail);
    expect(user.nickname).toBe("Test User");
    expect(user.role).toBe("user");

    // 验证 Supabase Auth
    const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(
      user.id,
    );
    expect(authError).toBeNull();
    expect(authUser.user).toBeDefined();
    expect(authUser.user?.email).toBe(testEmail);

    // 验证 profiles 表
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    expect(profileError).toBeNull();
    expect(profile).toBeDefined();
    expect(profile?.nickname).toBe("Test User");
    expect(profile?.role).toBe("user");
  });

  test("重复邮箱注册应该失败", async () => {
    await expect(
      registerLocalUser({
        email: testEmail,
        password: "password123",
        nickname: "Duplicate User",
      }),
    ).rejects.toThrow();
  });
});
