"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { buildSystemPrompt } from "@/lib/ai/prompt-templates";
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
  forbidden_patterns: string;
  example_dialogues: string;

  emotional_traits: string;
  quirks: string;

  is_active: boolean;
};

const emptyForm: PersonaFormState = {
  name: "",
  avatar_url: "",
  gender: "",
  age: "",
  occupation: "",
  city: "",

  personality: "",
  speaking_style: "",
  background_story: "",
  hobbies: "",
  daily_habits: "",
  family_info: "",

  default_relationship: "",
  forbidden_patterns: "",
  example_dialogues: "",

  emotional_traits: "",
  quirks: "",

  is_active: true,
};

function toPersonaFromForm(state: PersonaFormState): Persona {
  return {
    id: "preview",
    name: state.name || "（未填写人名）",
    avatar_url: state.avatar_url ? state.avatar_url : null,
    gender: state.gender ? state.gender : null,
    age: state.age ? Number(state.age) : null,
    occupation: state.occupation ? state.occupation : null,
    city: state.city ? state.city : null,

    personality: state.personality || "（未填写性格）",
    speaking_style: state.speaking_style || "（未填写说话风格）",
    background_story: state.background_story ? state.background_story : null,
    hobbies: state.hobbies ? state.hobbies : null,
    daily_habits: state.daily_habits ? state.daily_habits : null,
    family_info: state.family_info ? state.family_info : null,

    default_relationship: state.default_relationship ? state.default_relationship : null,
    forbidden_patterns: state.forbidden_patterns ? state.forbidden_patterns : null,
    example_dialogues: state.example_dialogues ? state.example_dialogues : null,

    emotional_traits: state.emotional_traits ? state.emotional_traits : null,
    quirks: state.quirks ? state.quirks : null,

    is_active: state.is_active,
    created_at: null,
    updated_at: null,
  };
}

export default function NewPersonaPage() {
  const router = useRouter();
  const [form, setForm] = useState<PersonaFormState>(emptyForm);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const systemPromptPreview = useMemo(() => {
    const persona = toPersonaFromForm(form);
    return buildSystemPrompt(persona);
  }, [form]);

  async function handleSubmit() {
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

        default_relationship: form.default_relationship
          ? form.default_relationship.trim()
          : null,
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

      const res = await fetch("/api/admin/personas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = (await res.json()) as {
        success: boolean;
        data: unknown;
        error: { message: string } | null;
      };

      if (!json.success) {
        throw new Error(json.error?.message || "创建失败");
      }

      router.push("/admin/personas");
    } catch (err) {
      const message = err instanceof Error ? err.message : "未知错误（创建人设）";
      setSubmitError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen w-full bg-zinc-50 text-zinc-900 dark:bg-black dark:text-zinc-50">
      <div className="mx-auto w-full max-w-5xl px-4 py-10 flex flex-col gap-6">
        <header className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">新建人设</h1>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
              Phase 2.1 + 2.2：自动生成 System Prompt 预览
            </p>
          </div>
          <button
            onClick={() => router.push("/admin/personas")}
            className="text-sm underline underline-offset-4 text-zinc-600 dark:text-zinc-300"
            type="button"
          >
            返回列表
          </button>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          <div className="rounded-xl border border-zinc-200 bg-white dark:bg-zinc-900 p-4 flex flex-col gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="text-sm">
                人名
                <input
                  value={form.name}
                  onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-2 outline-none"
                />
              </label>
              <label className="text-sm">
                头像 URL
                <input
                  value={form.avatar_url}
                  onChange={(e) => setForm((s) => ({ ...s, avatar_url: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-2 outline-none"
                  placeholder="可选"
                />
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <label className="text-sm">
                性别
                <input
                  value={form.gender}
                  onChange={(e) => setForm((s) => ({ ...s, gender: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-2 outline-none"
                  placeholder="女/男/其他"
                />
              </label>
              <label className="text-sm">
                年龄
                <input
                  value={form.age}
                  onChange={(e) => setForm((s) => ({ ...s, age: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-2 outline-none"
                  placeholder="可选"
                />
              </label>
              <label className="text-sm">
                状态
                <select
                  value={form.is_active ? "true" : "false"}
                  onChange={(e) => setForm((s) => ({ ...s, is_active: e.target.value === "true" }))}
                  className="mt-1 w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-2 outline-none"
                >
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                </select>
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="text-sm">
                职业
                <input
                  value={form.occupation}
                  onChange={(e) => setForm((s) => ({ ...s, occupation: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-2 outline-none"
                />
              </label>
              <label className="text-sm">
                城市
                <input
                  value={form.city}
                  onChange={(e) => setForm((s) => ({ ...s, city: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-2 outline-none"
                />
              </label>
            </div>

            <label className="text-sm">
              性格描述（必填）
              <textarea
                value={form.personality}
                onChange={(e) => setForm((s) => ({ ...s, personality: e.target.value }))}
                className="mt-1 w-full min-h-[110px] rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-2 outline-none"
              />
            </label>

            <label className="text-sm">
              说话风格（必填）
              <textarea
                value={form.speaking_style}
                onChange={(e) => setForm((s) => ({ ...s, speaking_style: e.target.value }))}
                className="mt-1 w-full min-h-[110px] rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-2 outline-none"
              />
            </label>

            <label className="text-sm">
              背景故事
              <textarea
                value={form.background_story}
                onChange={(e) => setForm((s) => ({ ...s, background_story: e.target.value }))}
                className="mt-1 w-full min-h-[90px] rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-2 outline-none"
              />
            </label>

            <label className="text-sm">
              兴趣爱好
              <textarea
                value={form.hobbies}
                onChange={(e) => setForm((s) => ({ ...s, hobbies: e.target.value }))}
                className="mt-1 w-full min-h-[70px] rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-2 outline-none"
              />
            </label>

            <label className="text-sm">
              日常习惯/作息
              <textarea
                value={form.daily_habits}
                onChange={(e) => setForm((s) => ({ ...s, daily_habits: e.target.value }))}
                className="mt-1 w-full min-h-[70px] rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-2 outline-none"
              />
            </label>

            <label className="text-sm">
              家庭信息
              <textarea
                value={form.family_info}
                onChange={(e) => setForm((s) => ({ ...s, family_info: e.target.value }))}
                className="mt-1 w-full min-h-[70px] rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-2 outline-none"
              />
            </label>

            <label className="text-sm">
              和用户的默认关系
              <textarea
                value={form.default_relationship}
                onChange={(e) => setForm((s) => ({ ...s, default_relationship: e.target.value }))}
                className="mt-1 w-full min-h-[70px] rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-2 outline-none"
              />
            </label>

            <label className="text-sm">
              禁止说的话 / 禁止做的事
              <textarea
                value={form.forbidden_patterns}
                onChange={(e) => setForm((s) => ({ ...s, forbidden_patterns: e.target.value }))}
                className="mt-1 w-full min-h-[90px] rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-2 outline-none"
              />
            </label>

            <label className="text-sm">
              示例对话（支持多行）
              <textarea
                value={form.example_dialogues}
                onChange={(e) => setForm((s) => ({ ...s, example_dialogues: e.target.value }))}
                className="mt-1 w-full min-h-[140px] rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-2 outline-none"
              />
            </label>

            <label className="text-sm">
              情绪特征
              <textarea
                value={form.emotional_traits}
                onChange={(e) => setForm((s) => ({ ...s, emotional_traits: e.target.value }))}
                className="mt-1 w-full min-h-[70px] rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-2 outline-none"
              />
            </label>

            <label className="text-sm">
              小怪癖
              <textarea
                value={form.quirks}
                onChange={(e) => setForm((s) => ({ ...s, quirks: e.target.value }))}
                className="mt-1 w-full min-h-[70px] rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-2 outline-none"
              />
            </label>

            {submitError ? (
              <div className="text-sm text-red-600 dark:text-red-400">{submitError}</div>
            ) : null}

            <div className="flex gap-3 items-center">
              <button
                type="button"
                onClick={() => void handleSubmit()}
                disabled={isSubmitting}
                className="mt-2 h-11 px-4 rounded-lg bg-zinc-900 text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-black"
              >
                {isSubmitting ? "创建中..." : "创建人设"}
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-white dark:bg-zinc-900 p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">System Prompt 预览</div>
                <div className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">
                  对应 Phase 2.2：buildSystemPrompt()
                </div>
              </div>
            </div>
            <textarea
              className="w-full min-h-[520px] rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-2 text-xs font-mono outline-none"
              value={systemPromptPreview}
              readOnly
            />
          </div>
        </div>
      </div>
    </div>
  );
}

