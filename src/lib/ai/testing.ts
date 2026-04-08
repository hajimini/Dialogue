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
  disableDirectProviderFallback?: boolean;
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
  const defaultModelProviderId =
    process.env.DEFAULT_CHAT_MODEL_PROVIDER_ID?.trim() || "";
  const resolvedModelProviderId = input.modelProviderId || defaultModelProviderId;

  const reply = await generateClaudeText({
    system,
    messages: [{ role: "user", content: input.message }],
    modelProviderId: resolvedModelProviderId || undefined,
    maxTokens: Number(process.env.ANTHROPIC_MAX_TOKENS || 800),
    temperature: 0.7,
    disableDirectProviderFallback: input.disableDirectProviderFallback,
  });
  const cleanedReply = postProcessAssistantReply(reply, input.persona.name, input.message);

  if (!cleanedReply) {
    throw new Error("Model returned an empty reply after post-processing.");
  }

  return {
    reply: cleanedReply,
    promptVersion: activePromptVersion,
    system,
    memoryContext,
  };
}
