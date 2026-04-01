import { NextRequest, NextResponse } from "next/server";
import { getCurrentAppUser } from "@/lib/auth/session";
import { maybeRefreshSessionMemory } from "@/lib/memory/summarizer";
import { memoryContextCache } from "@/lib/memory/memory-context-cache";
import { queryPostgres } from "@/lib/postgres";
import { getSupabaseServerClient } from "@/lib/supabase/client";
import type { Persona } from "@/lib/supabase/types";

type ImportedMessage = {
  role: "user" | "assistant";
  content: string;
  timestamp?: string;
};

// 解析 Line 导出的对话记录
function parseLineChat(text: string, personaName: string): ImportedMessage[] {
  const messages: ImportedMessage[] = [];
  const lines = text.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Line 格式：时间 用户名 消息内容
    // 例如：04:13 3.22忠良27台北搬運工 嗨哈囉
    // 或者：04:14 芷晴秋葉🍂 好喔，
    const match = trimmed.match(/^(\d{2}:\d{2})\s+(.+?)\s+(.+)$/);

    if (match) {
      const [, time, sender, content] = match;

      // 跳过"貼圖"、"圖片"等非文字消息
      if (content === '貼圖' || content === '圖片' || content === '照片') {
        continue;
      }

      // 判断是用户还是人设
      const role = sender.includes(personaName) ? "assistant" : "user";

      messages.push({
        role,
        content: content.trim(),
        timestamp: time
      });
    }
  }

  return messages;
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentAppUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: { message: "未登录" } },
        { status: 401 },
      );
    }

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

    // 读取文件内容
    const text = await file.text();

    // 解析对话记录
    const messages = parseLineChat(text, personaName || "");

    if (messages.length === 0) {
      return NextResponse.json(
        { success: false, error: { message: "未能解析出有效的对话记录" } },
        { status: 400 },
      );
    }

    const supabase = getSupabaseServerClient();

    const personaResult = await queryPostgres<Persona>(
      `
        select *
        from personas
        where id = $1
        limit 1
      `,
      [personaId],
    );
    const persona = personaResult.rows[0] ?? null;

    if (!persona) {
      return NextResponse.json(
        { success: false, error: { message: "人设不存在" } },
        { status: 404 },
      );
    }

    // Create new session (summary 设为 null 以触发自动记忆提取)
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

    if (sessionError) {
      throw new Error(`创建会话失败: ${sessionError.message}`);
    }

    // 批量插入消息（不指定 created_at，让数据库使用默认值）
    const messagesToInsert = messages.map((msg) => ({
      session_id: session.id,
      role: msg.role,
      content: msg.content,
    }));

    const { error: messagesError } = await supabase
      .from("messages")
      .insert(messagesToInsert);

    if (messagesError) {
      throw new Error(`插入消息失败: ${messagesError.message}`);
    }

    // Fetch persona object for memory generation
    if (!persona) {
      console.error("Failed to fetch persona for memory generation", { personaId });
    } else {
      // Generate memories immediately after import
      // We need to temporarily clear the summary to force maybeRefreshSessionMemory to run
      try {
        // Clear summary temporarily to bypass the shouldRefresh check
        const sessionForMemory = {
          ...session,
          summary: null, // Force memory generation by clearing summary
        };

        await maybeRefreshSessionMemory({
          userId: user.id,
          persona,
          session: sessionForMemory,
        });

        // Invalidate memory context cache to ensure fresh memories are retrieved
        memoryContextCache.invalidate(user.id, personaId);
      } catch (memoryError) {
        console.error("Failed to generate memories during import:", memoryError);
        // Don't fail the import if memory extraction fails
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        session_id: session.id,
        message_count: messages.length,
      },
    });
  } catch (error) {
    console.error("Import chat error:", error);
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
