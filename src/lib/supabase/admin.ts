import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cachedAdminClient: SupabaseClient | null = null;
let cachedDemoUserId: string | null = null;

export function getSupabaseAdminClient(): SupabaseClient {
  if (cachedAdminClient) return cachedAdminClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "缺少环境变量：NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY",
    );
  }

  cachedAdminClient = createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return cachedAdminClient;
}

export async function getOrCreateDemoUserId() {
  if (cachedDemoUserId) return cachedDemoUserId;

  const supabase = getSupabaseAdminClient();
  const demoEmail = process.env.DEMO_USER_EMAIL || "demo-user@ai-companion.local";
  const demoPassword =
    process.env.DEMO_USER_PASSWORD || "AiCompanionDemoUser#2026";

  const { data: userList, error: listError } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });

  if (listError) {
    throw new Error(`读取 Supabase 用户列表失败：${listError.message}`);
  }

  const existingUser = userList.users.find((user) => user.email === demoEmail);

  if (existingUser?.id) {
    cachedDemoUserId = existingUser.id;
  } else {
    const { data: createdUser, error: createError } =
      await supabase.auth.admin.createUser({
        email: demoEmail,
        password: demoPassword,
        email_confirm: true,
        user_metadata: {
          source: "ai-companion-demo",
        },
      });

    if (createError || !createdUser.user?.id) {
      throw new Error(createError?.message || "创建演示用户失败");
    }

    cachedDemoUserId = createdUser.user.id;
  }

  const { error: profileError } = await supabase.from("profiles").upsert(
    {
      id: cachedDemoUserId,
      nickname: "Demo User",
      role: "user",
    },
    {
      onConflict: "id",
    },
  );

  if (profileError) {
    throw new Error(`初始化演示用户资料失败：${profileError.message}`);
  }

  return cachedDemoUserId;
}
