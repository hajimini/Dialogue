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

function trimToNaturalLength(text: string, maxLength = 420) {
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
    .replace(/^(当然|好的|首先|总之)[：:，,\s]*/i, "")
    .replace(/^(我理解你的感受|我理解你现在的感受)[，,。.!！]*/i, "")
    .replace(/^(根据你的描述)[，,。.!！]*/i, "")
    .replace(/^(如果你需要帮助)[，,。.!！]*/i, "")
    .replace(/^(让我们先)[，,。.!！]*/i, "")
    .replace(/^(建议你)[，,。.!！]*/i, "")
    .replace(/^(作为)[，,。.!！]*/i, "")
    .replace(/^(我是由.*开发)[，,。.!！]*/i, "")
    .replace(/^(我不能讨论)[，,。.!！]*/i, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function postProcessAssistantReply(reply: string, personaName: string) {
  let text = (reply ?? "").toString().trim();
  if (!text) return "";

  // 移除人设名字前缀
  const prefixRe = new RegExp(
    `^${escapeRegExp(personaName)}[：:，,\\-\\s]+`,
    "i",
  );
  text = text.replace(prefixRe, "").trim();
  
  // 移除 Markdown 格式
  text = stripMarkdown(text);

  // 检测并拒绝明显的 AI 自我声明
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

  // 过滤常见的 AI 套话和 meta 暴露
  const aiPhrases = [
    /我理解你的感受[，,。.]/gi,
    /让我们一起[\s\S]{0,10}吧/gi,
    /你可以尝试[\s\S]{0,20}[。.]/gi,
    /建议你[\s\S]{0,20}[。.]/gi,
    /希望能帮到你/gi,
    /如果你需要[\s\S]{0,15}，我[\s\S]{0,15}[。.]/gi,
    /根据你的描述/gi,
    /我注意到/gi,
    /从你的话中/gi,
    /我是由.*开发的/gi,
    /我是.*AI.*助手/gi,
    /作为.*AI/gi,
  ];

  for (const pattern of aiPhrases) {
    text = text.replace(pattern, "");
  }

  text = compressAssistantTone(text);

  // 移除多余的换行
  text = text.replace(/\n{3,}/g, "\n\n").trim();
  
  // 限制长度，保持自然
  text = trimToNaturalLength(text, 220);

  return text;
}
