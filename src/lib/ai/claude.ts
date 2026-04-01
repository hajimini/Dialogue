type ClaudeMessageInput = {
  role: "user" | "assistant";
  content: string;
};

type ClaudeTextOptions = {
  system: string;
  messages: ClaudeMessageInput[];
  model?: string;
  modelProviderId?: string;
  maxTokens?: number;
  temperature?: number;
};

type DirectModelProvider = {
  providerId: string;
  apiUrl: string;
  apiKey: string;
  model: string;
};

function getAnthropicApiKey() {
  return process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN;
}

function getAnthropicEndpoint() {
  return `${(process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com").replace(/\/$/, "")}/v1/messages`;
}

function extractTextBlocks(json: {
  content?: Array<{ type?: string; text?: string }> | Array<string>;
}) {
  return (json.content ?? [])
    .map((block) => {
      if (typeof block === "string") return block;
      if (block?.type === "text" && typeof block.text === "string") {
        return block.text;
      }
      return "";
    })
    .join("")
    .trim();
}

function getDirectModelProviders() {
  const raw = process.env.DIRECT_MODEL_PROVIDERS?.trim();
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed.filter((item): item is DirectModelProvider => {
      if (!item || typeof item !== "object") return false;
      const record = item as Record<string, unknown>;
      return (
        typeof record.providerId === "string" &&
        typeof record.apiUrl === "string" &&
        typeof record.apiKey === "string" &&
        typeof record.model === "string"
      );
    });
  } catch {
    return [];
  }
}

function extractOpenAiText(json: {
  choices?: Array<{
    message?: {
      content?: string | Array<{ text?: string; type?: string }>;
    };
  }>;
  output?: Array<{
    type?: string;
    content?: Array<{ text?: string; type?: string }>;
  }>;
}) {
  const firstChoice = json.choices?.[0]?.message?.content;

  if (typeof firstChoice === "string") {
    return firstChoice.trim();
  }

  if (Array.isArray(firstChoice)) {
    return firstChoice
      .map((item) => (typeof item?.text === "string" ? item.text : ""))
      .join("")
      .trim();
  }

  const outputText = (json.output ?? [])
    .flatMap((item) => item.content ?? [])
    .map((item) => (typeof item?.text === "string" ? item.text : ""))
    .join("")
    .trim();

  return outputText;
}

async function generateDirectProviderText(
  provider: DirectModelProvider,
  options: ClaudeTextOptions,
) {
  const baseUrl = provider.apiUrl.replace(/\/$/, "").replace(/\/v1$/, "");
  const endpoint = `${baseUrl}/v1/chat/completions`;
  const model = options.model || provider.model;

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${provider.apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? Number(process.env.ANTHROPIC_MAX_TOKENS || 800),
        messages: [
          {
            role: "system",
            content: options.system,
          },
          ...options.messages.map((message) => ({
            role: message.role,
            content: message.content,
          })),
        ],
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(
        `Direct model API error: ${response.status} ${response.statusText}. Provider: ${provider.providerId}, URL: ${endpoint}, Model: ${model}. Response: ${body.slice(0, 200)}`,
      );
    }

    const json = (await response.json()) as {
      choices?: Array<{
        message?: {
          content?: string | Array<{ text?: string; type?: string }>;
        };
      }>;
      output?: Array<{
        type?: string;
        content?: Array<{ text?: string; type?: string }>;
      }>;
    };

    const text = extractOpenAiText(json);
    if (!text) {
      throw new Error(`Direct model returned empty response. Provider: ${provider.providerId}, Model: ${model}`);
    }

    return text;
  } catch (error) {
    if (error instanceof Error && error.message.includes("Direct model")) {
      throw error;
    }

    throw new Error(
      `Network error calling direct model provider. Provider: ${provider.providerId}, URL: ${endpoint}, Model: ${model}. Original error: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function parseJsonCandidate(text: string) {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]+?)```/i);
  const raw = fenced?.[1]?.trim() || trimmed;

  try {
    return JSON.parse(raw) as unknown;
  } catch {
    const objectMatch = raw.match(/\{[\s\S]*\}/);
    if (!objectMatch) {
      throw new Error("Claude did not return valid JSON.");
    }
    return JSON.parse(objectMatch[0]) as unknown;
  }
}

export async function generateClaudeText(options: ClaudeTextOptions) {
  if (options.modelProviderId) {
    const provider = getDirectModelProviders().find(
      (item) => item.providerId === options.modelProviderId,
    );

    if (!provider) {
      throw new Error(`Unknown model provider: ${options.modelProviderId}`);
    }

    return generateDirectProviderText(provider, options);
  }

  const apiKey = getAnthropicApiKey();
  if (!apiKey) {
    throw new Error("Missing ANTHROPIC_API_KEY or ANTHROPIC_AUTH_TOKEN.");
  }

  const endpoint = getAnthropicEndpoint();
  const model = options.model || process.env.ANTHROPIC_MODEL || "claude-3-5-sonnet-latest";

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: options.maxTokens ?? Number(process.env.ANTHROPIC_MAX_TOKENS || 800),
        temperature: options.temperature ?? 0.7,
        system: options.system,
        messages: options.messages.map((message) => ({
          role: message.role,
          content: message.content,
        })),
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(
        `Anthropic API error: ${response.status} ${response.statusText}. URL: ${endpoint}, Model: ${model}. Response: ${body.slice(0, 200)}`,
      );
    }

    const json = (await response.json()) as {
      content?: Array<{ type?: string; text?: string }> | Array<string>;
    };

    return extractTextBlocks(json);
  } catch (error) {
    if (error instanceof Error && error.message.includes("Anthropic API error")) {
      throw error;
    }

    throw new Error(
      `Network error calling Anthropic API. URL: ${endpoint}, Model: ${model}. Original error: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export async function generateClaudeJson<T>(
  options: ClaudeTextOptions,
  fallback: T,
) {
  try {
    const text = await generateClaudeText(options);
    return parseJsonCandidate(text) as T;
  } catch {
    return fallback;
  }
}
