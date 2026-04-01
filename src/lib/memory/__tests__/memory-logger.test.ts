import { beforeEach, describe, expect, it, jest } from "@jest/globals";
const insertMock: jest.Mock = jest.fn();
const rangeMock: jest.Mock = jest.fn();
const orderMock = jest.fn();
const selectMock = jest.fn();
const eqMock = jest.fn();

jest.mock("@/lib/memory/storage", () => ({
  getMemorySupabaseClient: () => ({
    from: () => ({
      insert: insertMock,
      select: selectMock,
    }),
  }),
}));

describe("memoryLogger", () => {
  beforeEach(() => {
    insertMock.mockReset();
    rangeMock.mockReset();
    orderMock.mockReset();
    selectMock.mockReset();
    eqMock.mockReset();
  });

  it("writes JSON logs to stdout and persists them", async () => {
    const consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    (insertMock as unknown as { mockResolvedValue: (value: unknown) => void }).mockResolvedValue({
      error: null,
    });

    const { memoryLogger } = await import("@/lib/memory/memory-logger");

    await memoryLogger.log({
      timestamp: "2026-03-28T00:00:00.000Z",
      operation: "memory.search",
      user_id: "user-1",
      persona_id: "persona-1",
      character_id: "character-1",
      memory_id: "memory-1",
      duration: 120,
      success: true,
      metadata: { query: "那个展" },
    });

    expect(consoleSpy).toHaveBeenCalledTimes(1);
    expect(String(consoleSpy.mock.calls[0][0])).toContain("\"operation\":\"memory.search\"");
    expect(String(consoleSpy.mock.calls[0][0])).toContain("\"character_id\":\"character-1\"");
    expect(insertMock).toHaveBeenCalledTimes(1);

    consoleSpy.mockRestore();
  });

  it("includes persistence error details in warning logs", async () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    (insertMock as unknown as { mockResolvedValue: (value: unknown) => void }).mockResolvedValue({
      error: {
        message: "permission denied for table memory_operation_logs",
        details: "new row violates policy",
        hint: "check RLS",
        code: "42501",
        name: "PostgrestError",
      },
    });

    const { memoryLogger } = await import("@/lib/memory/memory-logger");

    await memoryLogger.log({
      timestamp: "2026-03-31T00:00:00.000Z",
      operation: "chat.reply",
      user_id: "user-1",
      persona_id: "persona-1",
      character_id: "character-1",
      duration: 42,
      success: true,
    });

    expect(warnSpy).toHaveBeenCalledTimes(1);
    const warning = String(warnSpy.mock.calls[0][0]);
    expect(warning).toContain("permission denied for table memory_operation_logs");
    expect(warning).toContain("42501");
    expect(warning).toContain("character-1");

    warnSpy.mockRestore();
  });

  it("applies character_id filter when querying logs", async () => {
    eqMock.mockReturnThis();
    (rangeMock as unknown as { mockResolvedValue: (value: unknown) => void }).mockResolvedValue({
      data: [],
      count: 0,
      error: null,
    });
    const chainedQuery = { eq: eqMock, range: rangeMock, order: orderMock };
    orderMock.mockReturnValue(chainedQuery);
    selectMock.mockReturnValue(chainedQuery);
    eqMock.mockReturnValue(chainedQuery);

    const { memoryLogger } = await import("@/lib/memory/memory-logger");
    await memoryLogger.query({ characterId: "character-1" });

    expect(eqMock).toHaveBeenCalledWith("character_id", "character-1");
  });

  it("throws when log table schema is unavailable", async () => {
    eqMock.mockReturnThis();
    (rangeMock as unknown as { mockResolvedValue: (value: unknown) => void }).mockResolvedValue({
      data: null,
      count: null,
      error: {
        message: "Could not find the table 'public.memory_operation_logs' in the schema cache",
        details: "",
        hint: "",
        code: "PGRST205",
        name: "PostgrestError",
      },
    });
    orderMock.mockReturnValue({ range: rangeMock, eq: eqMock });
    selectMock.mockReturnValue({ order: orderMock, eq: eqMock, range: rangeMock });

    const { memoryLogger } = await import("@/lib/memory/memory-logger");

    await expect(memoryLogger.query()).rejects.toThrow(
      "memory_operation_logs schema is not ready",
    );
  });
});
