"use client";

import { useState, useEffect } from "react";

type Character = {
  id: string;
  name: string;
  personality: string | null;
  bio: string | null;
};

type NewSessionDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  onCreateSession: (characterId: string, file?: File) => Promise<void>;
  personaId: string;
};

export default function NewSessionDialog({
  isOpen,
  onClose,
  onCreateSession,
  personaId,
}: NewSessionDialogProps) {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [selectedCharacterId, setSelectedCharacterId] = useState<string>("");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadCharacters();
    }
  }, [isOpen]);

  useEffect(() => {
    // 从 localStorage 读取上次选择的角色
    const saved = localStorage.getItem(`selected_character_${personaId}`);
    if (saved && characters.find(c => c.id === saved)) {
      setSelectedCharacterId(saved);
    } else if (characters.length > 0) {
      setSelectedCharacterId(characters[0].id);
    }
  }, [characters, personaId]);

  async function loadCharacters() {
    try {
      const response = await fetch("/api/characters");
      const json = await response.json();
      if (json.success) {
        setCharacters(json.data.characters);
      }
    } catch (error) {
      console.error("加载角色失败:", error);
    }
  }

  async function handleSubmit() {
    if (!selectedCharacterId) {
      alert("请选择角色");
      return;
    }

    setIsLoading(true);
    try {
      // 保存选择到 localStorage
      localStorage.setItem(`selected_character_${personaId}`, selectedCharacterId);

      await onCreateSession(selectedCharacterId, importFile || undefined);
      onClose();
      setImportFile(null);
    } catch (error) {
      console.error("创建会话失败:", error);
      alert(error instanceof Error ? error.message : "创建会话失败");
    } finally {
      setIsLoading(false);
    }
  }

  if (!isOpen) return null;

  if (characters.length === 0) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="w-full max-w-md rounded-[24px] border border-[#dde8e2] bg-white p-6">
          <h2 className="text-lg font-semibold text-[#173128]">创建新会话</h2>
          <p className="mt-4 text-sm text-[#66766f]">
            还没有创建角色，请先创建角色后再开始对话。
          </p>
          <div className="mt-6 flex gap-3">
            <a
              href="/characters"
              className="flex-1 rounded-full bg-[#2f7a5b] px-4 py-2 text-center text-sm font-medium text-white transition hover:bg-[#266349]"
            >
              去创建角色
            </a>
            <button
              onClick={onClose}
              className="flex-1 rounded-full border border-[#d7e6df] bg-white px-4 py-2 text-sm font-medium text-[#35584a] transition hover:bg-[#f7fbf8]"
            >
              取消
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-[24px] border border-[#dde8e2] bg-white p-6">
        <h2 className="text-lg font-semibold text-[#173128]">创建新会话</h2>

        <div className="mt-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#173128]">
              选择角色 *
            </label>
            <select
              value={selectedCharacterId}
              onChange={(e) => setSelectedCharacterId(e.target.value)}
              className="mt-2 w-full rounded-xl border border-[#d7e6df] bg-white px-3 py-2 text-sm outline-none"
            >
              {characters.map((char) => (
                <option key={char.id} value={char.id}>
                  {char.name}
                  {char.personality && ` - ${char.personality.substring(0, 20)}...`}
                </option>
              ))}
            </select>
            <a
              href="/characters"
              target="_blank"
              className="mt-1 inline-block text-xs text-[#2f7a5b] hover:underline"
            >
              管理角色
            </a>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#173128]">
              导入对话记录（可选）
            </label>
            <p className="mt-1 text-xs text-[#66766f]">
              支持 Line 导出的 .txt 格式
            </p>
            <input
              type="file"
              accept=".txt"
              onChange={(e) => setImportFile(e.target.files?.[0] || null)}
              className="mt-2 w-full text-sm"
            />
            {importFile && (
              <p className="mt-1 text-xs text-[#2f7a5b]">
                已选择: {importFile.name}
              </p>
            )}
          </div>
        </div>

        <div className="mt-6 flex gap-3">
          <button
            onClick={handleSubmit}
            disabled={isLoading || !selectedCharacterId}
            className="flex-1 rounded-full bg-[#2f7a5b] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#266349] disabled:opacity-50"
          >
            {isLoading ? "创建中..." : importFile ? "导入并创建" : "创建会话"}
          </button>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 rounded-full border border-[#d7e6df] bg-white px-4 py-2 text-sm font-medium text-[#35584a] transition hover:bg-[#f7fbf8] disabled:opacity-50"
          >
            取消
          </button>
        </div>
      </div>
    </div>
  );
}
