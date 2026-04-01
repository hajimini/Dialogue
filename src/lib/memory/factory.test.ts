import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import * as configModule from "@/lib/memory/config";
import { getMemoryGateway, resetMemoryGateway } from "@/lib/memory/factory";

const mem0AdapterMock = jest.fn();

jest.mock("@/lib/memory/adapters/mem0-adapter", () => ({
  Mem0Adapter: function MockMem0Adapter(config: unknown) {
    mem0AdapterMock(config);
    return { provider: "mem0", config };
  },
}));

describe("Memory Gateway Factory", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    resetMemoryGateway();
    jest.restoreAllMocks();
    mem0AdapterMock.mockClear();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    resetMemoryGateway();
    process.env = originalEnv;
  });

  it("creates a Mem0 gateway by default", () => {
    process.env.SUPABASE_URL = "https://test.supabase.co";
    process.env.SUPABASE_SERVICE_KEY = "service-key";

    const gateway = getMemoryGateway() as unknown as { provider: string };

    expect(gateway.provider).toBe("mem0");
    expect(mem0AdapterMock).toHaveBeenCalledTimes(1);
  });

  it("returns the same singleton instance until reset", () => {
    process.env.SUPABASE_URL = "https://test.supabase.co";
    process.env.SUPABASE_SERVICE_KEY = "service-key";

    const first = getMemoryGateway();
    const second = getMemoryGateway();

    expect(first).toBe(second);
    expect(mem0AdapterMock).toHaveBeenCalledTimes(1);
  });

  it("recreates the gateway after resetMemoryGateway", () => {
    process.env.SUPABASE_URL = "https://test.supabase.co";
    process.env.SUPABASE_SERVICE_KEY = "service-key";

    const first = getMemoryGateway();
    resetMemoryGateway();
    const second = getMemoryGateway();

    expect(first).not.toBe(second);
    expect(mem0AdapterMock).toHaveBeenCalledTimes(2);
  });

  it("throws a clear error for the letta provider", () => {
    process.env.MEMORY_PROVIDER = "letta";
    process.env.SUPABASE_URL = "https://test.supabase.co";
    process.env.SUPABASE_SERVICE_KEY = "service-key";

    expect(() => getMemoryGateway()).toThrow(
      "Memory provider 'letta' is not yet supported",
    );
  });

  it("throws for unsupported providers", () => {
    jest.spyOn(configModule, "getMemoryGatewayConfig").mockReturnValue({
      provider: "invalid" as never,
      mem0: {
        apiKey: "",
        supabaseUrl: "https://test.supabase.co",
        supabaseKey: "service-key",
        embeddingConfig: {
          provider: "openai",
          apiKey: "",
          model: "text-embedding-3-large",
        },
        rerankerConfig: {
          provider: "none",
          apiKey: "",
        },
        retrievalLimit: 5,
      },
    });

    expect(() => getMemoryGateway()).toThrow(
      "Unsupported memory provider: 'invalid'. Supported providers: 'mem0', 'letta'.",
    );
  });
});
