export type ImportedMessage = {
  role: "user" | "assistant";
  content: string;
  timestamp?: string;
  createdAt?: string;
};

type ParsedLineMessage = {
  time: string;
  sender: string;
  content: string;
  explicitDate: string | null;
};

function parseDateHeading(line: string) {
  const match = line.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})/);
  if (!match) return null;

  const [, year, month, day] = match;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function normalizeImportedContent(content: string) {
  const value = content.trim();
  if (value === "璨煎湒" || value === "璨煎湒璨肩礄") return "[貼圖]";
  if (value === "鍦栫墖") return "[圖片]";
  if (value === "鐓х墖") return "[照片]";
  return value;
}

function normalizeSenderIdentity(value: string) {
  return value
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}\u4e00-\u9fa5]/gu, "")
    .toLowerCase();
}

function timeToMinutes(time: string) {
  const [hour, minute] = time.split(":").map(Number);
  return hour * 60 + minute;
}

function shiftDateByDays(date: string, days: number) {
  const [year, month, day] = date.split("-").map(Number);
  const base = new Date(Date.UTC(year, month - 1, day + days, 12, 0, 0));
  return base.toISOString().slice(0, 10);
}

function buildCreatedAt(date: string | null, time: string, sequence: number) {
  if (!date) return undefined;

  const base = new Date(`${date}T${time}:00+08:00`);
  if (Number.isNaN(base.getTime())) return undefined;

  return new Date(base.getTime() + sequence).toISOString();
}

function parseMessageLines(text: string) {
  const lines = text.split(/\r?\n/);
  const senderCounts = new Map<string, number>();
  const messages: ParsedLineMessage[] = [];
  let currentDate: string | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const parsedDate = parseDateHeading(trimmed);
    if (parsedDate) {
      currentDate = parsedDate;
      continue;
    }

    const match = trimmed.match(/^(\d{2}:\d{2})\s+(\S+(?:\s+\S+)*?)\s+(.+)$/);
    if (!match) continue;

    const [, time, sender, content] = match;
    const normalizedContent = normalizeImportedContent(content);
    if (!normalizedContent) continue;

    messages.push({
      time,
      sender,
      content: normalizedContent,
      explicitDate: currentDate,
    });

    senderCounts.set(sender, (senderCounts.get(sender) || 0) + 1);
  }

  return { messages, senderCounts };
}

function resolvePersonaSender(
  senderCounts: Map<string, number>,
  personaName: string,
) {
  let personaSender = "";

  if (personaName) {
    const normalizedPersonaName = normalizeSenderIdentity(personaName);

    for (const sender of senderCounts.keys()) {
      const normalizedSender = normalizeSenderIdentity(sender);
      if (
        sender.includes(personaName) ||
        personaName.includes(sender) ||
        (normalizedPersonaName &&
          normalizedSender &&
          (normalizedSender.includes(normalizedPersonaName) ||
            normalizedPersonaName.includes(normalizedSender)))
      ) {
        return sender;
      }
    }
  }

  let maxCount = 0;
  for (const [sender, count] of senderCounts.entries()) {
    if (count > maxCount) {
      maxCount = count;
      personaSender = sender;
    }
  }

  return personaSender;
}

function resolveMessageDates(messages: ParsedLineMessage[]) {
  const resolvedDates = new Array<string | null>(messages.length).fill(null);
  let currentDate: string | null = null;
  let lastSeenMinutes: number | null = null;

  for (let index = 0; index < messages.length; index += 1) {
    const message = messages[index];

    if (message.explicitDate) {
      currentDate = message.explicitDate;
      lastSeenMinutes = null;
    }

    if (!currentDate) {
      continue;
    }

    const currentMinutes = timeToMinutes(message.time);
    if (lastSeenMinutes !== null && currentMinutes < lastSeenMinutes) {
      currentDate = shiftDateByDays(currentDate, 1);
    }

    resolvedDates[index] = currentDate;
    lastSeenMinutes = currentMinutes;
  }

  const firstResolvedIndex = resolvedDates.findIndex((date) => Boolean(date));
  if (firstResolvedIndex > 0) {
    let anchorDate = resolvedDates[firstResolvedIndex];
    let nextMinutes = timeToMinutes(messages[firstResolvedIndex].time);

    for (let index = firstResolvedIndex - 1; index >= 0; index -= 1) {
      if (!anchorDate) break;

      const currentMinutes = timeToMinutes(messages[index].time);
      if (currentMinutes > nextMinutes) {
        anchorDate = shiftDateByDays(anchorDate, -1);
      }

      resolvedDates[index] = anchorDate;
      nextMinutes = currentMinutes;
    }
  }

  return resolvedDates;
}

export function parseLineChatWithDates(text: string, personaName: string): ImportedMessage[] {
  const { messages: parsedMessages, senderCounts } = parseMessageLines(text);
  const personaSender = resolvePersonaSender(senderCounts, personaName);
  const resolvedDates = resolveMessageDates(parsedMessages);

  let sequence = 0;
  let lastCreatedAtMillis = Number.NEGATIVE_INFINITY;

  return parsedMessages.map((message, index) => {
    let createdAt = buildCreatedAt(resolvedDates[index], message.time, sequence);
    if (createdAt) {
      const createdAtMillis = Date.parse(createdAt);
      if (Number.isFinite(lastCreatedAtMillis) && createdAtMillis <= lastCreatedAtMillis) {
        createdAt = new Date(lastCreatedAtMillis + 1).toISOString();
      }

      lastCreatedAtMillis = Date.parse(createdAt);
      sequence += 1;
    }

    return {
      role: message.sender === personaSender ? "assistant" : "user",
      content: message.content,
      timestamp: message.time,
      createdAt,
    };
  });
}
