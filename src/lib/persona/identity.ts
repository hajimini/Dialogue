import type {
  MemoryRecord,
  MessageRecord,
  Persona,
  SessionRecord,
} from "@/lib/supabase/types";

const NORMALIZATION_MAP: Record<string, string> = {
  調: "调",
  師: "师",
  臺: "台",
  銷: "销",
  劃: "划",
  顧: "顾",
  醫: "医",
  會: "会",
  長: "长",
  經: "经",
  營: "营",
  設: "设",
  計: "计",
  廠: "厂",
  體: "体",
  處: "处",
  業: "业",
  從: "从",
  麼: "么",
  這: "这",
  裡: "里",
  記: "记",
  錯: "错",
  說: "说",
  沒: "没",
  誤: "误",
  糾: "纠",
  鄉: "乡",
  氣: "气",
  規: "规",
};

const ROLE_HINT_PATTERNS = [
  /工作/,
  /上班/,
  /职业/,
  /職業/,
  /行业/,
  /行業/,
  /从事/,
  /從事/,
  /负责/,
  /負責/,
  /works?\s+(in|as)/i,
  /\b(job|career|occupation|industry|planner|marketing|engineer|designer|perfumer)\b/i,
  /工程师|工程師|设计师|設計師|程序员|程式|行销|行銷|营销|企划|企劃|老师|老師|医生|醫生|律师|律師|客服|顾问|顧問|销售|銷售|调香师|調香師|台积电|台積電|社群|文案|厂商|廠商/,
];

const INCONSISTENCY_HINT_PATTERNS = [
  /不是/,
  /没说过/,
  /沒說過/,
  /讲错/,
  /講錯/,
  /记错/,
  /記錯/,
  /误以为/,
  /誤以為/,
  /纠正/,
  /糾正/,
  /冲突/,
  /衝突/,
  /前后不一致/,
  /前後不一致/,
  /说法不一致/,
  /說法不一致/,
  /質疑/,
  /质疑/,
  /mistake/,
  /mistaken/,
  /mistakenly/,
  /corrected?/,
  /never said/,
];

const PERSONA_SELF_REFERENCE_PATTERNS = [
  /我是/,
  /我在做/,
  /我做/,
  /我一直都是/,
  /我平常.*(工作|上班|做)/,
  /没说过我是/,
  /沒說過我是/,
];

const PERSONA_THIRD_PERSON_PATTERNS = [
  /她的/,
  /她在/,
  /她是/,
  /她做/,
  /他在/,
  /他是/,
  /他做/,
  /对话中自述/,
  /對話中自述/,
];

const OCCUPATION_ALIAS_GROUPS = [
  ["调香师", "調香師", "调香", "香水", "香氛", "perfumer", "fragrance"],
  ["设计师", "設計師", "designer"],
  ["工程师", "工程師", "engineer"],
  ["程序员", "程式設計", "程式设计", "developer", "programmer"],
  ["行销", "行銷", "营销", "企划", "企劃", "planner", "marketing"],
  ["老师", "老師", "teacher"],
  ["医生", "醫生", "doctor"],
  ["律师", "律師", "lawyer"],
  ["客服", "customer service"],
  ["顾问", "顧問", "consultant"],
  ["销售", "銷售", "sales"],
];

function normalizeIdentityText(input: string | null | undefined) {
  return (input ?? "")
    .normalize("NFKC")
    .split("")
    .map((char) => NORMALIZATION_MAP[char] ?? char)
    .join("")
    .toLowerCase()
    .replace(/\s+/g, "");
}

function getOccupationAliases(occupation: string | null) {
  const normalized = normalizeIdentityText(occupation);
  const aliases = new Set<string>();

  if (normalized) {
    aliases.add(normalized);
  }

  OCCUPATION_ALIAS_GROUPS.forEach((group) => {
    const normalizedGroup = group.map((item) => normalizeIdentityText(item));
    const matchesGroup =
      normalized &&
      normalizedGroup.some(
        (alias) => normalized.includes(alias) || alias.includes(normalized),
      );

    if (matchesGroup) {
      normalizedGroup.forEach((alias) => aliases.add(alias));
    }
  });

  return [...aliases].filter(Boolean);
}

function getNonCanonicalOccupationAliases(persona: Persona) {
  const canonicalAliases = new Set(getOccupationAliases(persona.occupation));
  const aliases = new Set<string>();

  OCCUPATION_ALIAS_GROUPS.forEach((group) => {
    group
      .map((item) => normalizeIdentityText(item))
      .filter(Boolean)
      .forEach((alias) => {
        if (!canonicalAliases.has(alias)) {
          aliases.add(alias);
        }
      });
  });

  return [...aliases];
}

function hasPersonaReference(
  text: string,
  persona: Persona,
  options?: { treatFirstPersonAsPersona?: boolean },
) {
  const normalizedText = normalizeIdentityText(text);
  const normalizedName = normalizeIdentityText(persona.name);

  if (normalizedName && normalizedText.includes(normalizedName)) {
    return true;
  }

  if (options?.treatFirstPersonAsPersona) {
    return (
      PERSONA_SELF_REFERENCE_PATTERNS.some((pattern) => pattern.test(text)) ||
      PERSONA_THIRD_PERSON_PATTERNS.some((pattern) => pattern.test(text))
    );
  }

  return PERSONA_THIRD_PERSON_PATTERNS.some((pattern) => pattern.test(text));
}

function shouldCheckPersonaMemory(memory: MemoryRecord) {
  return (
    memory.memory_type === "persona_fact" || memory.memory_type === "session_summary"
  );
}

function sanitizePersonaScopedText(
  text: string,
  persona: Persona,
  options?: { treatFirstPersonAsPersona?: boolean },
) {
  return cleanConflictingPersonaSentences(text, persona, {
    treatFirstPersonAsPersona: options?.treatFirstPersonAsPersona,
  });
}

function sanitizeSessionSummary(summary: SessionRecord, persona: Persona) {
  if (!summary.summary) {
    return summary;
  }

  const cleanedSummary = sanitizePersonaScopedText(summary.summary, persona);
  if (!cleanedSummary) {
    return null;
  }

  return {
    ...summary,
    summary: cleanedSummary,
  };
}

export function buildCanonicalIdentityLines(persona: Persona) {
  return [
    persona.gender ? `- 性别/形象：${persona.gender}` : "",
    persona.age ? `- 年龄：${persona.age}` : "",
    persona.occupation
      ? `- 职业：${persona.occupation}`
      : "- 职业：未设定，不要自行编造具体职业",
    persona.city ? `- 常住城市：${persona.city}` : "",
    persona.family_info ? `- 家庭/居住信息：${persona.family_info}` : "",
  ].filter(Boolean);
}

export function hasConflictingPersonaIdentity(
  text: string,
  persona: Persona,
  options?: { treatFirstPersonAsPersona?: boolean },
) {
  const normalizedText = normalizeIdentityText(text);

  if (!normalizedText || !hasPersonaReference(text, persona, options)) {
    return false;
  }

  const occupationAliases = getOccupationAliases(persona.occupation);
  const conflictingAliases = getNonCanonicalOccupationAliases(persona);
  const hasRoleHint = ROLE_HINT_PATTERNS.some((pattern) => pattern.test(text));
  const mentionsCanonicalOccupation =
    occupationAliases.length > 0 &&
    occupationAliases.some((alias) => normalizedText.includes(alias));
  const mentionsConflictingOccupation = conflictingAliases.some((alias) =>
    normalizedText.includes(alias),
  );
  const containsInconsistencyHint = INCONSISTENCY_HINT_PATTERNS.some((pattern) =>
    pattern.test(text),
  );

  if (mentionsConflictingOccupation && hasRoleHint) {
    return true;
  }

  if (mentionsCanonicalOccupation && containsInconsistencyHint) {
    return true;
  }

  if (hasRoleHint && containsInconsistencyHint) {
    return true;
  }

  return false;
}

export function cleanConflictingPersonaSentences(
  text: string,
  persona: Persona,
  options?: { treatFirstPersonAsPersona?: boolean },
) {
  const trimmed = text.trim();
  if (!trimmed) return trimmed;

  const segments = trimmed
    .split(/(?<=[。！？!?])\s+|(?<=\.)\s+|\n+/)
    .map((segment) => segment.trim())
    .filter(Boolean);

  if (segments.length <= 1) {
    return hasConflictingPersonaIdentity(trimmed, persona, options) ? "" : trimmed;
  }

  return segments
    .filter(
      (segment) => !hasConflictingPersonaIdentity(segment, persona, options),
    )
    .join(" ")
    .trim();
}

export function filterConflictingPersonaMemories(
  memories: MemoryRecord[],
  persona: Persona,
) {
  return memories
    .map((memory) => {
      if (!shouldCheckPersonaMemory(memory)) {
        return memory;
      }

      const cleanedContent = sanitizePersonaScopedText(memory.content, persona, {
        treatFirstPersonAsPersona: true,
      });

      if (!cleanedContent) {
        return null;
      }

      return {
        ...memory,
        content: cleanedContent,
      };
    })
    .filter((memory) => Boolean(memory)) as MemoryRecord[];
}

export function filterConflictingSessionSummaries(
  summaries: SessionRecord[],
  persona: Persona,
) {
  return summaries
    .map((summary) => sanitizeSessionSummary(summary, persona))
    .filter((summary) => Boolean(summary)) as SessionRecord[];
}

export function sanitizeAssistantHistory(
  messages: MessageRecord[],
  persona: Persona,
) {
  return messages
    .map((message) => {
      if (message.role !== "assistant") {
        return message;
      }

      const cleanedContent = sanitizePersonaScopedText(message.content, persona, {
        treatFirstPersonAsPersona: true,
      });

      if (!cleanedContent) {
        return null;
      }

      return {
        ...message,
        content: cleanedContent,
      };
    })
    .filter((message) => Boolean(message)) as MessageRecord[];
}
