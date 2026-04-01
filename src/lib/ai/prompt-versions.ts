import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { PromptVersionRecord } from "@/lib/supabase/types";

async function ensureDefaultPromptVersion() {
  const supabase = getSupabaseAdminClient();
  const { count, error } = await supabase
    .from("prompt_versions")
    .select("id", { head: true, count: "exact" });

  if (error) {
    throw new Error(`Failed to read prompt versions: ${error.message}`);
  }

  if ((count ?? 0) > 0) {
    return;
  }

  const { error: insertError } = await supabase.from("prompt_versions").insert({
    label: "v1 Baseline",
    instructions:
      "Keep the reply grounded in the persona. Prefer short, natural, emotionally aware sentences and avoid assistant-style structure.",
    notes: "Seeded baseline version for prompt management.",
    is_active: true,
  });

  if (insertError) {
    throw new Error(`Failed to seed prompt version: ${insertError.message}`);
  }
}

export async function listPromptVersions() {
  await ensureDefaultPromptVersion();
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("prompt_versions")
    .select("*")
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to read prompt versions: ${error.message}`);
  }

  return (data ?? []) as PromptVersionRecord[];
}

export async function getActivePromptVersion(preferredId?: string) {
  const versions = await listPromptVersions();
  const preferredVersion = preferredId
    ? versions.find((item) => item.id === preferredId)
    : null;

  return preferredVersion ?? versions.find((item) => item.is_active) ?? versions[0];
}

export async function createPromptVersion(input: {
  label: string;
  instructions: string;
  notes?: string;
}) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("prompt_versions")
    .insert({
      label: input.label.trim(),
      instructions: input.instructions.trim(),
      notes: input.notes?.trim() || null,
      is_active: false,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Failed to create prompt version.");
  }

  return data as PromptVersionRecord;
}

export async function activatePromptVersion(versionId: string) {
  const supabase = getSupabaseAdminClient();
  const now = new Date().toISOString();

  const { error: deactivateError } = await supabase
    .from("prompt_versions")
    .update({ is_active: false, updated_at: now })
    .neq("id", "");

  if (deactivateError) {
    throw new Error(`Failed to deactivate prompt versions: ${deactivateError.message}`);
  }

  const { data, error } = await supabase
    .from("prompt_versions")
    .update({ is_active: true, updated_at: now })
    .eq("id", versionId)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Prompt version not found.");
  }

  return data as PromptVersionRecord;
}
