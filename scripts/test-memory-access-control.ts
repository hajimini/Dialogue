import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { config as loadEnv } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { getOrCreateDemoUserId, getSupabaseAdminClient } from "../src/lib/supabase/admin";

loadEnv({ path: path.join(process.cwd(), ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";
const demoEmail = process.env.DEMO_USER_EMAIL || "demo-user@ai-companion.local";
const demoPassword =
  process.env.DEMO_USER_PASSWORD || "AiCompanionDemoUser#2026";

function tsFilePart() {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(
    now.getHours(),
  )}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

async function signIn(email: string, password: string) {
  const client = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) {
    throw new Error(`Sign in failed for ${email}: ${error.message}`);
  }
  return client;
}

async function ensurePassword(userId: string, password: string) {
  const admin = getSupabaseAdminClient();
  const { error } = await admin.auth.admin.updateUserById(userId, {
    password,
    email_confirm: true,
  });

  if (error) {
    throw new Error(`Failed to prepare auth user ${userId}: ${error.message}`);
  }
}

async function main() {
  if (!supabaseUrl || !anonKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }

  const admin = getSupabaseAdminClient();
  const demoUserId = await getOrCreateDemoUserId();
  const reportLines = [
    "# Memory Access Control Verification",
    "",
    `- Generated at: ${new Date().toISOString()}`,
    "",
    "| Check | Result | Notes |",
    "| --- | --- | --- |",
  ];

  const { data: persona } = await admin
    .from("personas")
    .select("id,name")
    .eq("is_active", true)
    .limit(1)
    .single();

  if (!persona) {
    throw new Error("No active persona found for access-control test.");
  }

  const secondaryEmail = `memory-rls-${Date.now()}@ai-companion.local`;
  const secondaryPassword = `TempPass#${Date.now()}`;
  const { data: secondaryUser, error: createUserError } = await admin.auth.admin.createUser({
    email: secondaryEmail,
    password: secondaryPassword,
    email_confirm: true,
  });

  if (createUserError || !secondaryUser.user?.id) {
    throw new Error(createUserError?.message || "Failed to create secondary auth user");
  }

  const insertedIds: string[] = [];

  try {
    await ensurePassword(demoUserId, demoPassword);
    await ensurePassword(secondaryUser.user.id, secondaryPassword);

    const { data: ownMemory, error: ownMemoryError } = await admin
      .from("memories")
      .insert({
        user_id: demoUserId,
        persona_id: persona.id,
        memory_type: "user_fact",
        content: `RLS own read check ${Date.now()}`,
        importance: 0.6,
      })
      .select("id")
      .single();

    if (ownMemoryError || !ownMemory?.id) {
      throw new Error(ownMemoryError?.message || "Failed to insert test memory");
    }

    insertedIds.push(ownMemory.id);

    const { data: deletableMemory, error: deletableMemoryError } = await admin
      .from("memories")
      .insert({
        user_id: demoUserId,
        persona_id: persona.id,
        memory_type: "user_fact",
        content: `RLS own delete check ${Date.now()}`,
        importance: 0.6,
      })
      .select("id")
      .single();

    if (deletableMemoryError || !deletableMemory?.id) {
      throw new Error(deletableMemoryError?.message || "Failed to insert deletable memory");
    }

    insertedIds.push(deletableMemory.id);

    const demoClient = await signIn(demoEmail, demoPassword);
    const secondaryClient = await signIn(secondaryEmail, secondaryPassword);

    const ownRead = await demoClient
      .from("memories")
      .select("id,user_id")
      .eq("id", ownMemory.id);
    const foreignRead = await secondaryClient
      .from("memories")
      .select("id,user_id")
      .eq("id", ownMemory.id);
    const ownDelete = await demoClient.from("memories").delete().eq("id", deletableMemory.id);
    const deleteVerification = await admin
      .from("memories")
      .select("id")
      .eq("id", deletableMemory.id)
      .maybeSingle();

    reportLines.push(
      `| own memory read | ${
        !ownRead.error && (ownRead.data?.length ?? 0) === 1 ? "PASS" : "FAIL"
      } | ${ownRead.error?.message ?? `rows=${ownRead.data?.length ?? 0}`} |`,
    );
    reportLines.push(
      `| foreign memory isolation | ${
        !foreignRead.error && (foreignRead.data?.length ?? 0) === 0 ? "PASS" : "FAIL"
      } | ${foreignRead.error?.message ?? `rows=${foreignRead.data?.length ?? 0}`} |`,
    );
    reportLines.push(
      `| own memory delete | ${
        !ownDelete.error && !deleteVerification.data ? "PASS" : "FAIL"
      } | ${
        ownDelete.error?.message ??
        (deleteVerification.data ? "row still exists" : "deleted")
      } |`,
    );

    const feedbackInsert = await demoClient.from("memory_feedback").insert({
      user_id: demoUserId,
      memory_id: ownMemory.id,
      feedback_type: "accurate",
    });

    if (feedbackInsert.error) {
      reportLines.push(
        `| memory_feedback own insert | FAIL | ${feedbackInsert.error.message} |`,
      );
    } else {
      const ownFeedback = await demoClient
        .from("memory_feedback")
        .select("memory_id")
        .eq("memory_id", ownMemory.id);
      const foreignFeedback = await secondaryClient
        .from("memory_feedback")
        .select("memory_id")
        .eq("memory_id", ownMemory.id);

      reportLines.push(
        `| memory_feedback own insert | PASS | rows=${ownFeedback.data?.length ?? 0} |`,
      );
      reportLines.push(
        `| memory_feedback foreign isolation | ${
          !foreignFeedback.error && (foreignFeedback.data?.length ?? 0) === 0 ? "PASS" : "FAIL"
        } | ${foreignFeedback.error?.message ?? `rows=${foreignFeedback.data?.length ?? 0}`} |`,
      );
    }

    const outputDir = path.join(process.cwd(), "docs", "validation-reports");
    await mkdir(outputDir, { recursive: true });
    const outputPath = path.join(outputDir, `access-control-${tsFilePart()}.md`);
    await writeFile(outputPath, `${reportLines.join("\n")}\n`, "utf8");

    console.log(`Access-control report written to ${path.relative(process.cwd(), outputPath)}`);
    reportLines
      .filter((line) => line.startsWith("|") && !line.includes("---"))
      .forEach((line) => console.log(line));

    if (reportLines.some((line) => line.includes("| FAIL |"))) {
      process.exit(1);
    }
  } finally {
    if (insertedIds.length > 0) {
      await admin.from("memory_feedback").delete().in("memory_id", insertedIds);
      await admin.from("memories").delete().in("id", insertedIds);
    }
    await admin.auth.admin.deleteUser(secondaryUser.user.id).catch(() => undefined);
  }
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
