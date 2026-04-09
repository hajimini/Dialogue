import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";

jest.mock("@/lib/ai/prompt-versions", () => ({
  getActivePromptVersion: jest.fn(async () => ({
    id: "prompt-test",
    label: "Prompt Test",
    instructions: "Keep it natural.",
    notes: null,
    is_active: true,
    created_at: null,
    updated_at: null,
  })),
}));

import { buildChatSystemPrompt } from "@/lib/ai/prompt-builder";
import type { Persona } from "@/lib/supabase/types";

const persona: Persona = {
  id: "persona-1",
  name: "小芮嫣",
  avatar_url: null,
  gender: "female",
  age: 24,
  occupation: "插画师",
  city: "台南",
  personality: "温柔，带一点俏皮",
  speaking_style: "LINE 私聊感，自然口语",
  background_story: null,
  hobbies: "散步、喝咖啡、看展",
  daily_habits: null,
  family_info: null,
  default_relationship: "暧昧中慢慢熟起来的对象",
  forbidden_patterns: null,
  example_dialogues: null,
  emotional_traits: "高情商，会照顾气氛",
  quirks: null,
  is_active: true,
  created_at: null,
  updated_at: null,
};

describe("buildChatSystemPrompt", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-04-09T23:30:00+08:00"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("includes topic continuity, warmth, and night-chat rules", async () => {
    const prompt = await buildChatSystemPrompt({
      persona,
      userProfile: null,
      recentSummaries: [],
      relevantMemories: [],
    });

    expect(prompt).toContain("## Conversation Growth Rules");
    expect(prompt).toContain("## Natural Discovery Of The User");
    expect(prompt).toContain("## Relationship Warmth");
    expect(prompt).toContain("## High EQ And Light Humor");
    expect(prompt).toContain("## Night Chat Rhythm");
    expect(prompt).toContain("After 23:00, start winding the conversation down in character.");
    expect(prompt).toContain("Do not repeatedly ask biography-style questions in consecutive turns.");
  });

  it("changes strategy text based on relationship stage", async () => {
    const prompt = await buildChatSystemPrompt({
      persona,
      userProfile: {
        id: "profile-1",
        user_id: "user-1",
        persona_id: persona.id,
        character_id: null,
        relationship_stage: "warming",
        total_messages: 28,
        updated_at: null,
        profile_data: {
          summary: "He is a night owl who likes casual chatting.",
          facts: ["Works in design."],
          preferences: ["Likes coffee."],
          relationship_notes: ["They already have a few recurring topics."],
          recent_topics: ["late-night snacks"],
          anchors: ["He often chats after 10pm."],
        },
      },
      recentSummaries: [],
      relevantMemories: [],
    });

    expect(prompt).toContain("## Relationship Stage Strategy");
    expect(prompt).toContain("- Current stage: warming");
    expect(prompt).toContain("softly flirty");
    expect(prompt).toContain("push-pull");
  });
});
