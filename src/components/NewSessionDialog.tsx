"use client";

import { useState, useEffect, useRef } from "react";

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
  const [importProgress, setImportProgress] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  function handleFileSelect(file: File | null) {
    if (!file) {
      setImportFile(null);
      setImportError(null);
      return;
    }

    // 验证文件
    if (!file.name.endsWith('.txt')) {
      setImportError("仅支持 .txt 格式文件");
      return;
    }

    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      setImportError("文件过大，最大支持 10MB");
      return;
    }

    setImportFile(file);
    setImportError(null);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  }

  async function handleSubmit() {
    if (!selectedCharacterId) {
      alert("请选择角色");
      return;
    }

    setIsLoading(true);
    setImportProgress(null);
    setImportError(null);

    try {
      // 保存选择到 localStorage
      localStorage.setItem(`selected_character_${personaId}`, selectedCharacterId);

      if (importFile) {
        setImportProgress("正在上传文件...");
      }

      await onCreateSession(selectedCharacterId, importFile || undefined);

      if (importFile) {
        setImportProgress("导入成功！");
      }

      onClose();
      setImportFile(null);
      setImportProgress(null);
      setImportError(null);
    } catch (error) {
      console.error("创建会话失败:", error);
      const errorMessage = error instanceof Error ? error.message : "创建会话失败";
      setImportError(errorMessage);
      alert(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }

  if (!isOpen) return null;

  if (characters.length === 0) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
        <div className="w-full max-w-md rounded-[24px] border border-[#dde8e2] bg-white p-6 shadow-2xl">
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-[28px] border border-[#dde8e2] bg-white shadow-2xl">
        {/* Header */}
        <div className="border-b border-[#e8f0ec] px-6 py-5">
          <h2 className="text-xl font-semibold text-[#173128]">创建新会话</h2>
          <p className="mt-1 text-sm text-[#66766f]">选择角色并开始对话，或导入历史记录</p>
        </div>

        {/* Content */}
        <div className="space-y-5 px-6 py-5">
          {/* Character Selection */}
          <div>
            <label className="block text-sm font-medium text-[#173128]">
              选择角色 <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedCharacterId}
              onChange={(e) => setSelectedCharacterId(e.target.value)}
              disabled={isLoading}
              className="mt-2 w-full rounded-xl border border-[#d7e6df] bg-white px-4 py-3 text-sm outline-none transition focus:border-[#2f7a5b] focus:ring-2 focus:ring-[#2f7a5b]/20 disabled:opacity-50"
            >
              {characters.map((char) => (
                <option key={char.id} value={char.id}>
                  {char.name}
                  {char.personality && ` - ${char.personality.substring(0, 30)}...`}
                </option>
              ))}
            </select>
            <a
              href="/characters"
              target="_blank"
              className="mt-2 inline-flex items-center gap-1 text-xs text-[#2f7a5b] transition hover:text-[#266349] hover:underline"
            >
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              管理角色
            </a>
          </div>

          {/* File Upload Area */}
          <div>
            <label className="block text-sm font-medium text-[#173128]">
              导入对话记录（可选）
            </label>
            <p className="mt-1 text-xs text-[#66766f]">
              支持 Line 导出的 .txt 格式，单次最多 500 条消息，文件不超过 10MB
            </p>

            {/* Drag & Drop Area */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={[
                "mt-3 cursor-pointer rounded-2xl border-2 border-dashed p-6 text-center transition",
                isDragging
                  ? "border-[#2f7a5b] bg-[#f0f8f4]"
                  : importFile
                    ? "border-[#2f7a5b] bg-[#f7fcf9]"
                    : "border-[#d7e6df] bg-[#fafcfb] hover:border-[#b7d6cb] hover:bg-[#f4f9f7]",
                isLoading && "pointer-events-none opacity-50"
              ].join(" ")}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt"
                onChange={(e) => handleFileSelect(e.target.files?.[0] || null)}
                disabled={isLoading}
                className="hidden"
              />

              {importFile ? (
                <div className="space-y-2">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#2f7a5b]/10">
                    <svg className="h-6 w-6 text-[#2f7a5b]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[#173128]">{importFile.name}</p>
                    <p className="mt-1 text-xs text-[#66766f]">
                      {(importFile.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setImportFile(null);
                      setImportError(null);
                    }}
                    disabled={isLoading}
                    className="text-xs text-[#66766f] underline hover:text-[#173128]"
                  >
                    移除文件
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#e8f0ec]">
                    <svg className="h-6 w-6 text-[#2f7a5b]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[#173128]">
                      {isDragging ? "松开以上传文件" : "点击或拖拽文件到此处"}
                    </p>
                    <p className="mt-1 text-xs text-[#66766f]">
                      支持 .txt 格式
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Progress & Error Messages */}
            {importProgress && (
              <div className="mt-3 flex items-center gap-2 rounded-xl bg-[#e8f5f0] px-4 py-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#2f7a5b] border-t-transparent" />
                <p className="text-sm text-[#2f7a5b]">{importProgress}</p>
              </div>
            )}
            {importError && (
              <div className="mt-3 flex items-center gap-2 rounded-xl bg-red-50 px-4 py-2">
                <svg className="h-4 w-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm text-red-600">{importError}</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-[#e8f0ec] px-6 py-4">
          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={isLoading}
              className="flex-1 rounded-full border border-[#d7e6df] bg-white px-4 py-3 text-sm font-medium text-[#35584a] transition hover:bg-[#f7fbf8] disabled:opacity-50"
            >
              取消
            </button>
            <button
              onClick={handleSubmit}
              disabled={isLoading || !selectedCharacterId}
              className="flex-1 rounded-full bg-[#2f7a5b] px-4 py-3 text-sm font-medium text-white transition hover:bg-[#266349] disabled:opacity-50"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  {importFile ? "导入中..." : "创建中..."}
                </span>
              ) : (
                importFile ? "导入并创建" : "创建会话"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
