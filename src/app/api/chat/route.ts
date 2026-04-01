import { NextResponse } from "next/server";
import { generateClaudeText } from "@/lib/ai/claude";
import { buildChatSystemPrompt } from "@/lib/ai/prompt-builder";
import { getActivePromptVersion } from "@/lib/ai/prompt-versions";
import { postProcessAssistantReply } from "@/lib/ai/post-processor";
import { getCurrentAppUser } from "@/lib/auth/session";
import {
  ensureSessionForPersona,
  getLatestUsableSession,
  getRecentSessionMessages,
  insertMessage,
} from "@/lib/chat/sessions";
import { memoryLogger } from "@/lib/memory/memory-logger";
import { maybeRefreshSessionMemory } from "@/lib/memory/summarizer";
import { getMemoryContext } from "@/lib/memory/retriever";
import { sanitizeAssistantHistory } from "@/lib/persona/identity";
import { queryPostgres } from "@/lib/postgres";
import type { Persona } from "@/lib/supabase/types";

type ChatRequestBody = {
  message?: string;
  persona_id?: string;
  session_id?: string;
  prompt_version_id?: string;
  model_provider_id?: string;
};

export async function POST(req: Request) {
  const startTime = Date.now();
  try {
    const actingUser = await getCurrentAppUser();
    if (!actingUser) {
      return NextResponse.json(
        {
          success: false,
          data: null,
          error: { message: "Please login first." },
        },
        { status: 401 },
      );
    }

    const body = (await req.json()) as ChatRequestBody;
    const message = typeof body.message === "string" ? body.message.trim() : "";
    const personaId =
      typeof body.persona_id === "string" ? body.persona_id.trim() : "";
    const requestedSessionId =
      typeof body.session_id === "string" ? body.session_id.trim() : "";
    const requestedPromptVersionId =
      typeof body.prompt_version_id === "string"
        ? body.prompt_version_id.trim()
        : "";
    const requestedModelProviderId =
      typeof body.model_provider_id === "string"
        ? body.model_provider_id.trim()
        : "";
    const defaultModelProviderId =
      process.env.DEFAULT_CHAT_MODEL_PROVIDER_ID?.trim() || "";
    const resolvedModelProviderId =
      requestedModelProviderId || defaultModelProviderId;

    if (!personaId) {
      return NextResponse.json(
        {
          success: false,
          data: null,
          error: { message: "persona_id is required." },
        },
        { status: 400 },
      );
    }

    if (!message) {
      return NextResponse.json(
        {
          success: false,
          data: null,
          error: { message: "message is required." },
        },
        { status: 400 },
      );
    }

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
        {
          success: false,
          data: null,
          error: { message: "Persona not found." },
        },
        { status: 404 },
      );
    }

    const session = requestedSessionId
      ? await ensureSessionForPersona(requestedSessionId, personaId, {
          userId: actingUser.id,
        })
      : await getLatestUsableSession(personaId, { userId: actingUser.id });

    if (!session) {
      return NextResponse.json(
        {
          success: false,
          data: null,
          error: { message: "请先选择角色并创建会话。" },
        },
        { status: 400 },
      );
    }

    if (!session.character_id) {
      return NextResponse.json(
        {
          success: false,
          data: null,
          error: { message: "会话未关联角色" },
        },
        { status: 400 },
      );
    }

    const userMessage = await insertMessage(session.id, "user", message, {
      userId: actingUser.id,
    });
    const recentMessages = await getRecentSessionMessages(session.id, 20, {
      userId: actingUser.id,
    });
    const sanitizedRecentMessages = sanitizeAssistantHistory(
      recentMessages,
      persona as Persona,
    );
    const messageCount = recentMessages.length;
    const memoryContext = await getMemoryContext({
      userId: actingUser.id,
      personaId,
      characterId: session.character_id,
      persona: persona as Persona,
      query: message,
      limit: 5,
      sessionId: session.id,
      messageCount,
    });

    await memoryLogger.log({
      timestamp: new Date().toISOString(),
      operation: memoryContext.fromCache ? "memory.cache_hit" : "memory.cache_miss",
      user_id: actingUser.id,
      persona_id: personaId,
      character_id: session.character_id,
      duration: Date.now() - startTime,
      success: true,
      metadata: {
        session_id: session.id,
        message_count: messageCount,
      },
    });
    const activePromptVersion = await getActivePromptVersion(
      requestedPromptVersionId || undefined,
    );
    const system = await buildChatSystemPrompt({
      persona: persona as Persona,
      ...memoryContext,
      promptVersion: activePromptVersion,
    });
    const reply = await generateClaudeText({
      system,
      messages: sanitizedRecentMessages.map((item) => ({
        role: item.role,
        content: item.content,
      })),
      modelProviderId: resolvedModelProviderId || undefined,
      maxTokens: Number(process.env.ANTHROPIC_MAX_TOKENS || 200),
      temperature: 0.8,
    });
    const cleanedReply =
      postProcessAssistantReply(reply, persona.name) ||
      "我在。刚刚那一下有点卡住了，你再跟我说一句，我接着听。";
    const assistantMessage = await insertMessage(
      session.id,
      "assistant",
      cleanedReply,
      {
        userId: actingUser.id,
      },
    );

    // Fire-and-forget: 摘要刷新不阻塞响应，失败不影响已成功的聊天
    maybeRefreshSessionMemory({
      userId: actingUser.id,
      persona: persona as Persona,
      session,
    }).catch((err) => {
      console.error("[chat] maybeRefreshSessionMemory failed:", err);
    });

    await memoryLogger.log({
      timestamp: new Date().toISOString(),
      operation: "chat.reply",
      user_id: actingUser.id,
      persona_id: personaId,
      character_id: session.character_id,
      duration: Date.now() - startTime,
      success: true,
      metadata: {
        session_id: session.id,
        prompt_version_id: activePromptVersion.id,
        model_provider_id: resolvedModelProviderId || null,
        memory_count: memoryContext.relevantMemories.length,
        used_cache: memoryContext.fromCache,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        reply: cleanedReply,
        session_id: session.id,
        prompt_version_id: activePromptVersion.id,
        model_provider_id: resolvedModelProviderId || null,
        user_message: userMessage,
        assistant_message: assistantMessage,
        memory_context: {
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
      },
      error: null,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown chat API error.";
    const status =
      message === "The selected session is not usable." ||
      message === "The selected session does not belong to this persona." ||
      message === "Session not found."
        ? 400
        : 500;
    const actingUser = await getCurrentAppUser().catch(() => null);
    await memoryLogger.log({
      timestamp: new Date().toISOString(),
      operation: "chat.reply",
      user_id: actingUser?.id ?? "anonymous",
      duration: Date.now() - startTime,
      success: false,
      error_message: message,
    });

    return NextResponse.json(
      {
        success: false,
        data: null,
        error: { message },
      },
      { status },
    );
  }
}
