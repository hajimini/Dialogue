import { afterAll, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { generateClaudeText } from "@/lib/ai/claude";

type MockResponse = {
  ok: boolean;
  status: number;
  statusText: string;
  json: () => Promise<unknown>;
  text: () => Promise<string>;
};

const originalEnv = process.env;
const originalFetch = global.fetch;

function createJsonResponse(body: unknown, init?: Partial<MockResponse>): MockResponse {
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    json: async () => body,
    text: async () => JSON.stringify(body),
    ...init,
  };
}

describe("generateClaudeText", () => {
  beforeEach(() => {
    process.env = {
      ...originalEnv,
      ANTHROPIC_AUTH_TOKEN: "test-token",
      ANTHROPIC_BASE_URL: "https://openrouter.vip",
      ANTHROPIC_MODEL: "claude-sonnet-4-5",
      ANTHROPIC_DEFAULT_HAIKU_MODEL: "",
      ANTHROPIC_FALLBACK_MODELS: "",
    };
    global.fetch = jest.fn<typeof fetch>();
  });

  afterAll(() => {
    process.env = originalEnv;
    global.fetch = originalFetch;
  });

  it("returns text from the primary anthropic-compatible response", async () => {
    const fetchMock = global.fetch as jest.MockedFunction<typeof fetch>;
    fetchMock.mockResolvedValueOnce(
      createJsonResponse({
        model: "claude-sonnet-4-5",
        content: [{ type: "text", text: "早安呀" }],
      }) as unknown as Response,
    );

    const text = await generateClaudeText({
      system: "Say hello.",
      messages: [{ role: "user", content: "早安" }],
    });

    expect(text).toBe("早安呀");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("normalizes anthropic base URLs with or without /v1 suffixes", async () => {
    const fetchMock = global.fetch as jest.MockedFunction<typeof fetch>;
    fetchMock.mockResolvedValue(
      createJsonResponse({
        model: "claude-sonnet-4-5",
        content: [{ type: "text", text: "ok" }],
      }) as unknown as Response,
    );

    process.env.ANTHROPIC_BASE_URL = "https://openrouter.vip";
    await generateClaudeText({
      system: "Say hello.",
      messages: [{ role: "user", content: "hello" }],
    });

    process.env.ANTHROPIC_BASE_URL = "https://openrouter.vip/v1";
    await generateClaudeText({
      system: "Say hello.",
      messages: [{ role: "user", content: "hello" }],
    });

    process.env.ANTHROPIC_BASE_URL = "https://openrouter.vip/v1/messages";
    await generateClaudeText({
      system: "Say hello.",
      messages: [{ role: "user", content: "hello" }],
    });

    expect(String(fetchMock.mock.calls[0]?.[0])).toBe("https://openrouter.vip/v1/messages");
    expect(String(fetchMock.mock.calls[1]?.[0])).toBe("https://openrouter.vip/v1/messages");
    expect(String(fetchMock.mock.calls[2]?.[0])).toBe("https://openrouter.vip/v1/messages");
  });

  it("retries empty anthropic-compatible responses before succeeding", async () => {
    process.env.ANTHROPIC_EMPTY_RESPONSE_RETRIES = "2";

    const fetchMock = global.fetch as jest.MockedFunction<typeof fetch>;
    fetchMock
      .mockResolvedValueOnce(
        createJsonResponse({
          model: "claude-sonnet-4-5",
          content: [],
        }) as unknown as Response,
      )
      .mockResolvedValueOnce(
        createJsonResponse({
          model: "claude-sonnet-4-5",
          content: [{ type: "text", text: "重试成功" }],
        }) as unknown as Response,
      );

    const text = await generateClaudeText({
      system: "Say hello.",
      messages: [{ role: "user", content: "hello" }],
    });

    expect(text).toBe("重试成功");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("retries model-family mismatches before succeeding", async () => {
    process.env.ANTHROPIC_EMPTY_RESPONSE_RETRIES = "2";

    const fetchMock = global.fetch as jest.MockedFunction<typeof fetch>;
    fetchMock
      .mockResolvedValueOnce(
        createJsonResponse({
          model: "gpt-5.4",
          content: [{ type: "text", text: "bad" }],
        }) as unknown as Response,
      )
      .mockResolvedValueOnce(
        createJsonResponse({
          model: "claude-sonnet-4-5",
          content: [{ type: "text", text: "Claude正常" }],
        }) as unknown as Response,
      );

    const text = await generateClaudeText({
      system: "Say hello.",
      messages: [{ role: "user", content: "hello" }],
    });

    expect(text).toBe("Claude正常");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("tries the configured fallback model when the primary response is empty", async () => {
    process.env.ANTHROPIC_DEFAULT_HAIKU_MODEL = "claude-haiku-4-5";

    const fetchMock = global.fetch as jest.MockedFunction<typeof fetch>;
    fetchMock
      .mockResolvedValueOnce(
        createJsonResponse({
          model: "gpt-5.4",
          content: [],
        }) as unknown as Response,
      )
      .mockResolvedValueOnce(
        createJsonResponse({
          model: "claude-haiku-4-5",
          content: [{ type: "text", text: "早呀，我在。" }],
        }) as unknown as Response,
      );

    const text = await generateClaudeText({
      system: "Say hello.",
      messages: [{ role: "user", content: "早安" }],
    });

    expect(text).toBe("早呀，我在。");
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const firstCall = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    const secondCall = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body));

    expect(firstCall.model).toBe("claude-sonnet-4-5");
    expect(secondCall.model).toBe("claude-haiku-4-5");
  });

  it("throws a descriptive error when the provider returns empty text", async () => {
    const fetchMock = global.fetch as jest.MockedFunction<typeof fetch>;
    fetchMock.mockResolvedValueOnce(
      createJsonResponse({
        model: "gpt-5.4",
        content: [],
      }) as unknown as Response,
    );

    await expect(
      generateClaudeText({
        system: "Say hello.",
        messages: [{ role: "user", content: "早安" }],
      }),
    ).rejects.toThrow(
      "Anthropic-compatible API returned a different model family. URL: https://openrouter.vip/v1/messages, Requested model: claude-sonnet-4-5, Returned model: gpt-5.4",
    );
  });

  it("uses the configured direct provider fallback after anthropic-compatible models fail", async () => {
    process.env.ANTHROPIC_DEFAULT_HAIKU_MODEL = "claude-haiku-4-5";
    process.env.ANTHROPIC_FALLBACK_MODEL_PROVIDER_ID = "openrouter-backup";
    process.env.DIRECT_MODEL_PROVIDERS = JSON.stringify([
      {
        providerId: "openrouter-backup",
        apiUrl: "https://openrouter.vip/v1",
        apiKey: "backup-token",
        model: "gpt-5.4",
      },
    ]);

    const fetchMock = global.fetch as jest.MockedFunction<typeof fetch>;
    fetchMock
      .mockResolvedValueOnce(
        createJsonResponse({
          model: "gpt-5.4",
          content: [],
        }) as unknown as Response,
      )
      .mockResolvedValueOnce(
        createJsonResponse({
          model: "gpt-5.4-mini-2026-03-17",
          content: [],
        }) as unknown as Response,
      )
      .mockResolvedValueOnce(
        createJsonResponse({
          choices: [
            {
              message: {
                content: "备用模型恢复正常输出",
              },
            },
          ],
        }) as unknown as Response,
      );

    const text = await generateClaudeText({
      system: "Say hello.",
      messages: [{ role: "user", content: "早安" }],
    });

    expect(text).toBe("备用模型恢复正常输出");
    expect(fetchMock).toHaveBeenCalledTimes(3);

    const providerCall = fetchMock.mock.calls[2];
    expect(String(providerCall?.[0])).toBe("https://openrouter.vip/v1/chat/completions");
  });

  it("trims old history and retries when a direct provider hits its context limit", async () => {
    process.env.DIRECT_MODEL_PROVIDERS = JSON.stringify([
      {
        providerId: "nvidia-free",
        apiUrl: "https://integrate.api.nvidia.com/v1",
        apiKey: "nvapi-test",
        model: "nvidia/nemotron-mini-4b-instruct",
      },
    ]);

    const fetchMock = global.fetch as jest.MockedFunction<typeof fetch>;
    fetchMock
      .mockResolvedValueOnce(
        createJsonResponse(
          {
            error:
              "This model's maximum context length is 4096 tokens. However, you requested 4595 tokens (4395 in the messages, 200 in the completion). Please reduce the length of the messages or completion.",
          },
          {
            ok: false,
            status: 400,
            statusText: "Bad Request",
            text: async () =>
              '{"error":"This model\\u0027s maximum context length is 4096 tokens. However, you requested 4595 tokens (4395 in the messages, 200 in the completion). Please reduce the length of the messages or completion."}',
          },
        ) as unknown as Response,
      )
      .mockResolvedValueOnce(
        createJsonResponse({
          choices: [
            {
              message: {
                content: "裁剪后成功",
              },
            },
          ],
        }) as unknown as Response,
      );

    const text = await generateClaudeText({
      system: "You are helpful.",
      modelProviderId: "nvidia-free",
      messages: [
        { role: "user", content: "old-1" },
        { role: "assistant", content: "old-2" },
        { role: "user", content: "latest-question" },
      ],
    });

    expect(text).toBe("裁剪后成功");
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const retriedCallBody = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body));
    expect(retriedCallBody.messages).toEqual([
      { role: "system", content: "You are helpful." },
      { role: "user", content: "latest-question" },
    ]);
  });

  it("falls back to the next direct provider when the primary one is rate limited", async () => {
    process.env.DIRECT_MODEL_PROVIDERS = JSON.stringify([
      {
        providerId: "openrouter-free-gptoss20b",
        apiUrl: "https://openrouter.ai/api/v1",
        apiKey: "or-primary",
        model: "openai/gpt-oss-20b:free",
      },
      {
        providerId: "openrouter-free-gptoss120b",
        apiUrl: "https://openrouter.ai/api/v1",
        apiKey: "or-backup",
        model: "openai/gpt-oss-120b:free",
      },
    ]);

    const fetchMock = global.fetch as jest.MockedFunction<typeof fetch>;
    fetchMock
      .mockResolvedValueOnce(
        createJsonResponse(
          {
            error: {
              message: "Provider returned error",
              code: 429,
              metadata: {
                raw: "openai/gpt-oss-20b:free is temporarily rate-limited upstream.",
              },
            },
          },
          {
            ok: false,
            status: 429,
            statusText: "Too Many Requests",
            text: async () =>
              '{"error":{"message":"Provider returned error","code":429,"metadata":{"raw":"openai/gpt-oss-20b:free is temporarily rate-limited upstream."}}}',
          },
        ) as unknown as Response,
      )
      .mockResolvedValueOnce(
        createJsonResponse({
          choices: [
            {
              message: {
                content: "备用模型恢复成功",
              },
            },
          ],
        }) as unknown as Response,
      );

    const text = await generateClaudeText({
      system: "Say hello.",
      modelProviderId: "openrouter-free-gptoss20b",
      messages: [{ role: "user", content: "hello" }],
    });

    expect(text).toBe("备用模型恢复成功");
    expect(fetchMock).toHaveBeenCalledTimes(2);

    expect(String(fetchMock.mock.calls[0]?.[0])).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect(String(fetchMock.mock.calls[1]?.[0])).toBe("https://openrouter.ai/api/v1/chat/completions");

    const firstBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    const secondBody = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body));

    expect(firstBody.model).toBe("openai/gpt-oss-20b:free");
    expect(secondBody.model).toBe("openai/gpt-oss-120b:free");
  });

  it("surfaces both Claude primary failure and direct fallback failure in the final error", async () => {
    process.env.ANTHROPIC_DEFAULT_HAIKU_MODEL = "claude-haiku-4-5";
    process.env.ANTHROPIC_FALLBACK_MODEL_PROVIDER_ID = "openrouter-backup";
    process.env.DIRECT_MODEL_PROVIDERS = JSON.stringify([
      {
        providerId: "openrouter-backup",
        apiUrl: "https://openrouter.vip/v1",
        apiKey: "backup-token",
        model: "gpt-5.4",
      },
    ]);

    const fetchMock = global.fetch as jest.MockedFunction<typeof fetch>;
    fetchMock
      .mockResolvedValueOnce(
        createJsonResponse({
          model: "gpt-5.4",
          content: [],
        }) as unknown as Response,
      )
      .mockResolvedValueOnce(
        createJsonResponse({
          model: "gpt-5.4-mini-2026-03-17",
          content: [],
        }) as unknown as Response,
      )
      .mockResolvedValueOnce(
        createJsonResponse({
          choices: [
            {
              message: {
                content: null,
              },
            },
          ],
        }) as unknown as Response,
      );

    await generateClaudeText({
      system: "Say hello.",
      messages: [{ role: "user", content: "鏃╁畨" }],
    }).then(
      () => {
        throw new Error("Expected generateClaudeText to fail.");
      },
      (error) => {
        const message = error instanceof Error ? error.message : String(error);
        expect(message).toContain(
          "Claude primary model chain failed (claude-sonnet-4-5 -> claude-haiku-4-5).",
        );
        expect(message).toContain(
          "Direct fallback provider openrouter-backup also failed: Direct model returned empty response. Provider: openrouter-backup, Model: gpt-5.4",
        );
      },
    );
  });

  it("does not use the direct provider fallback when explicitly disabled", async () => {
    process.env.ANTHROPIC_DEFAULT_HAIKU_MODEL = "claude-haiku-4-5";
    process.env.ANTHROPIC_FALLBACK_MODEL_PROVIDER_ID = "openrouter-backup";
    process.env.DIRECT_MODEL_PROVIDERS = JSON.stringify([
      {
        providerId: "openrouter-backup",
        apiUrl: "https://openrouter.vip/v1",
        apiKey: "backup-token",
        model: "gpt-5.4",
      },
    ]);

    const fetchMock = global.fetch as jest.MockedFunction<typeof fetch>;
    fetchMock
      .mockResolvedValueOnce(
        createJsonResponse({
          model: "gpt-5.4",
          content: [],
        }) as unknown as Response,
      )
      .mockResolvedValueOnce(
        createJsonResponse({
          model: "gpt-5.4-mini-2026-03-17",
          content: [],
        }) as unknown as Response,
      );

    await expect(
      generateClaudeText({
        system: "Say hello.",
        messages: [{ role: "user", content: "早安" }],
        disableDirectProviderFallback: true,
      }),
    ).rejects.toThrow(
      "Anthropic-compatible API returned a different model family. URL: https://openrouter.vip/v1/messages, Requested model: claude-haiku-4-5, Returned model: gpt-5.4-mini-2026-03-17",
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
