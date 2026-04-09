export type RelationshipMode = "friendly" | "flirty" | "intimate";

const MODE_TAG_PATTERN = /^\[mode:(friendly|flirty|intimate)\]\s*/i;

export function parseRelationshipModeTaggedText(value: string | null | undefined) {
  const raw = (value ?? "").trim();
  const match = raw.match(MODE_TAG_PATTERN);
  const mode = (match?.[1]?.toLowerCase() as RelationshipMode | undefined) ?? null;
  const text = raw.replace(MODE_TAG_PATTERN, "").trim();

  return {
    mode,
    text,
  };
}

export function stripRelationshipModeTag(value: string | null | undefined) {
  return parseRelationshipModeTaggedText(value).text;
}

export function composeRelationshipModeTaggedText(
  mode: RelationshipMode,
  text: string | null | undefined,
) {
  const cleaned = stripRelationshipModeTag(text);
  return `[mode:${mode}]${cleaned ? ` ${cleaned}` : ""}`;
}
