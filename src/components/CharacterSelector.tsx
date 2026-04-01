"use client";

import { useState, useEffect } from "react";

type Character = {
  id: string;
  name: string;
  personality: string | null;
  bio: string | null;
};

type CharacterSelectorProps = {
  personaId: string;
  personaName: string;
  onCharacterChange?: (characterId: string) => void;
};

export default function CharacterSelector({
  personaId,
  personaName,
  onCharacterChange,
}: CharacterSelectorProps) {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [selectedCharacterId, setSelectedCharacterId] = useState<string>("");
  const [showImport, setShowImport] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);

  useEffect(() => {
    loadCharacters();
  }, []);

  useEffect(() => {
    // 从 localStorage 读取上次选择的角色
    const saved = localStorage.getItem(`selected_character_${personaId}`);
    if (saved && characters.find(c => c.id === saved)) {
      setSelectedCharacterId(saved);
      onCharacterChange?.(saved);
    } else if (characters.length > 0) {
      setSelectedCharacterId(characters[0].id);
      onCharacterChange?.(characters[0].id);
    }
  }, [characters, personaId, onCharacterChange]);

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

  function handleCharacterChange(characterId: string) {
    setSelectedCharacterId(characterId);
    localStorage.setItem(`selected_character_${personaId}`, characterId);
    onCharacterChange?.(characterId);
    // 刷新页面以使用新角色
    window.location.reload();
  }

  async function handleImport() {
    if (!importFile || !selectedCharacterId) {
      alert("请选择文件和角色");
      return;
    }

    setIsImporting(true);
    try {
      const formData = new FormData();
      formData.append("file", importFile);
      formData.append("personaId", personaId);
      formData.append("characterId", selectedCharacterId);
      formData.append("personaName", personaName);

      const response = await fetch("/api/chat/import", {
        method: "POST",
        body: formData,
      });

      const json = await response.json();
      if (json.success) {
        alert(`成功导入 ${json.data.message_count} 条消息`);
        setShowImport(false);
        setImportFile(null);
        // 跳转到新会话
        window.location.href = `/chat/${personaId}?session=${json.data.session_id}`;
      } else {
        alert(json.error?.message || "导入失败");
      }
    } catch (error) {
      console.error("导入失败:", error);
      alert("导入失败");
    } finally {
      setIsImporting(false);
    }
  }

  if (characters.length === 0) {
    return (
      <div className="rounded-2xl border border-[#dde8e2] bg-white/90 p-4">
        <p className="text-sm text-[#66766f]">
          还没有创建角色，
          <a href="/characters" className="text-[#2f7a5b] hover:underline">
            点击创建
          </a>
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-[#dde8e2] bg-white/90 p-4">
        <label className="block text-sm font-medium text-[#173128]">
          当前角色
        </label>
        <select
          value={selectedCharacterId}
          onChange={(e) => handleCharacterChange(e.target.value)}
          className="mt-2 w-full rounded-xl border border-[#d7e6df] bg-white px-3 py-2 text-sm outline-none"
        >
          {characters.map((char) => (
            <option key={char.id} value={char.id}>
              {char.name}
              {char.personality && ` - ${char.personality.substring(0, 20)}...`}
            </option>
          ))}
        </select>
        <div className="mt-2 flex gap-2">
          <a
            href="/characters"
            className="text-xs text-[#2f7a5b] hover:underline"
          >
            管理角色
          </a>
          <button
            onClick={() => setShowImport(!showImport)}
            className="text-xs text-[#2f7a5b] hover:underline"
          >
            {showImport ? "取消导入" : "导入对话"}
          </button>
        </div>
      </div>

      {showImport && (
        <div className="rounded-2xl border border-[#dde8e2] bg-white/90 p-4">
          <h3 className="text-sm font-medium text-[#173128]">导入 Line 对话记录</h3>
          <p className="mt-1 text-xs text-[#66766f]">
            支持 Line 导出的 .txt 格式对话记录
          </p>
          <input
            type="file"
            accept=".txt"
            onChange={(e) => setImportFile(e.target.files?.[0] || null)}
            className="mt-3 w-full text-sm"
          />
          <button
            onClick={handleImport}
            disabled={!importFile || isImporting}
            className="mt-3 w-full rounded-xl bg-[#2f7a5b] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#266349] disabled:opacity-50"
          >
            {isImporting ? "导入中..." : "开始导入"}
          </button>
        </div>
      )}
    </div>
  );
}
