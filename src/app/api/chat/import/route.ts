import { NextRequest, NextResponse } from "next/server";
import { getCurrentAppUser } from "@/lib/auth/session";
import { maybeRefreshSessionMemory } from "@/lib/memory/summarizer";
import { memoryContextCache } from "@/lib/memory/memory-context-cache";
import { queryPostgres } from "@/lib/postgres";
import { getSupabaseServerClient } from "@/lib/supabase/client";
import {
  validateImportFile,
  cleanupFailedImport,
  verifyImportIntegrity,
  getImportStats,
} from "@/lib/chat/import-utils";
import { parseLineChatWithDates } from "@/lib/chat/import-parser";
import type { Persona } from "@/lib/supabase/types";

export async function POST(request: NextRequest) {
  let sessionId: string | null = null;
  let userId: string | null = null;

  try {
    const user = await getCurrentAppUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: { message: "未登录" } },
        { status: 401 },
      );
    }
    userId = user.id;

    const formData = await request.formData();
    const file = formData.get("file") as File;
    const personaId = formData.get("personaId") as string;
    const characterId = formData.get("characterId") as string;
    const personaName = formData.get("personaName") as string;

    if (!file || !personaId || !characterId) {
      return NextResponse.json(
        { success: false, error: { message: "缺少必要参数" } },
        { status: 400 },
      );
    }

    // 验证文件
    const fileValidation = validateImportFile(file);
    if (!fileValidation.valid) {
      return NextResponse.json(
        { success: false, error: { message: fileValidation.error } },
        { status: 400 },
      );
    }

    // 读取文件内容
    const text = await file.text();

    // 解析对话记录
    const messages = parseLineChatWithDates(text, personaName || "");

    if (messages.length === 0) {
      return NextResponse.json(
        { success: false, error: { message: "未能解析出有效的对话记录，请检查文件格式" } },
        { status: 400 },
      );
    }

    // 限制单次导入数量，避免超时
    const MAX_IMPORT_MESSAGES = 500;
    if (messages.length > MAX_IMPORT_MESSAGES) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: `单次最多导入 ${MAX_IMPORT_MESSAGES} 条消息，当前文件包含 ${messages.length} 条消息。请分批导入。`
          }
        },
        { status: 400 },
      );
    }

    const supabase = getSupabaseServerClient();

    // 验证人设存在
    const personaResult = await queryPostgres<Persona>(
      `SELECT * FROM personas WHERE id = $1 LIMIT 1`,
      [personaId],
    );
    const persona = personaResult.rows[0] ?? null;

    if (!persona) {
      return NextResponse.json(
        { success: false, error: { message: "人设不存在" } },
        { status: 404 },
      );
    }

    // 验证角色存在且属于当前用户
    const characterResult = await queryPostgres<{ id: string }>(
      `SELECT id FROM user_characters WHERE id = $1 AND owner_id = $2 AND is_active = true LIMIT 1`,
      [characterId, user.id],
    );

    if (!characterResult.rows[0]) {
      return NextResponse.json(
        { success: false, error: { message: "角色不存在或不可用" } },
        { status: 404 },
      );
    }

    // 创建新会话
    const { data: session, error: sessionError } = await supabase
      .from("sessions")
      .insert({
        user_id: user.id,
        persona_id: personaId,
        character_id: characterId,
        status: "active",
        summary: null,
      })
      .select()
      .single();

    if (sessionError || !session) {
      throw new Error(`创建会话失败: ${sessionError?.message || '未知错误'}`);
    }

    sessionId = session.id;

    // 分批插入消息，避免单次插入过多导致超时
    const BATCH_SIZE = 100;
    let insertedCount = 0;

    for (let i = 0; i < messages.length; i += BATCH_SIZE) {
      const batch = messages.slice(i, i + BATCH_SIZE);
      const messagesToInsert = batch.map((msg) => ({
        session_id: session.id,
        role: msg.role,
        content: msg.content,
        created_at: msg.createdAt ?? undefined,
      }));

      const { error: messagesError } = await supabase
        .from("messages")
        .insert(messagesToInsert);

      if (messagesError) {
        throw new Error(`插入消息失败（第 ${i + 1}-${i + batch.length} 条）: ${messagesError.message}`);
      }

      insertedCount += batch.length;
    }

    const lastImportedAt =
      [...messages]
        .reverse()
        .find((message) => Boolean(message.createdAt))?.createdAt ?? null;

    if (lastImportedAt) {
      await supabase
        .from("sessions")
        .update({ last_message_at: lastImportedAt })
        .eq("id", session.id);
    }

    // 验证数据完整性
    const integrity = await verifyImportIntegrity(session.id, messages.length);
    if (!integrity.valid) {
      throw new Error(`数据完整性验证失败: ${integrity.error}`);
    }

    // 异步生成记忆和更新用户画像，不阻塞响应
    Promise.resolve().then(async () => {
      try {
        const sessionForMemory = {
          ...session,
          summary: null,
        };

        await maybeRefreshSessionMemory({
          userId: user.id,
          persona,
          session: sessionForMemory,
        });

        // 清理缓存
        memoryContextCache.invalidate(user.id, personaId);

        console.log(`[Import] Memory generation completed for session ${session.id}`);
      } catch (memoryError) {
        console.error("[Import] Failed to generate memories:", memoryError);
      }
    });

    // 获取导入统计
    const stats = await getImportStats(session.id);

    return NextResponse.json({
      success: true,
      data: {
        session_id: session.id,
        message_count: insertedCount,
        stats,
        note: messages.length > 120
          ? "消息已全部导入，但记忆生成只会基于最近的120条消息。"
          : "消息已导入，记忆正在后台生成。",
      },
    });
  } catch (error) {
    console.error("[Import] Error:", error);

    // 清理失败的导入
    if (sessionId && userId) {
      await cleanupFailedImport(sessionId, userId);
    }

    return NextResponse.json(
      {
        success: false,
        error: {
          message: error instanceof Error ? error.message : "导入失败",
        },
      },
      { status: 500 },
    );
  }
}
