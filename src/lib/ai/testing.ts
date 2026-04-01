import { generateClaudeText } from "@/lib/ai/claude";
import { buildChatSystemPrompt } from "@/lib/ai/prompt-builder";
import { getActivePromptVersion } from "@/lib/ai/prompt-versions";
import { postProcessAssistantReply } from "@/lib/ai/post-processor";
import { getMemoryContext } from "@/lib/memory/retriever";
import type { Persona } from "@/lib/supabase/types";

export async function runPromptDryTest(input: {
  persona: Persona;
  message: string;
  promptVersionId?: string;
  modelProviderId?: string;
  userId?: string | null;
  characterId?: string | null;
}) {
  const activePromptVersion = await getActivePromptVersion(input.promptVersionId);
  const memoryContext = input.userId && input.characterId
    ? await getMemoryContext({
        userId: input.userId,
        personaId: input.persona.id,
        characterId: input.characterId,
        persona: input.persona,
        query: input.message,
        limit: 5,
      })
    : {
        userProfile: null,
        recentSummaries: [],
        relevantMemories: [],
      };

  const system = await buildChatSystemPrompt({
    persona: input.persona,
    ...memoryContext,
    promptVersionId: activePromptVersion.id,
  });

  const reply = await generateClaudeText({
    system,
    messages: [{ role: "user", content: input.message }],
    modelProviderId: input.modelProviderId,
    maxTokens: Number(process.env.ANTHROPIC_MAX_TOKENS || 800),
    temperature: 0.7,
  });

  return {
    reply:
      postProcessAssistantReply(reply, input.persona.name) ||
      "刚刚那一下有点卡住了，你再给我一句测试消息，我继续接。",
    promptVersion: activePromptVersion,
    system,
    memoryContext,
  };
}
