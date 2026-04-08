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
  disableDirectProviderFallback?: boolean;
};

type DirectModelProvider = {
  providerId: string;
  apiUrl: string;
  apiKey: string;
  model: string;
};

type AnthropicMessageResponse = {
  model?: string;
  content?: Array<{ type?: string; text?: string }> | Array<string>;
};

type DirectContextLengthError = {
  maxContextTokens: number;
  requestedTokens: number;
  messageTokens: number;
  completionTokens: number;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getAnthropicApiKey() {
  return process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN;
}

function getAnthropicEndpoint() {
  const rawBaseUrl = (process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com").trim();
  const normalizedBaseUrl = rawBaseUrl
    .replace(/\/$/, "")
    .replace(/\/v1\/messages$/, "")
    .replace(/\/v1$/, "");

  return `${normalizedBaseUrl}/v1/messages`;
}

function getAnthropicRetryCount() {
  const raw = process.env.ANTHROPIC_EMPTY_RESPONSE_RETRIES?.trim();
  const parsed = raw ? Number(raw) : 0;

  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.floor(parsed);
}

function isModelFamilyMismatch(requestedModel: string, returnedModel?: string) {
  if (!returnedModel) return false;

  const requested = requestedModel.toLowerCase();
  const returned = returnedModel.toLowerCase();

  if (requested.includes("claude") && !returned.includes("claude")) {
    return true;
  }

  if (requested.includes("gpt") && !returned.includes("gpt")) {
    return true;
  }

  return false;
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

function getAnthropicFallbackModels(primaryModel: string) {
  const configuredFallbacks = (process.env.ANTHROPIC_FALLBACK_MODELS || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const defaultHaikuModel = process.env.ANTHROPIC_DEFAULT_HAIKU_MODEL?.trim() || "";

  return [...new Set([...configuredFallbacks, defaultHaikuModel])].filter(
    (model) => model && model !== primaryModel,
  );
}

function getAnthropicFallbackModelProviderId() {
  return process.env.ANTHROPIC_FALLBACK_MODEL_PROVIDER_ID?.trim() || "";
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

function parseDirectContextLengthError(text: string): DirectContextLengthError | null {
  const match = text.match(
    /maximum context length is (\d+) tokens.*requested (\d+) tokens \((\d+) in the messages, (\d+) in the completion\)/i,
  );

  if (!match) return null;

  return {
    maxContextTokens: Number(match[1]),
    requestedTokens: Number(match[2]),
    messageTokens: Number(match[3]),
    completionTokens: Number(match[4]),
  };
}

function trimOldestConversationTurn(messages: ClaudeMessageInput[]) {
  if (messages.length <= 1) {
    return messages;
  }

  if (messages.length === 2) {
    return messages.slice(1);
  }

  return messages.slice(2);
}

function isRetryableDirectProviderError(message: string) {
  return (
    message.includes("429 Too Many Requests") ||
    message.includes("temporarily rate-limited upstream") ||
    message.includes("Direct model returned empty response") ||
    message.includes("Network error calling direct model provider")
  );
}

async function generateDirectProviderText(
  provider: DirectModelProvider,
  options: ClaudeTextOptions,
) {
  const baseUrl = provider.apiUrl.replace(/\/$/, "").replace(/\/v1$/, "");
  const endpoint = `${baseUrl}/v1/chat/completions`;
  const model = options.model || provider.model;
  let messages = [...options.messages];

  while (true) {
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
            ...messages.map((message) => ({
              role: message.role,
              content: message.content,
            })),
          ],
        }),
      });

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        const contextError = parseDirectContextLengthError(body);

        if (response.status === 400 && contextError && messages.length > 1) {
          const previousLength = messages.length;
          messages = trimOldestConversationTurn(messages);

          console.warn(
            `[DirectModel] Context too long for ${provider.providerId}/${model} (${contextError.requestedTokens} > ${contextError.maxContextTokens}). Trimming history from ${previousLength} to ${messages.length} messages and retrying.`,
          );
          continue;
        }

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
}

async function generateDirectProviderChain(
  primaryProviderId: string,
  options: ClaudeTextOptions,
) {
  const providers = getDirectModelProviders();
  const primaryProvider = providers.find((item) => item.providerId === primaryProviderId);

  if (!primaryProvider) {
    throw new Error(`Unknown model provider: ${primaryProviderId}`);
  }

  const candidateProviders = [
    primaryProvider,
    ...providers.filter((item) => item.providerId !== primaryProviderId),
  ];
  let lastError: Error | null = null;

  for (const [index, provider] of candidateProviders.entries()) {
    try {
      return await generateDirectProviderText(provider, options);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      const shouldTryFallback =
        isRetryableDirectProviderError(lastError.message) &&
        index < candidateProviders.length - 1;

      if (shouldTryFallback) {
        const nextProvider = candidateProviders[index + 1];
        console.warn(
          `[DirectModel] Provider ${provider.providerId} failed: ${lastError.message}. Trying fallback provider ${nextProvider.providerId}.`,
        );
        continue;
      }

      throw lastError;
    }
  }

  throw lastError || new Error(`Direct model provider chain failed: ${primaryProviderId}`);
}

async function generateAnthropicCompatibleText(
  endpoint: string,
  apiKey: string,
  model: string,
  options: ClaudeTextOptions,
) {
  const retryCount = getAnthropicRetryCount();

  for (let attempt = 0; attempt <= retryCount; attempt += 1) {
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
          `Anthropic API error: ${response.status} ${response.statusText}. URL: ${endpoint}, Requested model: ${model}. Response: ${body.slice(0, 200)}`,
        );
      }

      const json = (await response.json()) as AnthropicMessageResponse;
      const returnedModel = json.model || "unknown";

      if (isModelFamilyMismatch(model, json.model)) {
        throw new Error(
          `Anthropic-compatible API returned a different model family. URL: ${endpoint}, Requested model: ${model}, Returned model: ${returnedModel}`,
        );
      }

      const text = extractTextBlocks(json);

      if (!text) {
        throw new Error(
          `Anthropic-compatible API returned empty text. URL: ${endpoint}, Requested model: ${model}, Returned model: ${returnedModel}`,
        );
      }

      return text;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const isRetryable =
        message.includes("returned empty text") ||
        message.includes("returned a different model family");

      if (isRetryable && attempt < retryCount) {
        console.warn(
          `[Claude] Transient upstream issue on ${model}, retry ${attempt + 1}/${retryCount}: ${message}`,
        );
        await sleep(500 * (attempt + 1));
        continue;
      }

      if (error instanceof Error && error.message.includes("Anthropic")) {
        throw error;
      }

      throw new Error(
        `Network error calling Anthropic API. URL: ${endpoint}, Requested model: ${model}. Original error: ${message}`,
      );
    }
  }

  throw new Error(`Anthropic-compatible API failed after retries. URL: ${endpoint}, Requested model: ${model}`);
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
    return generateDirectProviderChain(options.modelProviderId, options);
  }

  const apiKey = getAnthropicApiKey();
  if (!apiKey) {
    throw new Error("Missing ANTHROPIC_API_KEY or ANTHROPIC_AUTH_TOKEN.");
  }

  const endpoint = getAnthropicEndpoint();
  const primaryModel = options.model || process.env.ANTHROPIC_MODEL || "claude-3-5-sonnet-latest";
  const candidateModels = [primaryModel, ...getAnthropicFallbackModels(primaryModel)];
  const fallbackProviderId = options.disableDirectProviderFallback
    ? ""
    : getAnthropicFallbackModelProviderId();
  let lastError: Error | null = null;

  for (const [index, model] of candidateModels.entries()) {
    try {
      return await generateAnthropicCompatibleText(endpoint, apiKey, model, options);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (index < candidateModels.length - 1) {
        const nextModel = candidateModels[index + 1];
        console.warn(
          `[Claude] Model ${model} failed: ${lastError.message}. Trying fallback model ${nextModel}.`,
        );
      }
    }
  }

  if (fallbackProviderId) {
    const provider = getDirectModelProviders().find(
      (item) => item.providerId === fallbackProviderId,
    );
    const attemptedModels = candidateModels.join(" -> ");
    const anthropicFailureMessage = lastError?.message || "Unknown Anthropic-compatible failure.";

    if (!provider) {
      throw new Error(
        `Claude primary model chain failed (${attemptedModels}). Last Anthropic-compatible error: ${anthropicFailureMessage}. Anthropic fallback model provider is not configured: ${fallbackProviderId}`,
      );
    }

    console.warn(
      `[Claude] Anthropic-compatible models failed. Trying direct provider fallback ${fallbackProviderId}.`,
    );
    try {
      return await generateDirectProviderText(provider, options);
    } catch (error) {
      const directFailureMessage =
        error instanceof Error ? error.message : String(error);
      throw new Error(
        `Claude primary model chain failed (${attemptedModels}). Last Anthropic-compatible error: ${anthropicFailureMessage}. Direct fallback provider ${fallbackProviderId} also failed: ${directFailureMessage}`,
      );
    }
  }

  throw lastError || new Error("Anthropic text generation failed without a specific error.");
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
