import { NextResponse } from "next/server";
import { getCurrentAppUser } from "@/lib/auth/session";
import {
  ensureSessionForPersona,
  getRecentSessionMessages,
} from "@/lib/chat/sessions";
import { getMemoryContext } from "@/lib/memory/retriever";
import { queryPostgres } from "@/lib/postgres";
import type { Persona } from "@/lib/supabase/types";

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
      return NextResponse.json(
        { success: false, data: null, error: { message: "Session not found." } },
        { status: 404 },
      );
    }

    if (!currentSession.character_id) {
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

    return NextResponse.json({
      success: true,
      data: {
        memories: memoryContext.relevantMemories.slice(0, 3).map((memory) => ({
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
    return NextResponse.json(
      { success: false, data: null, error: { message } },
      { status: 500 },
    );
  }
}
