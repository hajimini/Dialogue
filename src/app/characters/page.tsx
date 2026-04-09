"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type Character = {
  id: string;
  name: string;
  personality: string | null;
  avatar_url: string | null;
  bio: string | null;
  created_at: string;
};

function CharactersPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [characters, setCharacters] = useState<Character[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    personality: "",
    bio: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadCharacters();
  }, []);

  async function loadCharacters() {
    try {
      const response = await fetch("/api/characters");
      const json = await response.json();
      if (json.success) {
        setCharacters(json.data.characters);
      }
    } catch (error) {
      console.error("加载角色失败:", error);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCreate() {
    if (!formData.name.trim()) {
      alert("请输入角色名称");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/characters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const json = await response.json();
      if (json.success) {
        setFormData({ name: "", personality: "", bio: "" });
        setShowCreateForm(false);
        await loadCharacters();
      } else {
        alert(json.error?.message || "创建失败");
      }
    } catch (error) {
      console.error("创建角色失败:", error);
      alert("创建失败");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("确定要删除这个角色吗？相关的对话记录将被保留但无法访问。")) {
      return;
    }

    try {
      const response = await fetch(`/api/characters?id=${id}`, {
        method: "DELETE",
      });

      const json = await response.json();
      if (json.success) {
        await loadCharacters();
      } else {
        alert(json.error?.message || "删除失败");
      }
    } catch (error) {
      console.error("删除角色失败:", error);
      alert("删除失败");
    }
  }

  function handleSelectCharacter(characterId: string) {
    const personaId = searchParams.get("personaId")?.trim();
    const returnTo = searchParams.get("returnTo")?.trim();

    if (personaId) {
      localStorage.setItem(`selected_character_${personaId}`, characterId);
    }

    if (returnTo && returnTo.startsWith("/")) {
      localStorage.setItem("selected_character_id", characterId);
      router.push(returnTo);
      return;
    }

    if (personaId) {
      localStorage.setItem("selected_character_id", characterId);
      router.push(`/chat/${personaId}?newSession=1`);
      return;
    }
    // 保存选中的角色到 localStorage
    localStorage.setItem("selected_character_id", characterId);
    // 返回上一页或跳转到首页
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push("/");
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#fdfcfa]">
        <div className="text-sm text-[#6d6257]">加载中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fdfcfa] px-6 py-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold text-[#173128]">我的角色</h1>
          <p className="mt-2 text-sm text-[#66766f]">
            创建不同的虚拟角色，每个角色拥有独立的对话记忆和人格特征。与 AI 人设进行一对一角色对话时，系统会根据当前角色维护专属的记忆和画像。
          </p>
        </div>

        <div className="mb-6 flex gap-3">
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="rounded-full bg-[#2f7a5b] px-6 py-3 text-sm font-medium text-white transition hover:bg-[#266349]"
          >
            {showCreateForm ? "取消" : "+ 创建新角色"}
          </button>
          <button
            onClick={() => {
              if (window.history.length > 1) {
                router.back();
              } else {
                router.push("/");
              }
            }}
            className="rounded-full border border-[#d7e6df] bg-white px-6 py-3 text-sm font-medium text-[#35584a] transition hover:bg-[#f7fbf8]"
          >
            返回
          </button>
        </div>

        {showCreateForm && (
          <div className="mb-6 rounded-[24px] border border-[#dde8e2] bg-white p-6">
            <h2 className="mb-4 text-lg font-semibold text-[#173128]">创建新角色</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#173128]">
                  角色名称 *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="例如：开朗的小明"
                  className="mt-1 w-full rounded-2xl border border-[#d7e6df] bg-white px-4 py-3 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#173128]">
                  人格描述
                </label>
                <textarea
                  value={formData.personality}
                  onChange={(e) => setFormData({ ...formData, personality: e.target.value })}
                  placeholder="例如：性格开朗外向，喜欢交朋友，对新事物充满好奇"
                  rows={3}
                  className="mt-1 w-full rounded-2xl border border-[#d7e6df] bg-white px-4 py-3 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#173128]">
                  角色简介
                </label>
                <textarea
                  value={formData.bio}
                  onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                  placeholder="例如：25岁，互联网公司产品经理，喜欢旅游和摄影"
                  rows={2}
                  className="mt-1 w-full rounded-2xl border border-[#d7e6df] bg-white px-4 py-3 outline-none"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleCreate}
                  disabled={isSubmitting}
                  className="rounded-full bg-[#2f7a5b] px-6 py-2 text-sm font-medium text-white transition hover:bg-[#266349] disabled:opacity-50"
                >
                  {isSubmitting ? "创建中..." : "创建"}
                </button>
                <button
                  onClick={() => setShowCreateForm(false)}
                  className="rounded-full border border-[#d7e6df] bg-white px-6 py-2 text-sm font-medium text-[#35584a] transition hover:bg-[#f7fbf8]"
                >
                  取消
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          {characters.map((character) => (
            <div
              key={character.id}
              className="rounded-[24px] border border-[#dde8e2] bg-white p-6 transition hover:shadow-lg"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-[#173128]">
                    {character.name}
                  </h3>
                  {character.personality && (
                    <p className="mt-2 text-sm text-[#66766f]">
                      {character.personality}
                    </p>
                  )}
                  {character.bio && (
                    <p className="mt-2 text-xs text-[#8a9a92]">{character.bio}</p>
                  )}
                  <p className="mt-3 text-xs text-[#a0b0a8]">
                    创建于 {new Date(character.created_at).toLocaleDateString("zh-CN")}
                  </p>
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => handleSelectCharacter(character.id)}
                  className="flex-1 rounded-full bg-[#2f7a5b] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#266349]"
                >
                  选择此角色
                </button>
                <button
                  onClick={() => handleDelete(character.id)}
                  className="rounded-full border border-[#ef4444] px-4 py-2 text-sm font-medium text-[#ef4444] transition hover:bg-[#fef2f2]"
                >
                  删除
                </button>
              </div>
            </div>
          ))}
        </div>

        {characters.length === 0 && !showCreateForm && (
          <div className="rounded-[24px] border border-dashed border-[#d9e4de] bg-[#fbfdfc] px-6 py-12 text-center">
            <p className="text-sm text-[#72827b]">
              还没有创建角色，点击上方按钮创建第一个角色
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function CharactersPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#fdfcfa]">
          <div className="text-sm text-[#6d6257]">加载中...</div>
        </div>
      }
    >
      <CharactersPageContent />
    </Suspense>
  );
}
