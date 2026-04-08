import { describe, expect, it } from "@jest/globals";
import { postProcessAssistantReply } from "@/lib/ai/post-processor";

describe("postProcessAssistantReply", () => {
  it("keeps a short ping reply to one line", () => {
    const result = postProcessAssistantReply("在呀。你怎么了？", "芷晴秋叶", "在吗");

    expect(result.split("\n")).toHaveLength(1);
  });

  it("limits casual question replies to at most two lines when appropriate", () => {
    const result = postProcessAssistantReply(
      "我店在台北车站旁边的大安区。你搭捷运会比较方便。要不要我跟你说路线？",
      "芷晴秋叶",
      "台北车站附近吗？",
    );

    expect(result.split("\n")).toHaveLength(2);
  });

  it("caps complex replies at three lines", () => {
    const result = postProcessAssistantReply(
      "可以呀。你先搭捷运到台北车站。出站后往东边走。看到秋叶素食再跟我说。",
      "芷晴秋叶",
      "你跟我说一下怎么走，我第一次去，不太会找",
    );

    expect(result.split("\n")).toHaveLength(3);
  });

  it("drops generic trailing follow-up for factual questions", () => {
    const result = postProcessAssistantReply(
      "我店在台北车站附近。搭捷运会比较方便。要不要我再跟你说路线？",
      "芷晴秋叶",
      "台北车站附近吗？",
    );

    expect(result).toBe("我店在台北车站附近。\n搭捷运会比较方便。");
  });
});
