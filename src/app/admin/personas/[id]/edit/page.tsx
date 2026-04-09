"use client";

import { use, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { buildSystemPrompt } from "@/lib/ai/prompt-templates";
import {
  composeRelationshipModeTaggedText,
  parseRelationshipModeTaggedText,
  type RelationshipMode,
} from "@/lib/persona/relationship-mode";
import type { Persona } from "@/lib/supabase/types";

type PersonaFormState = {
  name: string;
  avatar_url: string;
  gender: string;
  age: string;
  occupation: string;
  city: string;
  personality: string;
  speaking_style: string;
  background_story: string;
  hobbies: string;
  daily_habits: string;
  family_info: string;
  default_relationship: string;
  relationship_mode: RelationshipMode;
  forbidden_patterns: string;
  example_dialogues: string;
  emotional_traits: string;
  quirks: string;
  is_active: boolean;
};

function personaToForm(persona: Persona): PersonaFormState {
  const relationship = parseRelationshipModeTaggedText(persona.default_relationship);

  return {
    name: persona.name ?? "",
    avatar_url: persona.avatar_url ?? "",
    gender: persona.gender ?? "",
    age: persona.age == null ? "" : String(persona.age),
    occupation: persona.occupation ?? "",
    city: persona.city ?? "",
    personality: persona.personality ?? "",
    speaking_style: persona.speaking_style ?? "",
    background_story: persona.background_story ?? "",
    hobbies: persona.hobbies ?? "",
    daily_habits: persona.daily_habits ?? "",
    family_info: persona.family_info ?? "",
    default_relationship: relationship.text,
    relationship_mode: relationship.mode ?? "friendly",
    forbidden_patterns: persona.forbidden_patterns ?? "",
    example_dialogues: persona.example_dialogues ?? "",
    emotional_traits: persona.emotional_traits ?? "",
    quirks: persona.quirks ?? "",
    is_active: persona.is_active ?? true,
  };
}

function formToPreviewPersona(form: PersonaFormState): Persona {
  return {
    id: "preview",
    name: form.name || "（未填写人名）",
    avatar_url: form.avatar_url || null,
    gender: form.gender || null,
    age: form.age ? Number(form.age) : null,
    occupation: form.occupation || null,
    city: form.city || null,
    personality: form.personality || "（未填写性格）",
    speaking_style: form.speaking_style || "（未填写说话风格）",
    background_story: form.background_story || null,
    hobbies: form.hobbies || null,
    daily_habits: form.daily_habits || null,
    family_info: form.family_info || null,
    default_relationship: composeRelationshipModeTaggedText(
      form.relationship_mode,
      form.default_relationship,
    ),
    forbidden_patterns: form.forbidden_patterns || null,
    example_dialogues: form.example_dialogues || null,
    emotional_traits: form.emotional_traits || null,
    quirks: form.quirks || null,
    is_active: form.is_active,
    created_at: null,
    updated_at: null,
  };
}

export default function EditPersonaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [form, setForm] = useState<PersonaFormState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const systemPromptPreview = useMemo(() => {
    if (!form) return "";
    return buildSystemPrompt(formToPreviewPersona(form));
  }, [form]);

  useEffect(() => {
    let mounted = true;

    async function loadPersona() {
      try {
        setLoadError(null);

        const response = await fetch(`/api/personas/${id}`);
        const json = (await response.json()) as {
          success: boolean;
          data: Persona | null;
          error: { message: string } | null;
        };

        if (!json.success || !json.data) {
          throw new Error(json.error?.message || "加载人设失败");
        }

        if (mounted) {
          setForm(personaToForm(json.data));
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "未知错误（加载人设）";
        if (mounted) {
          setLoadError(message);
        }
      }
    }

    void loadPersona();

    return () => {
      mounted = false;
    };
  }, [id]);

  async function handleSubmit() {
    if (!form) return;

    setSubmitError(null);
    setIsSubmitting(true);

    try {
      const payload = {
        name: form.name.trim(),
        avatar_url: form.avatar_url ? form.avatar_url.trim() : null,
        gender: form.gender ? form.gender.trim() : null,
        age: form.age ? Number(form.age) : null,
        occupation: form.occupation ? form.occupation.trim() : null,
        city: form.city ? form.city.trim() : null,
        personality: form.personality.trim(),
        speaking_style: form.speaking_style.trim(),
        background_story: form.background_story ? form.background_story.trim() : null,
        hobbies: form.hobbies ? form.hobbies.trim() : null,
        daily_habits: form.daily_habits ? form.daily_habits.trim() : null,
        family_info: form.family_info ? form.family_info.trim() : null,
        default_relationship: composeRelationshipModeTaggedText(
          form.relationship_mode,
          form.default_relationship.trim(),
        ),
        forbidden_patterns: form.forbidden_patterns
          ? form.forbidden_patterns.trim()
          : null,
        example_dialogues: form.example_dialogues
          ? form.example_dialogues.trim()
          : null,
        emotional_traits: form.emotional_traits
          ? form.emotional_traits.trim()
          : null,
        quirks: form.quirks ? form.quirks.trim() : null,
        is_active: form.is_active,
      };

      const response = await fetch(`/api/admin/personas/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = (await response.json()) as {
        success: boolean;
        data: unknown;
        error: { message: string } | null;
      };

      if (!json.success) {
        throw new Error(json.error?.message || "保存失败");
      }

      router.push("/admin/personas");
    } catch (error) {
      const message = error instanceof Error ? error.message : "未知错误（编辑人设）";
      setSubmitError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!confirm("确定删除这个人设吗？")) return;

    setSubmitError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/admin/personas/${id}`, {
        method: "DELETE",
      });

      const json = (await response.json()) as {
        success: boolean;
        error: { message: string } | null;
      };

      if (!json.success) {
        throw new Error(json.error?.message || "删除失败");
      }

      router.push("/admin/personas");
    } catch (error) {
      const message = error instanceof Error ? error.message : "未知错误（删除人设）";
      setSubmitError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (loadError) {
    return (
      <div className="min-h-screen p-8">
        <div className="text-red-600">加载失败：{loadError}</div>
      </div>
    );
  }

  if (!form) {
    return (
      <div className="min-h-screen p-8">
        <div className="text-sm text-zinc-600 dark:text-zinc-400">加载中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-zinc-50 text-zinc-900 dark:bg-black dark:text-zinc-50">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-10">
        <header className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">编辑人设</h1>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Phase 2.1：修改已有的人设设定，并实时预览 Prompt
            </p>
          </div>
          <button
            type="button"
            onClick={() => router.push("/admin/personas")}
            className="text-sm text-zinc-600 underline underline-offset-4 dark:text-zinc-300"
          >
            返回列表
          </button>
        </header>

        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
          <div className="flex flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="text-sm">
                人名
                <input
                  value={form.name}
                  onChange={(event) =>
                    setForm((current) =>
                      current ? { ...current, name: event.target.value } : current,
                    )
                  }
                  className="mt-1 w-full rounded-lg border border-zinc-200 bg-white p-2 outline-none dark:border-zinc-700 dark:bg-zinc-900"
                />
              </label>
              <label className="text-sm">
                头像 URL
                <input
                  value={form.avatar_url}
                  onChange={(event) =>
                    setForm((current) =>
                      current ? { ...current, avatar_url: event.target.value } : current,
                    )
                  }
                  className="mt-1 w-full rounded-lg border border-zinc-200 bg-white p-2 outline-none dark:border-zinc-700 dark:bg-zinc-900"
                />
              </label>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <label className="text-sm">
                性别
                <input
                  value={form.gender}
                  onChange={(event) =>
                    setForm((current) =>
                      current ? { ...current, gender: event.target.value } : current,
                    )
                  }
                  className="mt-1 w-full rounded-lg border border-zinc-200 bg-white p-2 outline-none dark:border-zinc-700 dark:bg-zinc-900"
                />
              </label>
              <label className="text-sm">
                年龄
                <input
                  value={form.age}
                  onChange={(event) =>
                    setForm((current) =>
                      current ? { ...current, age: event.target.value } : current,
                    )
                  }
                  className="mt-1 w-full rounded-lg border border-zinc-200 bg-white p-2 outline-none dark:border-zinc-700 dark:bg-zinc-900"
                />
              </label>
              <label className="text-sm">
                状态
                <select
                  value={form.is_active ? "true" : "false"}
                  onChange={(event) =>
                    setForm((current) =>
                      current
                        ? { ...current, is_active: event.target.value === "true" }
                        : current,
                    )
                  }
                  className="mt-1 w-full rounded-lg border border-zinc-200 bg-white p-2 outline-none dark:border-zinc-700 dark:bg-zinc-900"
                >
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                </select>
              </label>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="text-sm">
                职业
                <input
                  value={form.occupation}
                  onChange={(event) =>
                    setForm((current) =>
                      current ? { ...current, occupation: event.target.value } : current,
                    )
                  }
                  className="mt-1 w-full rounded-lg border border-zinc-200 bg-white p-2 outline-none dark:border-zinc-700 dark:bg-zinc-900"
                />
              </label>
              <label className="text-sm">
                城市
                <input
                  value={form.city}
                  onChange={(event) =>
                    setForm((current) =>
                      current ? { ...current, city: event.target.value } : current,
                    )
                  }
                  className="mt-1 w-full rounded-lg border border-zinc-200 bg-white p-2 outline-none dark:border-zinc-700 dark:bg-zinc-900"
                />
              </label>
            </div>

            <label className="text-sm">
              性格描述（必填）
              <textarea
                value={form.personality}
                onChange={(event) =>
                  setForm((current) =>
                    current ? { ...current, personality: event.target.value } : current,
                  )
                }
                className="mt-1 min-h-[110px] w-full rounded-lg border border-zinc-200 bg-white p-2 outline-none dark:border-zinc-700 dark:bg-zinc-900"
              />
            </label>

            <label className="text-sm">
              说话风格（必填）
              <textarea
                value={form.speaking_style}
                onChange={(event) =>
                  setForm((current) =>
                    current ? { ...current, speaking_style: event.target.value } : current,
                  )
                }
                className="mt-1 min-h-[110px] w-full rounded-lg border border-zinc-200 bg-white p-2 outline-none dark:border-zinc-700 dark:bg-zinc-900"
              />
            </label>

            <label className="text-sm">
              背景故事
              <textarea
                value={form.background_story}
                onChange={(event) =>
                  setForm((current) =>
                    current ? { ...current, background_story: event.target.value } : current,
                  )
                }
                className="mt-1 min-h-[90px] w-full rounded-lg border border-zinc-200 bg-white p-2 outline-none dark:border-zinc-700 dark:bg-zinc-900"
              />
            </label>

            <label className="text-sm">
              兴趣爱好
              <textarea
                value={form.hobbies}
                onChange={(event) =>
                  setForm((current) =>
                    current ? { ...current, hobbies: event.target.value } : current,
                  )
                }
                className="mt-1 min-h-[70px] w-full rounded-lg border border-zinc-200 bg-white p-2 outline-none dark:border-zinc-700 dark:bg-zinc-900"
              />
            </label>

            <label className="text-sm">
              日常习惯 / 作息
              <textarea
                value={form.daily_habits}
                onChange={(event) =>
                  setForm((current) =>
                    current ? { ...current, daily_habits: event.target.value } : current,
                  )
                }
                className="mt-1 min-h-[70px] w-full rounded-lg border border-zinc-200 bg-white p-2 outline-none dark:border-zinc-700 dark:bg-zinc-900"
              />
            </label>

            <label className="text-sm">
              家庭信息
              <textarea
                value={form.family_info}
                onChange={(event) =>
                  setForm((current) =>
                    current ? { ...current, family_info: event.target.value } : current,
                  )
                }
                className="mt-1 min-h-[70px] w-full rounded-lg border border-zinc-200 bg-white p-2 outline-none dark:border-zinc-700 dark:bg-zinc-900"
              />
            </label>

            <label className="text-sm">
              和用户的默认关系
              <textarea
                value={form.default_relationship}
                onChange={(event) =>
                  setForm((current) =>
                    current
                      ? { ...current, default_relationship: event.target.value }
                      : current,
                  )
                }
                className="mt-1 min-h-[70px] w-full rounded-lg border border-zinc-200 bg-white p-2 outline-none dark:border-zinc-700 dark:bg-zinc-900"
              />
            </label>

            <label className="text-sm">
              关系模式标签
              <select
                value={form.relationship_mode}
                onChange={(event) =>
                  setForm((current) =>
                    current
                      ? {
                          ...current,
                          relationship_mode: event.target.value as RelationshipMode,
                        }
                      : current,
                  )
                }
                className="mt-1 min-h-[44px] w-full rounded-lg border border-zinc-200 bg-white p-2 outline-none dark:border-zinc-700 dark:bg-zinc-900"
              >
                <option value="friendly">普通朋友</option>
                <option value="flirty">暧昧模式</option>
                <option value="intimate">亲密模式</option>
              </select>
            </label>

            <label className="text-sm">
              禁止说的话 / 禁止做的事
              <textarea
                value={form.forbidden_patterns}
                onChange={(event) =>
                  setForm((current) =>
                    current
                      ? { ...current, forbidden_patterns: event.target.value }
                      : current,
                  )
                }
                className="mt-1 min-h-[90px] w-full rounded-lg border border-zinc-200 bg-white p-2 outline-none dark:border-zinc-700 dark:bg-zinc-900"
              />
            </label>

            <label className="text-sm">
              示例对话（支持多行）
              <textarea
                value={form.example_dialogues}
                onChange={(event) =>
                  setForm((current) =>
                    current
                      ? { ...current, example_dialogues: event.target.value }
                      : current,
                  )
                }
                className="mt-1 min-h-[140px] w-full rounded-lg border border-zinc-200 bg-white p-2 outline-none dark:border-zinc-700 dark:bg-zinc-900"
              />
            </label>

            <label className="text-sm">
              情绪特征
              <textarea
                value={form.emotional_traits}
                onChange={(event) =>
                  setForm((current) =>
                    current
                      ? { ...current, emotional_traits: event.target.value }
                      : current,
                  )
                }
                className="mt-1 min-h-[70px] w-full rounded-lg border border-zinc-200 bg-white p-2 outline-none dark:border-zinc-700 dark:bg-zinc-900"
              />
            </label>

            <label className="text-sm">
              小怪癖
              <textarea
                value={form.quirks}
                onChange={(event) =>
                  setForm((current) =>
                    current ? { ...current, quirks: event.target.value } : current,
                  )
                }
                className="mt-1 min-h-[70px] w-full rounded-lg border border-zinc-200 bg-white p-2 outline-none dark:border-zinc-700 dark:bg-zinc-900"
              />
            </label>

            {submitError ? (
              <div className="text-sm text-red-600 dark:text-red-400">{submitError}</div>
            ) : null}

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => void handleSubmit()}
                disabled={isSubmitting}
                className="mt-2 h-11 rounded-lg bg-zinc-900 px-4 text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-black"
              >
                {isSubmitting ? "保存中..." : "保存修改"}
              </button>
              <button
                type="button"
                onClick={() => void handleDelete()}
                disabled={isSubmitting}
                className="mt-2 h-11 rounded-lg border border-red-200 px-4 text-red-700 disabled:opacity-50 dark:border-red-700 dark:text-red-300"
              >
                删除
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <div>
              <div className="font-medium">System Prompt 预览</div>
              <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                根据当前表单字段实时生成，方便直接检查角色约束和语气。
              </div>
            </div>
            <textarea
              className="min-h-[520px] w-full rounded-lg border border-zinc-200 bg-white p-2 font-mono text-xs outline-none dark:border-zinc-700 dark:bg-zinc-900"
              value={systemPromptPreview}
              readOnly
            />
          </div>
        </div>
      </div>
    </div>
  );
}
