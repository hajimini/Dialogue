function escapeRegExp(input: string) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function stripMarkdown(text: string) {
  return text
    .replace(/```[\s\S]*?```/g, "")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .trim();
}

function trimToNaturalLength(text: string, maxLength = 160) {
  if (text.length <= maxLength) {
    return text;
  }

  const clipped = text.slice(0, maxLength);
  const sentenceBreak = Math.max(
    clipped.lastIndexOf("。"),
    clipped.lastIndexOf("！"),
    clipped.lastIndexOf("？"),
    clipped.lastIndexOf(". "),
    clipped.lastIndexOf("! "),
    clipped.lastIndexOf("? "),
  );

  if (sentenceBreak >= maxLength * 0.6) {
    return clipped.slice(0, sentenceBreak + 1).trim();
  }

  return `${clipped.trim()}...`;
}

function compressAssistantTone(text: string) {
  return text
    .replace(/^(当然|好的|首先|总之)[，。!?？\s]*/i, "")
    .replace(/^(我理解你的感受|我理解你现在的感受)[，。!?？]*/i, "")
    .replace(/^(根据你的描述)[，。!?？]*/i, "")
    .replace(/^(如果你需要帮助)[，。!?？]*/i, "")
    .replace(/^(让我们先)[，。!?？]*/i, "")
    .replace(/^(建议你)[，。!?？]*/i, "")
    .replace(/^(作为)[，。!?？]*/i, "")
    .replace(/^(我是由.*开发的)[，。!?？]*/i, "")
    .replace(/^(我不能讨论)[，。!?？]*/i, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function estimateTargetSentenceCount(userMessage: string | undefined) {
  const text = (userMessage ?? "").trim();
  if (!text) return 2;

  const normalized = text.toLowerCase();
  const length = text.length;
  const questionMarks = (text.match(/[?？]/g) ?? []).length;
  const clauseBreaks = (text.match(/[，,、；;。.!！?？\n]/g) ?? []).length;

  const pingHints = ["在吗", "在嘛", "在不在", "嗯", "哦", "好", "哈哈", "早安", "晚安"];
  const emotionalHints = ["难受", "烦", "累", "想哭", "委屈", "崩溃", "不想", "失眠"];
  const factualHints = [
    "哪里",
    "哪",
    "几点",
    "多久",
    "附近",
    "是不是",
    "有吗",
    "能吗",
    "可以吗",
    "怎么去",
    "怎么走",
  ];
  const complexHints = [
    "为什么",
    "如何",
    "怎么回事",
    "要不要",
    "告诉我一下",
    "跟我说一下",
    "第一次去",
    "不太会",
    "你觉得",
  ];

  if (length <= 6 || pingHints.some((hint) => text.includes(hint))) {
    return 1;
  }

  if (emotionalHints.some((hint) => text.includes(hint))) {
    return 2;
  }

  if (
    length >= 26 ||
    questionMarks >= 2 ||
    clauseBreaks >= 3 ||
    complexHints.some((hint) => normalized.includes(hint))
  ) {
    return 3;
  }

  if (
    factualHints.some((hint) => text.includes(hint)) ||
    length >= 10 ||
    questionMarks >= 1 ||
    clauseBreaks >= 1
  ) {
    return 2;
  }

  return 1;
}

function splitReplyIntoBursts(text: string, maxBursts: number) {
  const lines = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  const sentenceSegments = lines.flatMap((line) => {
    const matches = line.match(/[^。！？!?…\n]+[。！？!?…]?/g) ?? [];
    const cleaned = matches.map((segment) => segment.trim()).filter(Boolean);
    return cleaned.length > 0 ? cleaned : [line];
  });

  const segments =
    sentenceSegments.length > 0
      ? sentenceSegments
      : text
          .split(/[，,、；;]+/)
          .map((segment) => segment.trim())
          .filter(Boolean);

  const limited = segments.slice(0, Math.max(1, maxBursts));

  if (segments.length > limited.length && limited.length > 0) {
    limited[limited.length - 1] = `${limited[limited.length - 1]} ${segments
      .slice(limited.length)
      .join(" ")}`.trim();
  }

  return limited.map((segment) => segment.replace(/\s+/g, " ").trim()).filter(Boolean);
}

function removeGenericFollowupTail(segments: string[], userMessage: string | undefined) {
  if (segments.length === 0) {
    return segments;
  }

  const text = (userMessage ?? "").trim();
  const isMostlyFactual =
    ["哪里", "哪", "几点", "多久", "附近", "怎么走", "怎么去", "有吗", "是不是"].some((hint) =>
      text.includes(hint),
    ) && !["难受", "烦", "累", "想哭"].some((hint) => text.includes(hint));

  if (!isMostlyFactual) {
    return segments;
  }

  const cleaned = [...segments];
  const last = cleaned[cleaned.length - 1] ?? "";
  const genericFollowupPatterns = [
    /^要不要我/i,
    /^需要我/i,
    /^还要我/i,
    /^我再跟你说/i,
    /^你要我/i,
  ];

  if (genericFollowupPatterns.some((pattern) => pattern.test(last))) {
    cleaned.pop();
    return cleaned;
  }

  const trailingFollowup = /(?:\s+|^)(要不要我|需要我|还要我|我再跟你说|你要我)[^。！？!?]*[。！？!?]?$/i;
  cleaned[cleaned.length - 1] = last.replace(trailingFollowup, "").trim();
  if (!cleaned[cleaned.length - 1]) {
    cleaned.pop();
  }

  return cleaned;
}

export function postProcessAssistantReply(
  reply: string,
  personaName: string,
  userMessage?: string,
) {
  let text = (reply ?? "").toString().trim();
  if (!text) return "";

  const prefixRe = new RegExp(`^${escapeRegExp(personaName)}[：:，,-\\s]+`, "i");
  text = text.replace(prefixRe, "").trim();
  text = stripMarkdown(text);

  const bannedOpeners = [
    /^作为\s*ai[\s\S]*$/i,
    /^我是\s*ai[\s\S]*$/i,
    /^I am an AI[\s\S]*$/i,
    /^As an AI[\s\S]*$/i,
  ];

  for (const pattern of bannedOpeners) {
    if (pattern.test(text)) {
      return "";
    }
  }

  const aiPhrases = [
    /我理解你的感受[，。!?？]?/gi,
    /让我们一起[\s\S]{0,10}吧/gi,
    /你可以尝试[\s\S]{0,20}[。！？!?]?/gi,
    /建议你[\s\S]{0,20}[。！？!?]?/gi,
    /希望能帮到你/gi,
    /如果你需要[\s\S]{0,15}，我[\s\S]{0,15}[。！？!?]?/gi,
    /根据你的描述/gi,
    /我注意到/gi,
    /从你的话里/gi,
    /我是由.*开发的/gi,
    /我是.*AI.*助手/gi,
    /作为.*AI/gi,
  ];

  for (const pattern of aiPhrases) {
    text = text.replace(pattern, "");
  }

  text = compressAssistantTone(text);
  text = text.replace(/\n{3,}/g, "\n\n").trim();
  text = trimToNaturalLength(text, 160);

  const targetSentenceCount = Math.min(3, Math.max(1, estimateTargetSentenceCount(userMessage)));
  let bursts = splitReplyIntoBursts(text, targetSentenceCount);
  bursts = removeGenericFollowupTail(bursts, userMessage);

  if (bursts.length === 0) {
    bursts = splitReplyIntoBursts(text, 1);
  }

  return bursts.slice(0, 3).join("\n").trim();
}
