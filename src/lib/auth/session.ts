import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { AppUserRecord, AppUserRole } from "@/lib/supabase/types";

const AUTH_COOKIE_NAME = "ai_companion_session";
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
const DEFAULT_DEMO_USER_EMAIL =
  process.env.DEMO_USER_EMAIL || "demo@ai-companion.local";
const DEFAULT_DEMO_USER_PASSWORD =
  process.env.DEMO_USER_PASSWORD || "demo123456";
const DEFAULT_DEMO_ADMIN_EMAIL =
  process.env.DEMO_ADMIN_EMAIL || "admin@ai-companion.local";
const DEFAULT_DEMO_ADMIN_PASSWORD =
  process.env.DEMO_ADMIN_PASSWORD || "admin123456";

type SessionPayload = {
  sub: string;
  email: string;
  nickname: string;
  role: AppUserRole;
  exp: number;
};

type ProfileRow = {
  id: string;
  nickname: string | null;
  role: AppUserRole | null;
  created_at: string | null;
};

let cachedAnonClient: SupabaseClient | null = null;

function getSessionSecret() {
  return process.env.AUTH_SESSION_SECRET || "local-dev-auth-secret";
}

function getSupabaseAnonAuthClient() {
  if (cachedAnonClient) {
    return cachedAnonClient;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("缺少环境变量：NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }

  cachedAnonClient = createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return cachedAnonClient;
}

function base64UrlEncode(value: string | Buffer) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlDecode(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  return Buffer.from(normalized + padding, "base64").toString("utf8");
}

function signPayload(payload: string) {
  return base64UrlEncode(
    createHmac("sha256", getSessionSecret()).update(payload).digest(),
  );
}

function createSessionToken(user: AppUserRecord) {
  const payload = base64UrlEncode(
    JSON.stringify({
      sub: user.id,
      email: user.email,
      nickname: user.nickname,
      role: user.role,
      exp: Date.now() + COOKIE_MAX_AGE_SECONDS * 1000,
    } satisfies SessionPayload),
  );

  return `${payload}.${signPayload(payload)}`;
}

function verifySessionToken(token: string | undefined) {
  if (!token) return null;

  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  const expectedSignature = signPayload(payload);
  const left = Buffer.from(signature);
  const right = Buffer.from(expectedSignature);

  if (left.length !== right.length || !timingSafeEqual(left, right)) {
    return null;
  }

  try {
    const parsed = JSON.parse(base64UrlDecode(payload)) as SessionPayload;
    if (!parsed.sub || parsed.exp <= Date.now()) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function normalizeNickname(email: string, nickname?: string | null) {
  const trimmed = nickname?.trim();
  if (trimmed) {
    return trimmed;
  }

  return email.split("@")[0] || "User";
}

function toPublicUser(input: {
  id: string;
  email: string;
  nickname: string;
  role: AppUserRole;
  createdAt?: string | null;
  lastLoginAt?: string | null;
}): AppUserRecord {
  return {
    id: input.id,
    email: input.email,
    nickname: input.nickname,
    role: input.role,
    created_at: input.createdAt ?? null,
    last_login_at: input.lastLoginAt ?? null,
  };
}

async function upsertProfile(input: {
  id: string;
  email: string;
  nickname?: string | null;
  role?: AppUserRole;
}) {
  const supabase = getSupabaseAdminClient();
  const payload = {
    id: input.id,
    nickname: normalizeNickname(input.email, input.nickname),
    role: input.role ?? "user",
  };

  const { data, error } = await supabase
    .from("profiles")
    .upsert(payload, { onConflict: "id" })
    .select("id,nickname,role,created_at")
    .single();

  if (error || !data) {
    throw new Error(error?.message || "初始化用户资料失败");
  }

  return data as ProfileRow;
}

async function listAuthUsers() {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });

  if (error) {
    throw new Error(`读取 Supabase 用户列表失败：${error.message}`);
  }

  return data.users;
}

async function loadProfilesByIds(userIds: string[]) {
  if (userIds.length === 0) {
    return new Map<string, ProfileRow>();
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id,nickname,role,created_at")
    .in("id", userIds);

  if (error) {
    throw new Error(`读取用户资料失败：${error.message}`);
  }

  return new Map((data ?? []).map((item) => [item.id, item as ProfileRow]));
}

async function ensureAuthUser(input: {
  email: string;
  password: string;
  nickname: string;
  role: AppUserRole;
}) {
  const supabase = getSupabaseAdminClient();
  const users = await listAuthUsers();
  const existingUser = users.find((user) => user.email === input.email);

  if (existingUser?.id) {
    await upsertProfile({
      id: existingUser.id,
      email: existingUser.email ?? input.email,
      nickname: input.nickname,
      role: input.role,
    });
    return existingUser.id;
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: {
      nickname: input.nickname,
    },
  });

  if (error || !data.user?.id) {
    throw new Error(error?.message || "创建 Supabase 用户失败");
  }

  await upsertProfile({
    id: data.user.id,
    email: input.email,
    nickname: input.nickname,
    role: input.role,
  });

  return data.user.id;
}

async function loadAppUserById(userId: string) {
  const supabase = getSupabaseAdminClient();
  const [{ data: authResult, error: authError }, { data: profile, error: profileError }] =
    await Promise.all([
      supabase.auth.admin.getUserById(userId),
      supabase
        .from("profiles")
        .select("id,nickname,role,created_at")
        .eq("id", userId)
        .maybeSingle(),
    ]);

  if (authError) {
    throw new Error(`读取认证用户失败：${authError.message}`);
  }

  if (profileError) {
    throw new Error(`读取用户资料失败：${profileError.message}`);
  }

  const authUser = authResult.user;
  if (!authUser?.id || !authUser.email) {
    return null;
  }

  const normalizedProfile =
    (profile as ProfileRow | null) ??
    (await upsertProfile({
      id: authUser.id,
      email: authUser.email,
      nickname: normalizeNickname(authUser.email, authUser.user_metadata?.nickname),
      role: "user",
    }));

  return toPublicUser({
    id: authUser.id,
    email: authUser.email,
    nickname: normalizeNickname(authUser.email, normalizedProfile.nickname),
    role: normalizedProfile.role ?? "user",
    createdAt: normalizedProfile.created_at ?? authUser.created_at ?? null,
    lastLoginAt: authUser.last_sign_in_at ?? null,
  });
}

export async function ensureSeedUsers() {
  await ensureAuthUser({
    email: DEFAULT_DEMO_USER_EMAIL,
    password: DEFAULT_DEMO_USER_PASSWORD,
    nickname: "Demo User",
    role: "user",
  });

  await ensureAuthUser({
    email: DEFAULT_DEMO_ADMIN_EMAIL,
    password: DEFAULT_DEMO_ADMIN_PASSWORD,
    nickname: "Admin",
    role: "admin",
  });
}

export async function listAppUsers() {
  await ensureSeedUsers();
  const users = await listAuthUsers();
  const profiles = await loadProfilesByIds(users.map((user) => user.id));

  return users.map((user) => {
    const profile = profiles.get(user.id);
    const email = user.email ?? "";
    return toPublicUser({
      id: user.id,
      email,
      nickname: normalizeNickname(email, profile?.nickname ?? user.user_metadata?.nickname),
      role: profile?.role ?? "user",
      createdAt: profile?.created_at ?? user.created_at ?? null,
      lastLoginAt: user.last_sign_in_at ?? null,
    });
  });
}

export async function findAppUserById(userId: string) {
  await ensureSeedUsers();
  return loadAppUserById(userId);
}

export async function getFallbackDemoUser() {
  await ensureSeedUsers();
  const users = await listAppUsers();
  return (
    users.find((item) => item.email.toLowerCase() === DEFAULT_DEMO_USER_EMAIL.toLowerCase()) ??
    users.find((item) => item.role === "user") ??
    null
  );
}

export async function registerLocalUser(input: {
  email: string;
  password: string;
  nickname: string;
}) {
  const email = input.email.trim().toLowerCase();
  const nickname = input.nickname.trim();
  const password = input.password.trim();

  if (!email || !nickname || password.length < 6) {
    throw new Error("Please provide a valid email, nickname, and password.");
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      nickname,
    },
  });

  if (error || !data.user?.id) {
    throw new Error(error?.message || "This email is already registered.");
  }

  await upsertProfile({
    id: data.user.id,
    email,
    nickname,
    role: "user",
  });

  return toPublicUser({
    id: data.user.id,
    email,
    nickname,
    role: "user",
    createdAt: data.user.created_at ?? null,
    lastLoginAt: data.user.last_sign_in_at ?? null,
  });
}

export async function authenticateLocalUser(email: string, password: string) {
  await ensureSeedUsers();
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedPassword = password.trim();
  const authClient = getSupabaseAnonAuthClient();
  const { data, error } = await authClient.auth.signInWithPassword({
    email: normalizedEmail,
    password: normalizedPassword,
  });

  if (error || !data.user?.id || !data.user.email) {
    throw new Error("Incorrect email or password.");
  }

  const existing = await loadAppUserById(data.user.id);
  if (existing) {
    return existing;
  }

  const profile = await upsertProfile({
    id: data.user.id,
    email: data.user.email,
    nickname: data.user.user_metadata?.nickname,
    role: "user",
  });

  return toPublicUser({
    id: data.user.id,
    email: data.user.email,
    nickname: normalizeNickname(data.user.email, profile.nickname),
    role: profile.role ?? "user",
    createdAt: profile.created_at ?? data.user.created_at ?? null,
    lastLoginAt: data.user.last_sign_in_at ?? null,
  });
}

export async function getCurrentAppUser() {
  await ensureSeedUsers();
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  const payload = verifySessionToken(token);

  if (!payload) {
    return null;
  }

  const directUser = await loadAppUserById(payload.sub);
  if (directUser) {
    return directUser;
  }

  return toPublicUser({
    id: payload.sub,
    email: payload.email,
    nickname: payload.nickname,
    role: payload.role,
    createdAt: null,
    lastLoginAt: null,
  });
}

export async function requireAuthenticatedUser(nextPath = "/") {
  const user = await getCurrentAppUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  }
  return user;
}

export async function requireAdminUser(nextPath = "/admin/dashboard") {
  const user = await requireAuthenticatedUser(nextPath);
  if (user.role !== "admin") {
    redirect("/");
  }
  return user;
}

export async function requireAdminApiAccess() {
  const user = await getCurrentAppUser();

  if (!user || user.role !== "admin") {
    return {
      user: null,
      response: NextResponse.json(
        { success: false, data: null, error: { message: "Admin access required." } },
        { status: user ? 403 : 401 },
      ),
    };
  }

  return {
    user,
    response: null,
  };
}

export function attachAuthCookie(response: NextResponse, user: AppUserRecord) {
  response.cookies.set({
    name: AUTH_COOKIE_NAME,
    value: createSessionToken(user),
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE_SECONDS,
    secure: process.env.NODE_ENV === "production",
  });

  return response;
}

export function clearAuthCookie(response: NextResponse) {
  response.cookies.set({
    name: AUTH_COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
    secure: process.env.NODE_ENV === "production",
  });

  return response;
}

export function getDemoCredentialHints() {
  return {
    demoUser: {
      email: DEFAULT_DEMO_USER_EMAIL,
      password: DEFAULT_DEMO_USER_PASSWORD,
    },
    adminUser: {
      email: DEFAULT_DEMO_ADMIN_EMAIL,
      password: DEFAULT_DEMO_ADMIN_PASSWORD,
    },
  };
}
