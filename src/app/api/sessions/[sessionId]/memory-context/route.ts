import { NextResponse } from "next/server";
import { getCurrentAppUser } from "@/lib/auth/session";
import {
  ensureSessionForPersona,
  getRecentSessionMessages,
} from "@/lib/chat/sessions";
import { getMemoryContext } from "@/lib/memory/retriever";
import { queryPostgres } from "@/lib/postgres";
import type { MemoryRecord, Persona } from "@/lib/supabase/types";

export async function GET(
  _req: Request,
  context: { params: Promise<{ sessionId: string }> },
) {
  try {
    const user = await getCurrentAppUser();
    if (!user) {
      return NextResponse.json(
        { success: false, data: null, error: { message: "Please login first." } },
        { status: 401 },
      );
    }

    const { sessionId } = await context.params;

    console.log('[MemoryContext] 开始获取记忆上下文:', {
      sessionId,
      userId: user.id,
    });

    const session = await queryPostgres<{
      id: string;
      persona_id: string;
      character_id: string | null;
      user_id: string;
    }>(
      `
        select id, persona_id, character_id, user_id
        from sessions
        where id = $1 and user_id = $2
        limit 1
      `,
      [sessionId, user.id],
    );

    const currentSession = session.rows[0] ?? null;
    if (!currentSession) {
      console.log('[MemoryContext] 会话未找到');
      return NextResponse.json(
        { success: false, data: null, error: { message: "Session not found." } },
        { status: 404 },
      );
    }

    console.log('[MemoryContext] 会话信息:', {
      sessionId: currentSession.id,
      personaId: currentSession.persona_id,
      characterId: currentSession.character_id,
      userId: currentSession.user_id,
    });

    if (!currentSession.character_id) {
      console.log('[MemoryContext] 会话没有character_id，返回空记忆');
      return NextResponse.json({
        success: true,
        data: {
          memories: [],
          user_profile: null,
        },
        error: null,
      });
    }

    const ensuredSession = await ensureSessionForPersona(currentSession.id, currentSession.persona_id, {
      userId: user.id,
    });

    console.log('[MemoryContext] 确保会话后的character_id:', ensuredSession.character_id);

    const personaResult = await queryPostgres<Persona>(
      `
        select *
        from personas
        where id = $1
        limit 1
      `,
      [currentSession.persona_id],
    );
    const persona = personaResult.rows[0] ?? null;

    if (!persona) {
      console.log('[MemoryContext] 人设未找到');
      return NextResponse.json(
        { success: false, data: null, error: { message: "Persona not found." } },
        { status: 404 },
      );
    }

    const recentMessages = await getRecentSessionMessages(currentSession.id, 20, {
      userId: user.id,
    });
    const latestUserMessage =
      [...recentMessages].reverse().find((message) => message.role === "user")?.content?.trim() || "";

    console.log('[MemoryContext] 最近用户消息:', latestUserMessage.substring(0, 50));
    console.log('[MemoryContext] 开始获取记忆上下文...');

    const memoryContext = await getMemoryContext({
      userId: user.id,
      personaId: currentSession.persona_id,
      characterId: ensuredSession.character_id ?? currentSession.character_id,
      persona,
      query: latestUserMessage,
      limit: 5,
      sessionId: currentSession.id,
      messageCount: recentMessages.length,
    });

    let displayMemories = memoryContext.relevantMemories;
    if (displayMemories.length === 0) {
      const sessionMemories = await queryPostgres<{
        id: string;
        memory_type: string;
        content: string;
        created_at: string | null;
      }>(
        `
          select id, memory_type, content, created_at
          from memories
          where source_session_id = $1
          order by created_at desc nulls last
          limit 3
        `,
        [currentSession.id],
      );

      displayMemories = sessionMemories.rows.map((memory): MemoryRecord => ({
        id: memory.id,
        user_id: user.id,
        persona_id: currentSession.persona_id,
        memory_type: memory.memory_type as MemoryRecord["memory_type"],
        content: memory.content,
        embedding: null,
        importance: 0.5,
        source_session_id: currentSession.id,
        similarity_score: 0,
        reranker_score: undefined,
        final_rank: undefined,
        created_at: memory.created_at,
        updated_at: memory.created_at,
      }));
    }

    console.log('[MemoryContext] 记忆上下文获取完成:', {
      relevantMemoriesCount: memoryContext.relevantMemories.length,
      displayMemoriesCount: displayMemories.length,
      hasUserProfile: Boolean(memoryContext.userProfile),
      recentSummariesCount: memoryContext.recentSummaries.length,
    });

    if (displayMemories.length > 0) {
      console.log('[MemoryContext] 记忆列表:');
      displayMemories.slice(0, 3).forEach((mem, idx) => {
        console.log(`  ${idx + 1}. [${mem.memory_type}] ${mem.content.substring(0, 40)}...`);
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        memories: displayMemories.slice(0, 3).map((memory) => ({
          id: memory.id,
          content: memory.content,
          memory_type: memory.memory_type,
          similarity_score: memory.similarity_score ?? 0,
          reranker_score: memory.reranker_score ?? null,
          final_rank: memory.final_rank ?? null,
        })),
        user_profile: memoryContext.userProfile?.profile_data.summary ?? null,
      },
      error: null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load session memory context.";
    console.error('[MemoryContext] 错误:', error);
    return NextResponse.json(
      { success: false, data: null, error: { message } },
      { status: 500 },
    );
  }
}
