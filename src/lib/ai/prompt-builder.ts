import { getActivePromptVersion } from "@/lib/ai/prompt-versions";
import { buildSystemPrompt } from "@/lib/ai/prompt-templates";
import { buildCanonicalIdentityLines } from "@/lib/persona/identity";
import type {
  MemoryRecord,
  Persona,
  SessionRecord,
  UserProfilePerPersonaRecord,
} from "@/lib/supabase/types";

type BuildChatPromptInput = {
  persona: Persona;
  userProfile: UserProfilePerPersonaRecord | null;
  recentSummaries: SessionRecord[];
  relevantMemories: MemoryRecord[];
  promptVersionId?: string;
  promptVersion?: import("@/lib/supabase/types").PromptVersionRecord;
};

function formatBulletList(items: string[]) {
  if (items.length === 0) return "- none";
  return items.map((item) => `- ${item}`).join("\n");
}

export async function buildChatSystemPrompt(input: BuildChatPromptInput) {
  const promptVersion = input.promptVersion ?? await getActivePromptVersion(input.promptVersionId);
  const basePrompt = buildSystemPrompt(input.persona);
  const identityLines = buildCanonicalIdentityLines(input.persona);
  const profileData = input.userProfile?.profile_data;
  const summaryLines = input.recentSummaries
    .filter((session) => session.summary)
    .map((session) => {
      const topicText =
        session.topics && session.topics.length > 0
          ? ` Topics: ${session.topics.join(", ")}.`
          : "";
      return `- ${session.summary}${topicText}`;
    });
  const memoryLines = input.relevantMemories.map(
    (memory) => `- [${memory.memory_type}] ${memory.content}`,
  );
  const anchorLines =
    profileData && profileData.anchors.length > 0
      ? formatBulletList(profileData.anchors)
      : "- no continuity anchors yet";
  const continuationCueExamples = [
    "\u90a3\u4e2a",
    "\u90a3\u53ea",
    "\u4e0a\u6b21",
    "\u540e\u6765",
    "\u7ed3\u679c",
    "\u53c8",
    "\u8fd8\u8bb0\u5f97",
  ].join(", ");

  return [
    basePrompt,
    "",
    "## Active Prompt Version",
    `- ${promptVersion.label}`,
    promptVersion.instructions ? promptVersion.instructions : "- no extra instructions",
    "",
    "## Canonical Identity Reminder",
    identityLines.length > 0 ? identityLines.join("\n") : "- no canonical identity fields",
    "If any retrieved memory or previous reply conflicts with this canonical identity, ignore the conflicting part and follow this section.",
    "",
    "## User Profile Snapshot",
    profileData
      ? formatBulletList([
          profileData.summary,
          ...profileData.facts,
          ...profileData.preferences,
          ...profileData.relationship_notes,
        ].filter(Boolean))
      : "- no profile snapshot yet",
    "",
    "## Continuity Anchors",
    anchorLines,
    "",
    "## Recent Session Summaries",
    summaryLines.length > 0 ? summaryLines.join("\n") : "- no prior summaries yet",
    "",
    "## Retrieved Long-Term Memories",
    memoryLines.length > 0 ? memoryLines.join("\n") : "- no relevant memories retrieved",
    "",
    "Use the memory context naturally. Do not dump it as a list unless the user explicitly asks for a recap.",
    `If the user says cues like ${continuationCueExamples}, treat it as a continuation of an existing thread first.`,
    "",
    "## 记忆和指代的使用规则（重要！）",
    "",
    "**当用户说'那个XX''那只XX''那家XX'等指代词时：**",
    "1. 先检查上面的记忆和锚点，看是否有相关内容",
    "2. 如果有相关记忆 → 直接顺着话题往下聊，不要问'哪个'",
    "3. 如果没有相关记忆 → 也要顺着话题聊，不要生硬地问'哪个XX'",
    "",
    "**真人朋友的处理方式：**",
    '- "那只猫今天又来了" → "又來喔" 或 "今天有靠近你嗎"（不问"哪只猫"）',
    '- "我今天去看了那个展" → "喔你去看啦" 或 "好看嗎"（不问"哪個展"）',
    '- "那个人又找我了" → "又找你喔" 或 "說什麼"（不问"哪個人"）',
    '- "那家店今天没开" → "啊？沒開喔" 或 "那你去哪吃了"（不问"哪家店"）',
    "",
    "**核心原则：真人朋友会假装记得或顺着聊，不会生硬地追问指代对象。**",
    "如果真的需要确认，用自然的方式：'欸哪個呀，我忘了' 而不是 '哪個XX？'",
    "",
    "When the memory context contains one plausible referent, continue from it directly instead of opening with a reset question.",
    "Only ask a narrow follow-up when multiple candidates conflict or the memory context is genuinely empty.",
    "If you need to clarify, mention the most likely referent in character instead of acting like the topic is brand new.",
  ]
    .filter(Boolean)
    .join("\n");
}
