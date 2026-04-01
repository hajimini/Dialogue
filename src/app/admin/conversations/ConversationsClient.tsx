"use client";

import Link from "next/link";
import { useState } from "react";

type PersonaGroup = {
  personaId: string;
  personaName: string;
  sessionCount: number;
  messageCount: number;
  lastMessageAt: string | null;
};

type ConversationRow = {
  session: {
    id: string;
    persona_id: string;
    character_id: string | null;
    status: string;
    last_message_at: string | null;
  };
  persona: { name: string } | null;
  messageCount: number;
  userMessageCount: number;
  assistantMessageCount: number;
  latestMessage: { content: string } | null;
};

type Character = {
  id: string;
  name: string;
};

function formatDate(value: string | null) {
  if (!value) return "暂无";

  try {
    return new Intl.DateTimeFormat("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export default function ConversationsClient({
  personaGroups,
  rows,
  characters,
  initialPersonaId,
  initialCharacterId,
  initialSessionId,
}: {
  personaGroups: PersonaGroup[];
  rows: ConversationRow[];
  characters: Character[];
  initialPersonaId: string | null;
  initialCharacterId: string | null;
  initialSessionId: string | null;
}) {
  const [selectedPersonaId, setSelectedPersonaId] = useState(initialPersonaId);
  const [selectedCharacterId, setSelectedCharacterId] = useState(initialCharacterId ?? "all");

  const filteredRows = rows.filter((row) => {
    if (selectedPersonaId && row.session.persona_id !== selectedPersonaId) {
      return false;
    }
    if (selectedCharacterId !== "all" && row.session.character_id !== selectedCharacterId) {
      return false;
    }
    return true;
  });

  const selectedSessionId = initialSessionId ?? filteredRows[0]?.session.id ?? null;
  const selectedRow = filteredRows.find((row) => row.session.id === selectedSessionId) ?? filteredRows[0] ?? null;

  return (
    <section className="grid gap-6 xl:grid-cols-[260px_380px_minmax(0,1fr)]">
      <aside className="rounded-[28px] border border-[#dde8e2] bg-white/88 p-4 shadow-[0_18px_50px_rgba(46,69,58,0.08)]">
        <div className="px-2 pb-4">
          <h2 className="text-lg font-semibold text-[#173127]">人设分组</h2>
          <p className="mt-1 text-sm text-[#67766f]">先按人设收束视野。</p>
        </div>

        <div className="max-h-[calc(100vh-18rem)] space-y-2 overflow-y-auto pr-1">
          {personaGroups.map((group) => {
            const active = group.personaId === selectedPersonaId;

            return (
              <button
                key={group.personaId}
                type="button"
                onClick={() => setSelectedPersonaId(group.personaId)}
                className={[
                  "block w-full rounded-[22px] border px-4 py-4 text-left transition",
                  active
                    ? "border-[#bdd7cb] bg-[#edf7f2]"
                    : "border-[#edf2ee] bg-[#fbfdfc] hover:border-[#d9e7df] hover:bg-white",
                ].join(" ")}
              >
                <div className="text-sm font-semibold text-[#183127]">
                  {group.personaName}
                </div>
                <div className="mt-2 flex flex-wrap gap-2 text-xs text-[#66766f]">
                  <span>{group.sessionCount} 个会话</span>
                  <span>{group.messageCount} 条消息</span>
                </div>
                <div className="mt-2 text-xs text-[#7a6c5d]">
                  最近更新 {formatDate(group.lastMessageAt)}
                </div>
              </button>
            );
          })}
        </div>
      </aside>

      <section className="rounded-[28px] border border-[#dde8e2] bg-white/88 p-4 shadow-[0_18px_50px_rgba(46,69,58,0.08)]">
        <div className="px-2 pb-4">
          <h2 className="text-lg font-semibold text-[#173127]">会话列表</h2>
          <p className="mt-1 text-sm text-[#67766f]">
            当前聚焦 {selectedRow?.persona?.name ?? "这个人设"} 下的最近会话。
          </p>
        </div>

        <div className="px-2 pb-4">
          <label className="block text-sm font-medium text-[#173127]">角色筛选</label>
          <select
            value={selectedCharacterId}
            onChange={(e) => setSelectedCharacterId(e.target.value)}
            className="mt-2 w-full rounded-full border border-[#d7e6df] bg-white px-4 py-2 text-sm text-[#31584a] outline-none"
          >
            <option value="all">全部角色</option>
            {characters.map((char) => (
              <option key={char.id} value={char.id}>
                {char.name}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-3 px-2 pb-4 sm:grid-cols-3">
          <div className="rounded-[20px] bg-[#f6faf8] px-4 py-3">
            <div className="text-xs text-[#71817a]">会话数</div>
            <div className="mt-2 text-xl font-semibold text-[#173127]">
              {filteredRows.length}
            </div>
          </div>
          <div className="rounded-[20px] bg-[#f6faf8] px-4 py-3">
            <div className="text-xs text-[#71817a]">活跃中</div>
            <div className="mt-2 text-xl font-semibold text-[#173127]">
              {filteredRows.filter((row) => row.session.status === "active").length}
            </div>
          </div>
          <div className="rounded-[20px] bg-[#f6faf8] px-4 py-3">
            <div className="text-xs text-[#71817a]">消息总量</div>
            <div className="mt-2 text-xl font-semibold text-[#173127]">
              {filteredRows.reduce((sum, row) => sum + row.messageCount, 0)}
            </div>
          </div>
        </div>

        <div className="max-h-[calc(100vh-30rem)] space-y-3 overflow-y-auto pr-1">
          {filteredRows.map((row) => {
            const active = row.session.id === selectedSessionId;

            return (
              <Link
                key={row.session.id}
                href={`/admin/conversations?session=${encodeURIComponent(row.session.id)}`}
                className={[
                  "block rounded-[20px] border px-4 py-4 transition",
                  active
                    ? "border-[#bdd7cb] bg-[#edf7f2]"
                    : "border-[#edf2ee] bg-[#fbfdfc] hover:border-[#d9e7df] hover:bg-white",
                ].join(" ")}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="text-sm font-semibold text-[#183127]">
                    会话 {row.session.id.slice(0, 8)}
                  </div>
                  <div className="text-xs text-[#7a6c5d]">
                    {formatDate(row.session.last_message_at)}
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-2 text-xs text-[#66766f]">
                  <span>{row.messageCount} 条消息</span>
                  <span>用户 {row.userMessageCount}</span>
                  <span>助手 {row.assistantMessageCount}</span>
                </div>
                {row.latestMessage ? (
                  <div className="mt-2 line-clamp-2 text-xs text-[#7a6c5d]">
                    {row.latestMessage.content}
                  </div>
                ) : null}
              </Link>
            );
          })}
        </div>
      </section>

      <section className="rounded-[28px] border border-[#dde8e2] bg-white/88 p-4 shadow-[0_18px_50px_rgba(46,69,58,0.08)]">
        <div className="px-2 pb-4">
          <h2 className="text-lg font-semibold text-[#173127]">会话详情</h2>
          <p className="mt-1 text-sm text-[#67766f]">
            {selectedRow ? `会话 ${selectedRow.session.id.slice(0, 8)}` : "请选择会话"}
          </p>
        </div>

        {selectedRow ? (
          <div className="space-y-4 px-2">
            <div className="rounded-[20px] bg-[#f6faf8] px-4 py-3">
              <div className="text-xs text-[#71817a]">人设</div>
              <div className="mt-1 text-sm font-medium text-[#173127]">
                {selectedRow.persona?.name ?? "未知"}
              </div>
            </div>
            <div className="rounded-[20px] bg-[#f6faf8] px-4 py-3">
              <div className="text-xs text-[#71817a]">状态</div>
              <div className="mt-1 text-sm font-medium text-[#173127]">
                {selectedRow.session.status === "active" ? "活跃" : "已归档"}
              </div>
            </div>
            <div className="rounded-[20px] bg-[#f6faf8] px-4 py-3">
              <div className="text-xs text-[#71817a]">最后更新</div>
              <div className="mt-1 text-sm font-medium text-[#173127]">
                {formatDate(selectedRow.session.last_message_at)}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex h-64 items-center justify-center text-sm text-[#72827b]">
            请从左侧选择会话
          </div>
        )}
      </section>
    </section>
  );
}
