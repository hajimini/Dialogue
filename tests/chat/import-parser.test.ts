import { parseLineChatWithDates } from "@/lib/chat/import-parser";

describe("parseLineChatWithDates", () => {
  test("keeps transcript order when the file starts before the first date heading", () => {
    const transcript = [
      "11:00 遇見初雪 您好~請問在忙嗎？",
      "11:47 遇見初雪 有件事情想跟您確認一下，不知道現在方不方便聊一下呢？",
      "02:17 遇見初雪 我們公司幾位股東準備了一批物資要提供給獨居長輩使用，愛台獅子會會長張雨荷請我跟您聯繫",
      "2026.4.7 星期二",
      "04:25 遇見初雪 想跟您約時間交接物資，看看什麼時候方便呢？",
      "04:45 葉富雄4.6 什麼東西",
      "2026.4.9 星期四",
      "03:36 遇見初雪 真的太抱歉了！",
      "04:06 葉富雄4.6 贴图",
    ].join("\n");

    const messages = parseLineChatWithDates(transcript, "遇見初雪");

    expect(messages).toHaveLength(7);
    expect(messages.every((message) => Boolean(message.createdAt))).toBe(true);
    expect(messages.map((message) => message.role)).toEqual([
      "assistant",
      "assistant",
      "assistant",
      "assistant",
      "user",
      "assistant",
      "user",
    ]);

    const createdAtMillis = messages.map((message) => Date.parse(message.createdAt!));
    expect(createdAtMillis).toEqual([...createdAtMillis].sort((left, right) => left - right));
    expect(messages[0].createdAt).toBe("2026-04-06T03:00:00.000Z");
    expect(messages[1].createdAt).toBe("2026-04-06T03:47:00.001Z");
    expect(messages[2].createdAt).toBe("2026-04-06T18:17:00.002Z");
    expect(messages[3].createdAt).toBe("2026-04-06T20:25:00.003Z");
    expect(messages[5].createdAt).toBe("2026-04-08T19:36:00.005Z");
  });

  test("resets the intra-day clock when a new explicit date heading appears", () => {
    const transcript = [
      "2026.4.7 星期二",
      "23:50 小芮嫣 晚安",
      "2026.4.9 星期四",
      "03:36 小芮嫣 早呀",
    ].join("\n");

    const messages = parseLineChatWithDates(transcript, "小芮嫣");

    expect(messages[0].createdAt).toBe("2026-04-07T15:50:00.000Z");
    expect(messages[1].createdAt).toBe("2026-04-08T19:36:00.001Z");
  });
});
