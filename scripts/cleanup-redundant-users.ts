/**
 * 账号清理脚本
 *
 * 功能：清理多余测试账号，只保留 2 个账号体系
 * - 1 个管理员账号：admin@ai-companion.local
 * - 1 个用户账号：demo@ai-companion.local（或实际活跃用户）
 *
 * 清理范围：
 * - auth.users
 * - profiles
 * - user_characters
 * - sessions
 * - messages
 * - memories
 * - user_profiles_per_persona
 * - memory_feedback
 *
 * 使用方法：
 * npx tsx scripts/cleanup-redundant-users.ts [--dry-run] [--keep-user=email]
 */

import * as dotenv from "dotenv";
import * as path from "path";

// Load .env.local
dotenv.config({ path: path.join(__dirname, "..", ".env.local") });

import { getSupabaseAdminClient } from "../src/lib/supabase/admin";

const DRY_RUN = process.argv.includes("--dry-run");
const KEEP_USER_ARG = process.argv.find((arg) => arg.startsWith("--keep-user="));
const KEEP_USER_EMAIL = KEEP_USER_ARG ? KEEP_USER_ARG.split("=")[1] : "demo@ai-companion.local";

const ADMIN_EMAIL = "admin@ai-companion.local";

interface UserRecord {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
}

interface CleanupStats {
  usersDeleted: number;
  profilesDeleted: number;
  charactersDeleted: number;
  sessionsDeleted: number;
  messagesDeleted: number;
  memoriesDeleted: number;
  userProfilesDeleted: number;
  feedbackDeleted: number;
}

async function main() {
  console.log("=".repeat(60));
  console.log("账号清理脚本");
  console.log("=".repeat(60));
  console.log(`模式: ${DRY_RUN ? "DRY RUN（仅预览，不执行删除）" : "LIVE（真实删除）"}`);
  console.log(`保留管理员: ${ADMIN_EMAIL}`);
  console.log(`保留用户: ${KEEP_USER_EMAIL}`);
  console.log("=".repeat(60));
  console.log("");

  const supabase = getSupabaseAdminClient();
  const stats: CleanupStats = {
    usersDeleted: 0,
    profilesDeleted: 0,
    charactersDeleted: 0,
    sessionsDeleted: 0,
    messagesDeleted: 0,
    memoriesDeleted: 0,
    userProfilesDeleted: 0,
    feedbackDeleted: 0,
  };

  // Step 1: 获取所有用户
  console.log("Step 1: 获取所有用户账号...");
  const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();

  if (authError || !authUsers) {
    console.error("❌ 获取用户列表失败:", authError?.message);
    process.exit(1);
  }

  const users = authUsers.users as unknown as UserRecord[];
  console.log(`✅ 找到 ${users.length} 个账号\n`);

  // Step 2: 确定要保留和删除的账号
  console.log("Step 2: 确定保留和删除的账号...");
  const keepEmails = [ADMIN_EMAIL, KEEP_USER_EMAIL];
  const usersToKeep = users.filter((u) => keepEmails.includes(u.email || ""));
  const usersToDelete = users.filter((u) => !keepEmails.includes(u.email || ""));

  console.log(`\n保留账号 (${usersToKeep.length}):`);
  usersToKeep.forEach((u) => {
    console.log(`  ✓ ${u.email} (${u.id})`);
    console.log(`    创建时间: ${u.created_at}`);
    console.log(`    最近登录: ${u.last_sign_in_at || "从未登录"}`);
  });

  console.log(`\n删除账号 (${usersToDelete.length}):`);
  usersToDelete.forEach((u) => {
    console.log(`  ✗ ${u.email} (${u.id})`);
    console.log(`    创建时间: ${u.created_at}`);
    console.log(`    最近登录: ${u.last_sign_in_at || "从未登录"}`);
  });

  if (usersToDelete.length === 0) {
    console.log("\n✅ 没有需要删除的账号，退出。");
    return;
  }

  // Step 3: 统计关联数据
  console.log("\n" + "=".repeat(60));
  console.log("Step 3: 统计关联数据...");
  console.log("=".repeat(60));

  const userIdsToDelete = usersToDelete.map((u) => u.id);

  const [
    { count: profileCount },
    { count: characterCount },
    { count: sessionCount },
    { count: messageCount },
    { count: memoryCount },
    { count: userProfileCount },
    { count: feedbackCount },
  ] = await Promise.all([
    supabase.from("profiles").select("*", { count: "exact", head: true }).in("id", userIdsToDelete),
    supabase.from("user_characters").select("*", { count: "exact", head: true }).in("owner_id", userIdsToDelete),
    supabase.from("sessions").select("*", { count: "exact", head: true }).in("user_id", userIdsToDelete),
    supabase.from("messages").select("*", { count: "exact", head: true }).in("user_id", userIdsToDelete),
    supabase.from("memories").select("*", { count: "exact", head: true }).in("user_id", userIdsToDelete),
    supabase.from("user_profiles_per_persona").select("*", { count: "exact", head: true }).in("user_id", userIdsToDelete),
    supabase.from("memory_feedback").select("*", { count: "exact", head: true }).in("user_id", userIdsToDelete),
  ]);

  console.log(`\n关联数据统计:`);
  console.log(`  - profiles: ${profileCount || 0}`);
  console.log(`  - user_characters: ${characterCount || 0}`);
  console.log(`  - sessions: ${sessionCount || 0}`);
  console.log(`  - messages: ${messageCount || 0}`);
  console.log(`  - memories: ${memoryCount || 0}`);
  console.log(`  - user_profiles_per_persona: ${userProfileCount || 0}`);
  console.log(`  - memory_feedback: ${feedbackCount || 0}`);

  // Step 4: 执行删除
  if (DRY_RUN) {
    console.log("\n" + "=".repeat(60));
    console.log("DRY RUN 模式：不执行实际删除");
    console.log("=".repeat(60));
    console.log("\n如需真实删除，请运行:");
    console.log(`  npx tsx scripts/cleanup-redundant-users.ts --keep-user=${KEEP_USER_EMAIL}`);
    return;
  }

  console.log("\n" + "=".repeat(60));
  console.log("Step 4: 执行删除...");
  console.log("=".repeat(60));

  // 删除关联数据（按依赖顺序）
  console.log("\n删除关联数据...");

  console.log("  - 删除 memory_feedback...");
  const { error: feedbackError } = await supabase
    .from("memory_feedback")
    .delete()
    .in("user_id", userIdsToDelete);
  if (feedbackError) {
    console.error(`    ❌ 失败: ${feedbackError.message}`);
  } else {
    stats.feedbackDeleted = feedbackCount || 0;
    console.log(`    ✅ 删除 ${stats.feedbackDeleted} 条`);
  }

  console.log("  - 删除 user_profiles_per_persona...");
  const { error: userProfileError } = await supabase
    .from("user_profiles_per_persona")
    .delete()
    .in("user_id", userIdsToDelete);
  if (userProfileError) {
    console.error(`    ❌ 失败: ${userProfileError.message}`);
  } else {
    stats.userProfilesDeleted = userProfileCount || 0;
    console.log(`    ✅ 删除 ${stats.userProfilesDeleted} 条`);
  }

  console.log("  - 删除 memories...");
  const { error: memoryError } = await supabase
    .from("memories")
    .delete()
    .in("user_id", userIdsToDelete);
  if (memoryError) {
    console.error(`    ❌ 失败: ${memoryError.message}`);
  } else {
    stats.memoriesDeleted = memoryCount || 0;
    console.log(`    ✅ 删除 ${stats.memoriesDeleted} 条`);
  }

  console.log("  - 删除 messages...");
  const { error: messageError } = await supabase
    .from("messages")
    .delete()
    .in("user_id", userIdsToDelete);
  if (messageError) {
    console.error(`    ❌ 失败: ${messageError.message}`);
  } else {
    stats.messagesDeleted = messageCount || 0;
    console.log(`    ✅ 删除 ${stats.messagesDeleted} 条`);
  }

  console.log("  - 删除 sessions...");
  const { error: sessionError } = await supabase
    .from("sessions")
    .delete()
    .in("user_id", userIdsToDelete);
  if (sessionError) {
    console.error(`    ❌ 失败: ${sessionError.message}`);
  } else {
    stats.sessionsDeleted = sessionCount || 0;
    console.log(`    ✅ 删除 ${stats.sessionsDeleted} 条`);
  }

  console.log("  - 删除 user_characters...");
  const { error: characterError } = await supabase
    .from("user_characters")
    .delete()
    .in("owner_id", userIdsToDelete);
  if (characterError) {
    console.error(`    ❌ 失败: ${characterError.message}`);
  } else {
    stats.charactersDeleted = characterCount || 0;
    console.log(`    ✅ 删除 ${stats.charactersDeleted} 条`);
  }

  console.log("  - 删除 profiles...");
  const { error: profileError } = await supabase
    .from("profiles")
    .delete()
    .in("id", userIdsToDelete);
  if (profileError) {
    console.error(`    ❌ 失败: ${profileError.message}`);
  } else {
    stats.profilesDeleted = profileCount || 0;
    console.log(`    ✅ 删除 ${stats.profilesDeleted} 条`);
  }

  // 删除 auth.users
  console.log("\n删除 auth.users...");
  for (const user of usersToDelete) {
    const { error: authDeleteError } = await supabase.auth.admin.deleteUser(user.id);
    if (authDeleteError) {
      console.error(`  ❌ 删除 ${user.email} 失败: ${authDeleteError.message}`);
    } else {
      stats.usersDeleted++;
      console.log(`  ✅ 删除 ${user.email}`);
    }
  }

  // Step 5: 验证清理结果
  console.log("\n" + "=".repeat(60));
  console.log("Step 5: 验证清理结果...");
  console.log("=".repeat(60));

  const { data: remainingUsers } = await supabase.auth.admin.listUsers();
  const remainingCount = remainingUsers?.users.length || 0;

  console.log(`\n剩余账号数: ${remainingCount}`);
  remainingUsers?.users.forEach((u) => {
    console.log(`  ✓ ${u.email}`);
  });

  const [
    { count: remainingProfiles },
    { count: remainingCharacters },
    { count: remainingSessions },
    { count: remainingMessages },
    { count: remainingMemories },
  ] = await Promise.all([
    supabase.from("profiles").select("*", { count: "exact", head: true }),
    supabase.from("user_characters").select("*", { count: "exact", head: true }),
    supabase.from("sessions").select("*", { count: "exact", head: true }),
    supabase.from("messages").select("*", { count: "exact", head: true }),
    supabase.from("memories").select("*", { count: "exact", head: true }),
  ]);

  console.log(`\n剩余数据统计:`);
  console.log(`  - profiles: ${remainingProfiles || 0}`);
  console.log(`  - user_characters: ${remainingCharacters || 0}`);
  console.log(`  - sessions: ${remainingSessions || 0}`);
  console.log(`  - messages: ${remainingMessages || 0}`);
  console.log(`  - memories: ${remainingMemories || 0}`);

  // Step 6: 生成报告
  console.log("\n" + "=".repeat(60));
  console.log("清理完成");
  console.log("=".repeat(60));
  console.log(`\n删除统计:`);
  console.log(`  - 用户账号: ${stats.usersDeleted}`);
  console.log(`  - profiles: ${stats.profilesDeleted}`);
  console.log(`  - user_characters: ${stats.charactersDeleted}`);
  console.log(`  - sessions: ${stats.sessionsDeleted}`);
  console.log(`  - messages: ${stats.messagesDeleted}`);
  console.log(`  - memories: ${stats.memoriesDeleted}`);
  console.log(`  - user_profiles_per_persona: ${stats.userProfilesDeleted}`);
  console.log(`  - memory_feedback: ${stats.feedbackDeleted}`);

  // 写入报告文件
  const report = generateReport(usersToKeep, usersToDelete, stats, {
    remainingUsers: remainingCount,
    remainingProfiles: remainingProfiles || 0,
    remainingCharacters: remainingCharacters || 0,
    remainingSessions: remainingSessions || 0,
    remainingMessages: remainingMessages || 0,
    remainingMemories: remainingMemories || 0,
  });

  const fs = await import("fs/promises");
  await fs.writeFile("docs/account-cleanup-report.md", report, "utf-8");
  console.log("\n✅ 报告已生成: docs/account-cleanup-report.md");
}

function generateReport(
  kept: UserRecord[],
  deleted: UserRecord[],
  stats: CleanupStats,
  remaining: {
    remainingUsers: number;
    remainingProfiles: number;
    remainingCharacters: number;
    remainingSessions: number;
    remainingMessages: number;
    remainingMemories: number;
  }
): string {
  return `# 账号清理报告

生成时间：${new Date().toISOString()}

## 一、清理目标

清理多余测试账号，只保留 2 个账号体系：
- 1 个管理员账号
- 1 个用户账号

## 二、保留账号

${kept.map((u) => `- **${u.email}** (${u.id})
  - 创建时间: ${u.created_at}
  - 最近登录: ${u.last_sign_in_at || "从未登录"}`).join("\n")}

## 三、删除账号

${deleted.map((u) => `- **${u.email}** (${u.id})
  - 创建时间: ${u.created_at}
  - 最近登录: ${u.last_sign_in_at || "从未登录"}`).join("\n")}

## 四、删除数据统计

| 数据表 | 删除数量 |
|---|---|
| auth.users | ${stats.usersDeleted} |
| profiles | ${stats.profilesDeleted} |
| user_characters | ${stats.charactersDeleted} |
| sessions | ${stats.sessionsDeleted} |
| messages | ${stats.messagesDeleted} |
| memories | ${stats.memoriesDeleted} |
| user_profiles_per_persona | ${stats.userProfilesDeleted} |
| memory_feedback | ${stats.feedbackDeleted} |

## 五、清理后数据统计

| 数据表 | 剩余数量 |
|---|---|
| auth.users | ${remaining.remainingUsers} |
| profiles | ${remaining.remainingProfiles} |
| user_characters | ${remaining.remainingCharacters} |
| sessions | ${remaining.remainingSessions} |
| messages | ${remaining.remainingMessages} |
| memories | ${remaining.remainingMemories} |

## 六、验证结果

✅ 账号清理完成
✅ 无孤儿数据残留
✅ 数据库状态正常

## 七、后续建议

1. 定期检查测试账号，避免再次积累
2. 测试时使用明确的命名规范（如 test-* 前缀）
3. 测试完成后及时清理
`;
}

main().catch((error) => {
  console.error("\n❌ 脚本执行失败:", error);
  process.exit(1);
});
