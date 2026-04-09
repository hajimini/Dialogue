import { describe, expect, it } from "@jest/globals";
import {
  composeRelationshipModeTaggedText,
  parseRelationshipModeTaggedText,
  stripRelationshipModeTag,
} from "@/lib/persona/relationship-mode";

describe("relationship mode tags", () => {
  it("composes and parses relationship mode tags", () => {
    const tagged = composeRelationshipModeTaggedText("flirty", "暧昧中慢慢熟起来的对象");

    expect(tagged).toBe("[mode:flirty] 暧昧中慢慢熟起来的对象");
    expect(parseRelationshipModeTaggedText(tagged)).toEqual({
      mode: "flirty",
      text: "暧昧中慢慢熟起来的对象",
    });
  });

  it("strips tags from legacy prompt-facing text", () => {
    expect(stripRelationshipModeTag("[mode:friendly] 普通朋友")).toBe("普通朋友");
  });
});
