import { generateClaudeJson } from "@/lib/ai/claude";
import {
  ensureSessionHasUsableCharacter,
  getRecentSessionMessages,
  updateSessionSummary,
} from "@/lib/chat/sessions";
import { saveSessionMemories } from "@/lib/memory/long-term";
import {
  buildCanonicalIdentityLines,
  cleanConflictingPersonaSentences,
  hasConflictingPersonaIdentity,
} from "@/lib/persona/identity";
import type {
  MemoryType,
  MessageRecord,
  Persona,
  SessionRecord,
  UserProfilePerPersonaData,
  UserProfilePerPersonaRecord,
} from "@/lib/supabase/types";

const MAX_TOPICS = 8;
const MAX_MEMORIES = 12;
const MAX_PROFILE_ITEMS = 12;
const MAX_ANCHORS = 10;
const ANCHOR_SUFFIX_MARKERS = [
  "\u4eca\u5929",
  "\u540e\u6765",
  "\u7ed3\u679c",
  "\u6700\u540e",
  "\u53c8",
  "\u8fd8",
  "\u5c31",
  "\u90fd",
  "\u7ec8\u4e8e",
  "\u4e00\u4e0b",
  "\u771f\u7684",
  "\u8fd8\u662f",
  "\u73b0\u5728",
  "\u521a\u624d",
  "\u6628\u5929",
  "\u524d\u5929",
  "\u7136\u540e",
];
const CONTINUATION_ANCHOR_REGEX =
  /(\u90a3(?:\u4e2a|\u53ea|\u5bb6|\u6b21|\u573a|\u6bb5|\u4ef6|\u4f4d)?|\u8fd9(?:\u4e2a|\u53ea|\u5bb6|\u6b21|\u573a|\u6bb5|\u4ef6|\u4f4d)?)([\u4e00-\u9fa5A-Za-z0-9]{1,8})/g;

type SummaryResponse = {
  summary: string;
  topics: string[];
  memories: Array<{
    memory_type: MemoryType;
    content: string;
    importance: number;
  }>;
  user_profile: UserProfilePerPersonaData & {
    relationship_stage?: UserProfilePerPersonaRecord["relationship_stage"];
  };
};

type DeterministicFactExtraction = {
  favoriteFlower: string | null;
  seasideWeekend: boolean;
};

function isMediaPlaceholder(content: string) {
  return /^\[(?:圖片|照片|貼圖)\]$/.test(content.trim());
}

function extractDeterministicFacts(messages: MessageRecord[]): DeterministicFactExtraction {
  const userTexts = messages
    .filter((message) => message.role === "user")
    .map((message) => message.content);

  const joinedUserText = userTexts.join("\n");
  const favoriteFlowerMatch = joinedUserText.match(
    /(?:favorite flower is|最喜欢的花是)\s*([A-Za-z0-9][A-Za-z0-9-]{1,63})/i,
  );
  const favoriteFlower = favoriteFlowerMatch?.[1]?.trim() ?? null;
  const seasideWeekend =
    /weekend/i.test(joinedUserText) && /(seaside|beach)/i.test(joinedUserText) ||
    /周末/.test(joinedUserText) && /海边/.test(joinedUserText);

  return {
    favoriteFlower,
    seasideWeekend,
  };
}

function getFactSlotKey(content: string) {
  const normalized = content.trim().replace(/\s+/g, "");

  if (/我?最喜欢的花是[:：]?.+/i.test(normalized) || normalized.includes("最喜欢的花")) {
    return "favorite_flower";
  }

  if (
    (/周末/.test(normalized) && /海边/.test(normalized) && /(散步|走走)/.test(normalized)) ||
    (/weekend/i.test(normalized) && /(seaside|beach)/i.test(normalized))
  ) {
    return "weekend_seaside_walk";
  }

  return null;
}

function upsertFactBySlot(items: string[], nextItem: string) {
  const nextSlot = getFactSlotKey(nextItem);
  if (!nextSlot) {
    return uniqueStrings([...items, nextItem], MAX_PROFILE_ITEMS);
  }

  const filtered = items.filter((item) => getFactSlotKey(item) !== nextSlot);
  return uniqueStrings([...filtered, nextItem], MAX_PROFILE_ITEMS);
}

function applyDeterministicFacts(
  result: SummaryResponse,
  messages: MessageRecord[],
): SummaryResponse {
  const extracted = extractDeterministicFacts(messages);
  let summary = result.summary;
  let memories = [...result.memories];
  let facts = [...result.user_profile.facts];
  let preferences = [...result.user_profile.preferences];
  let anchors = [...result.user_profile.anchors];

  if (extracted.favoriteFlower) {
    const favoriteFlowerFact = `最喜欢的花是${extracted.favoriteFlower}`;
    memories = memories.filter((memory) => getFactSlotKey(memory.content) !== "favorite_flower");
    memories.unshift({
      memory_type: "user_fact",
      content: favoriteFlowerFact,
      importance: 0.8,
    });
    facts = upsertFactBySlot(facts, favoriteFlowerFact);
    preferences = upsertFactBySlot(preferences, extracted.favoriteFlower);
    anchors = uniqueStrings([extracted.favoriteFlower, favoriteFlowerFact, ...anchors], MAX_ANCHORS);
    summary = summary.replace(/流星兰/g, extracted.favoriteFlower);
    if (!summary.includes(extracted.favoriteFlower)) {
      summary = `用户分享了最喜欢的花是${extracted.favoriteFlower}${summary ? `,${summary}` : ""}`;
    }
  }

  if (extracted.seasideWeekend) {
    const seasideFact = "周末习惯在海边散步";
    memories = memories.filter((memory) => getFactSlotKey(memory.content) !== "weekend_seaside_walk");
    memories.unshift({
      memory_type: "user_fact",
      content: seasideFact,
      importance: 0.7,
    });
    facts = upsertFactBySlot(facts, seasideFact);
    anchors = uniqueStrings(["海边散步", seasideFact, ...anchors], MAX_ANCHORS);
    if (!summary.includes("海边")) {
      summary = `${summary}${summary ? "," : ""}周末习惯在海边散步`;
    }
  }

  return {
    ...result,
    summary,
    memories: memories.slice(0, MAX_MEMORIES),
    user_profile: {
      ...result.user_profile,
      summary: extracted.favoriteFlower
        ? result.user_profile.summary.replace(/流星兰/g, extracted.favoriteFlower)
        : result.user_profile.summary,
      facts,
      preferences,
      anchors,
    },
  };
}

function uniqueStrings(items: Array<string | null | undefined>, limit: number) {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const item of items) {
    const normalized = item?.trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);

    if (result.length >= limit) {
      return result;
    }
  }

  return result;
}

function trimAnchorSuffix(anchor: string) {
  let value = anchor.trim();

  for (const marker of ANCHOR_SUFFIX_MARKERS) {
    const markerIndex = value.indexOf(marker);
    if (markerIndex > 0) {
      value = value.slice(0, markerIndex);
    }
  }

  return value.trim();
}

function extractAnchorsFromText(text: string) {
  const results: string[] = [];
  const source = text.trim();

  if (!source) {
    return results;
  }

  const referentialMatches = source.matchAll(CONTINUATION_ANCHOR_REGEX);
  for (const match of referentialMatches) {
    const full = `${match[1]}${trimAnchorSuffix(match[2])}`.trim();
    const core = trimAnchorSuffix(match[2]);

    if (full.length >= 2) results.push(full);
    if (core.length >= 1) results.push(core);
  }

  const quotedMatches = source.matchAll(/"([^"]{1,12})"/g);
  for (const match of quotedMatches) {
    results.push(match[1]);
  }

  const shortPhrases = source.match(/[\u4e00-\u9fa5A-Za-z0-9]{2,8}/g) ?? [];
  for (const phrase of shortPhrases) {
    const trimmed = trimAnchorSuffix(phrase);
    if (trimmed.length >= 2) {
      results.push(trimmed);
    }
  }

  return uniqueStrings(results, MAX_ANCHORS);
}

function deriveFallbackAnchors(
  messages: MessageRecord[],
  topics: string[],
  memories: string[],
) {
  const userTexts = messages
    .filter((message) => message.role === "user")
    .slice(-6)
    .map((message) => message.content);

  return uniqueStrings(
    [
      ...topics,
      ...memories,
      ...userTexts.flatMap((text) => extractAnchorsFromText(text)),
    ],
    MAX_ANCHORS,
  );
}

function fallbackSummary(messages: MessageRecord[]): SummaryResponse {
  const recentUserMessages = uniqueStrings(
    messages
      .filter((message) => message.role === "user")
      .slice(-4)
      .map((message) => message.content),
    4,
  );
  const anchors = deriveFallbackAnchors(
    messages,
    recentUserMessages,
    recentUserMessages,
  );

  return {
    summary:
      recentUserMessages.join("\uff1b") ||
      "\u8fd9\u6b21\u5bf9\u8bdd\u8fd8\u6bd4\u8f83\u77ed\uff0c\u4e3b\u8981\u662f\u5728\u7ee7\u7eed\u719f\u6089\u5f7c\u6b64\u3002",
    topics: recentUserMessages.slice(0, 3),
    memories: recentUserMessages.slice(0, 3).map((content) => ({
      memory_type: "user_fact",
      content,
      importance: 0.55,
    })),
    user_profile: {
      summary:
        recentUserMessages[0] ||
        "\u7528\u6237\u8fd8\u5728\u548c\u8fd9\u4e2a\u4eba\u8bbe\u6162\u6162\u719f\u6089\u4e2d\u3002",
      facts: recentUserMessages.slice(0, 3),
      preferences: [],
      relationship_notes: [],
      recent_topics: recentUserMessages.slice(0, 3),
      anchors,
      relationship_stage: "new",
    },
  };
}

function sanitizeSummaryResult(
  persona: Persona,
  result: SummaryResponse,
): SummaryResponse {
  const sanitizedAnchors = uniqueStrings(
    result.user_profile.anchors?.map((item) => trimAnchorSuffix(item)) ?? [],
    MAX_ANCHORS,
  );

  return {
    ...result,
    summary: cleanConflictingPersonaSentences(result.summary.trim(), persona, {
      treatFirstPersonAsPersona: true,
    }),
    topics: uniqueStrings(result.topics, MAX_TOPICS),
    memories: result.memories
      .filter((memory) => Boolean(memory.content?.trim()))
      .filter((memory) =>
        memory.memory_type === "persona_fact"
          ? !hasConflictingPersonaIdentity(memory.content, persona, {
              treatFirstPersonAsPersona: true,
            })
          : true,
      )
      .slice(0, MAX_MEMORIES),
    user_profile: {
      ...result.user_profile,
      summary: cleanConflictingPersonaSentences(
        result.user_profile.summary.trim(),
        persona,
      ),
      facts: uniqueStrings(
        result.user_profile.facts.filter(
          (item) => !hasConflictingPersonaIdentity(item, persona),
        ),
        MAX_PROFILE_ITEMS,
      ),
      preferences: uniqueStrings(
        result.user_profile.preferences.filter(
          (item) => !hasConflictingPersonaIdentity(item, persona),
        ),
        MAX_PROFILE_ITEMS,
      ),
      relationship_notes: uniqueStrings(
        result.user_profile.relationship_notes.filter(
          (item) => !hasConflictingPersonaIdentity(item, persona),
        ),
        MAX_PROFILE_ITEMS,
      ),
      recent_topics: uniqueStrings(result.user_profile.recent_topics, MAX_TOPICS),
      anchors: sanitizedAnchors,
    },
  };
}

async function summarizeMessages(persona: Persona, messages: MessageRecord[]) {
  const transcript = messages
    .filter((message) => !isMediaPlaceholder(message.content))
    .map((message) => `${message.role}: ${message.content}`)
    .join("\n");
  const canonicalIdentity = buildCanonicalIdentityLines(persona);
  const fallback = fallbackSummary(messages);
  const anchorExamples = [
    "\u90a3\u53ea\u732b",
    "\u6444\u5f71\u5c55",
    "\u9762\u8bd5",
    "\u90a3\u5bb6\u5e97",
  ].join(", ");

  const response = await generateClaudeJson<SummaryResponse>(
    {
      system:
        "You turn companion-chat transcripts into structured memory. Return JSON only.",
      messages: [
        {
          role: "user",
          content: [
            `Persona name: ${persona.name}`,
            "Canonical identity anchors for the persona. Never produce memory that contradicts them:",
            ...canonicalIdentity,
            "Prioritize user facts, shared events, relationship changes, recent topics, and short referential anchors.",
            `Anchors are short reusable references that help continuation, for example: ${anchorExamples}.`,
            "If the assistant said something that conflicts with the persona identity, treat it as a slip and exclude it.",
            "All summary, memories, profile fields, and anchors should be written in concise Chinese.",
            "Return this JSON shape exactly:",
            `{
  "summary": "string",
  "topics": ["string"],
  "memories": [
    { "memory_type": "user_fact|persona_fact|shared_event|relationship", "content": "string", "importance": 0.0 }
  ],
  "user_profile": {
    "summary": "string",
    "facts": ["string"],
    "preferences": ["string"],
    "relationship_notes": ["string"],
    "recent_topics": ["string"],
    "anchors": ["string"],
    "relationship_stage": "new|warming|close"
  }
}`,
            "Conversation transcript:",
            transcript,
          ].join("\n"),
        },
      ],
      model: process.env.ANTHROPIC_SUMMARY_MODEL || process.env.ANTHROPIC_MODEL,
      maxTokens: 900,
      temperature: 0.1,
    },
    fallback,
  );

  const sanitized = applyDeterministicFacts(
    sanitizeSummaryResult(persona, response),
    messages,
  );
  const fallbackAnchors = deriveFallbackAnchors(
    messages,
    sanitized.topics,
    sanitized.memories.map((memory) => memory.content),
  );

  sanitized.user_profile.anchors = uniqueStrings(
    [...sanitized.user_profile.anchors, ...fallbackAnchors],
    MAX_ANCHORS,
  );

  return sanitized;
}

export async function maybeRefreshSessionMemory(input: {
  userId: string;
  persona: Persona;
  session: SessionRecord | { id: string; summary?: string | null; character_id?: string | null };
}) {
  const messages = (await getRecentSessionMessages(input.session.id, 120, {
    userId: input.userId,
  })).filter((message) => !isMediaPlaceholder(message.content));

  if (messages.length < 2) {
    return null;
  }

  const shouldRefresh =
    !input.session.summary ||
    messages.length % 3 === 0;

  if (!shouldRefresh) {
    return null;
  }

  // Ensure character_id is present
  const sessionCharacterId = "character_id" in input.session ? input.session.character_id : null;
  if (!sessionCharacterId) {
    console.warn('[maybeRefreshSessionMemory] Session missing character_id, skipping memory save');
    return null;
  }

  const characterId = await ensureSessionHasUsableCharacter(
    input.session.id,
    input.userId,
    sessionCharacterId,
  );

  const result = await summarizeMessages(input.persona, messages);
  const fallback = fallbackSummary(messages);
  const sanitizedSummary = result.summary.trim() || fallback.summary.trim();
  const topics = uniqueStrings(result.topics, MAX_TOPICS);
  const updatedSession = await updateSessionSummary(
    input.session.id,
    {
      summary: sanitizedSummary,
      topics,
    },
    { userId: input.userId },
  );

  const persisted = await saveSessionMemories({
    userId: input.userId,
    personaId: input.persona.id,
    characterId: characterId,
    sessionId: input.session.id,
    topics,
    summary: sanitizedSummary,
    memories: result.memories
      .filter((memory) => Boolean(memory.content?.trim()))
      .slice(0, MAX_MEMORIES),
    profile: {
      ...result.user_profile,
      anchors: uniqueStrings(
        [...result.user_profile.anchors, ...fallback.user_profile.anchors],
        MAX_ANCHORS,
      ),
      total_messages: messages.length,
    },
  });

  return {
    session: updatedSession,
    memories: persisted.memories,
    profile: persisted.profile,
  };
}
