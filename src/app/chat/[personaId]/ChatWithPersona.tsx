"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  MemoryContextPanel,
  type MemoryContextItem,
} from "@/components/MemoryContextPanel";
import NewSessionDialog from "@/components/NewSessionDialog";
import type { SessionListItem } from "@/lib/chat/sessions";
import type { AppUserRecord, MessageRecord, Persona } from "@/lib/supabase/types";

type PersonaListItem = {
  id: string;
  name: string;
  avatar_url: string | null;
  occupation: string | null;
  city: string | null;
  is_active: boolean;
  created_at: string | null;
};

type ChatRole = "user" | "assistant";
type FeedbackValue = "up" | "down";

type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: number;
  persisted: boolean;
  memoryContext?: {
    memories: MemoryContextItem[];
    userProfile: string | null;
  };
};

type SessionMemoryContext = {
  memories: MemoryContextItem[];
  userProfile: string | null;
};

const DOWN_REASONS = ["太像 AI", "答非所问", "忘了之前的事", "太长了"] as const;

function newId() {
  return globalThis.crypto?.randomUUID?.() ?? String(Math.random());
}

function toChatMessages(records: MessageRecord[]) {
  return records.map((record) => ({
    id: record.id,
    role: record.role,
    content: record.content,
    createdAt: record.created_at ? new Date(record.created_at).getTime() : Date.now(),
    persisted: true,
  }));
}

function formatTime(timestamp: number) {
  try {
    return new Intl.DateTimeFormat("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(timestamp));
  } catch {
    return "";
  }
}

function formatDate(iso: string | null) {
  if (!iso) return "";

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";

  try {
    return new Intl.DateTimeFormat("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  } catch {
    return "";
  }
}

function personaSubtitle(persona: { occupation: string | null; city: string | null }) {
  const parts = [persona.occupation, persona.city].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : "信息待补充";
}

function sortSessions(sessions: SessionListItem[]) {
  return [...sessions].sort((left, right) => {
    const leftTime = left.last_message_at ? new Date(left.last_message_at).getTime() : 0;
    const rightTime = right.last_message_at ? new Date(right.last_message_at).getTime() : 0;
    return rightTime - leftTime;
  });
}

export default function ChatWithPersona({
  persona,
  personas,
  viewer,
  initialSessionId,
  initialSessions,
  initialMessages,
  characters,
  requiresCharacterSelection,
}: {
  persona: Persona;
  personas: PersonaListItem[];
  viewer: AppUserRecord;
  initialSessionId: string;
  initialSessions: SessionListItem[];
  initialMessages: MessageRecord[];
  characters: Array<{ id: string; name: string }>;
  requiresCharacterSelection: boolean;
}) {
  const [currentSessionId, setCurrentSessionId] = useState(initialSessionId);
  const [sessions, setSessions] = useState<SessionListItem[]>(sortSessions(initialSessions));
  const [messages, setMessages] = useState<ChatMessage[]>(toChatMessages(initialMessages));
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSwitchingSession, setIsSwitchingSession] = useState(false);
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [isDeletingSessionId, setIsDeletingSessionId] = useState<string | null>(null);
  const [isClearingSessions, setIsClearingSessions] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [feedbackMap, setFeedbackMap] = useState<Record<string, FeedbackValue>>({});
  const [pendingDownvoteFor, setPendingDownvoteFor] = useState<string | null>(null);
  const [submittingFeedbackFor, setSubmittingFeedbackFor] = useState<string | null>(null);
  const [submittingMemoryFeedbackId, setSubmittingMemoryFeedbackId] = useState<string | null>(
    null,
  );

  const [showAllSessions, setShowAllSessions] = useState(false);
  const [showNewSessionDialog, setShowNewSessionDialog] = useState(requiresCharacterSelection);
  const [sessionMemoryContext, setSessionMemoryContext] = useState<SessionMemoryContext | null>(
    null,
  );
  const [memoryGenerationStatus, setMemoryGenerationStatus] = useState<string | null>(null);

  const listEndRef = useRef<HTMLDivElement | null>(null);
  const pathname = usePathname();
  const memoryStatusCheckRef = useRef<NodeJS.Timeout | null>(null);

  const userMessageCount = useMemo(
    () => messages.filter((message) => message.role === "user").length,
    [messages],
  );

  const canSend = useMemo(
    () => input.trim().length > 0 && !isSwitchingSession,
    [input, isSwitchingSession],
  );
  const latestMemoryContext = useMemo(() => {
    const reversed = [...messages].reverse();
    return reversed.find((message) => message.memoryContext)?.memoryContext ?? sessionMemoryContext;
  }, [messages, sessionMemoryContext]);

  async function refreshSessionList() {
    const response = await fetch(`/api/personas/${persona.id}/sessions`);
    const json = (await response.json()) as {
      success: boolean;
      data: SessionListItem[] | null;
      error: { message: string } | null;
    };

    if (!json.success || !json.data) {
      throw new Error(json.error?.message || "刷新会话列表失败");
    }

    setSessions(sortSessions(json.data));
  }

  async function loadSessionMessages(sessionId: string) {
    const response = await fetch(`/api/sessions/${sessionId}/messages`);
    const json = (await response.json()) as {
      success: boolean;
      data: MessageRecord[] | null;
      error: { message: string } | null;
    };

    if (!json.success || !json.data) {
      throw new Error(json.error?.message || "读取会话消息失败");
    }

    setCurrentSessionId(sessionId);
    setMessages(toChatMessages(json.data));
    setInput("");
  }

  async function loadSessionMemoryContext(sessionId: string, signal?: AbortSignal) {
    const response = await fetch(`/api/sessions/${sessionId}/memory-context`, {
      cache: "no-store",
      signal,
    });
    const json = (await response.json()) as {
      success: boolean;
      data:
        | {
            memories: MemoryContextItem[];
            user_profile: string | null;
          }
        | null;
      error: { message: string } | null;
    };

    if (!json.success || !json.data) {
      throw new Error(json.error?.message || "读取记忆上下文失败");
    }

    setSessionMemoryContext({
      memories: json.data.memories,
      userProfile: json.data.user_profile,
    });

    // 如果记忆为空，检查是否正在生成
    if (json.data.memories.length === 0) {
      checkMemoryGenerationStatus(sessionId);
    }
  }

  async function checkMemoryGenerationStatus(sessionId: string) {
    try {
      const response = await fetch(`/api/sessions/${sessionId}/memory-status`);
      const json = (await response.json()) as {
        success: boolean;
        data: {
          memoryCount: number;
          isComplete: boolean;
          estimatedTimeRemaining: number;
        } | null;
      };

      if (json.success && json.data) {
        if (!json.data.isComplete) {
          setMemoryGenerationStatus("记忆正在生成中，请稍候...");

          // 轮询检查状态
          if (memoryStatusCheckRef.current) {
            clearTimeout(memoryStatusCheckRef.current);
          }

          memoryStatusCheckRef.current = setTimeout(() => {
            void loadSessionMemoryContext(sessionId);
          }, 3000); // 3秒后重新检查
        } else if (json.data.memoryCount === 0) {
          setMemoryGenerationStatus("该会话暂无记忆");
        } else {
          setMemoryGenerationStatus(null);
        }
      }
    } catch (error) {
      console.error("检查记忆生成状态失败:", error);
    }
  }

  async function handleSelectSession(sessionId: string) {
    if (
      sessionId === currentSessionId ||
      isLoading ||
      isSwitchingSession ||
      Boolean(isDeletingSessionId) ||
      isClearingSessions
    ) {
      return;
    }

    setErrorText(null);
    setPendingDownvoteFor(null);
    setIsSwitchingSession(true);

    try {
      await loadSessionMessages(sessionId);
    } catch (error) {
      const message = error instanceof Error ? error.message : "切换会话时发生未知错误";
      setErrorText(message);
    } finally {
      setIsSwitchingSession(false);
    }
  }

  async function handleCreateSession(characterId: string, file?: File) {
    if (
      isCreatingSession ||
      isLoading ||
      isSwitchingSession ||
      Boolean(isDeletingSessionId) ||
      isClearingSessions
    ) {
      return;
    }

    setErrorText(null);
    setPendingDownvoteFor(null);
    setIsCreatingSession(true);

    try {
      // If file is provided, use import API
      if (file) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("personaId", persona.id);
        formData.append("characterId", characterId);
        formData.append("personaName", persona.name);

        const response = await fetch("/api/chat/import", {
          method: "POST",
          body: formData,
        });

        const json = (await response.json()) as {
          success: boolean;
          data: {
            session_id: string;
            message_count: number;
            stats?: {
              totalImported: number;
              memoryGenerated: boolean;
              profileUpdated: boolean;
            };
            note?: string;
          } | null;
          error: { message: string } | null;
        };

        if (!json.success || !json.data) {
          throw new Error(json.error?.message || "导入对话失败");
        }

        // 显示导入结果
        if (json.data.note) {
          console.log(`[Import] ${json.data.note}`);
        }

        // Load the imported session
        await loadSessionMessages(json.data.session_id);
        await refreshSessionList();

        // 显示成功提示
        setErrorText(null);
      } else {
        // Normal session creation
        const response = await fetch(`/api/personas/${persona.id}/sessions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ character_id: characterId }),
        });
        const json = (await response.json()) as {
          success: boolean;
          data: SessionListItem | null;
          error: { message: string } | null;
        };

        if (!json.success || !json.data) {
          throw new Error(json.error?.message || "创建新会话失败");
        }

        const newSession = json.data;
        setCurrentSessionId(newSession.id);
        setMessages([]);
        setInput("");
        setSessionMemoryContext(null);
        setSessions((current) => sortSessions([newSession, ...current]));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "创建会话时发生未知错误";
      setErrorText(message);
    } finally {
      setIsCreatingSession(false);
    }
  }

  async function handleDeleteSession(sessionId: string) {
    if (
      isLoading ||
      isSwitchingSession ||
      isCreatingSession ||
      Boolean(isDeletingSessionId) ||
      isClearingSessions
    ) {
      return;
    }

    setErrorText(null);
    setPendingDownvoteFor(null);
    setIsDeletingSessionId(sessionId);

    try {
      const response = await fetch(`/api/sessions/${sessionId}`, {
        method: "DELETE",
      });
      const json = (await response.json()) as {
        success: boolean;
        error: { message: string } | null;
      };

      if (!json.success) {
        throw new Error(json.error?.message || "删除会话失败");
      }

      const nextSessions = sessions.filter((session) => session.id !== sessionId);
      setSessions(nextSessions);

      if (sessionId === currentSessionId) {
        if (nextSessions[0]) {
          await loadSessionMessages(nextSessions[0].id);
        } else {
          setCurrentSessionId("");
          setMessages([]);
          setInput("");
          setSessionMemoryContext(null);
          setShowNewSessionDialog(true);
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "删除会话时发生未知错误";
      setErrorText(message);
    } finally {
      setIsDeletingSessionId(null);
    }
  }

  async function handleClearSessions() {
    if (
      isLoading ||
      isSwitchingSession ||
      isCreatingSession ||
      Boolean(isDeletingSessionId) ||
      isClearingSessions ||
      sessions.length === 0
    ) {
      return;
    }

    const confirmed = window.confirm("确认清空当前人设的全部历史会话吗？");
    if (!confirmed) return;

    setErrorText(null);
    setPendingDownvoteFor(null);
    setIsClearingSessions(true);

    try {
      const response = await fetch(`/api/personas/${persona.id}/sessions`, {
        method: "DELETE",
      });
      const json = (await response.json()) as {
        success: boolean;
        error: { message: string } | null;
      };

      if (!json.success) {
        throw new Error(json.error?.message || "清空历史会话失败");
      }

      setSessions([]);
      setMessages([]);
      setCurrentSessionId("");
      setInput("");
      setSessionMemoryContext(null);
      setShowNewSessionDialog(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : "清空历史会话时发生未知错误";
      setErrorText(message);
    } finally {
      setIsClearingSessions(false);
    }
  }

  const handleInputChange = useCallback((event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(event.target.value);
  }, []);

  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void handleSend();
    }
  }, [handleSend]);

  async function handleSend() {
    const text = input.trim();
    if (!text || !currentSessionId || isSwitchingSession) return;

    setErrorText(null);
    setPendingDownvoteFor(null);

    const optimisticUserMessage: ChatMessage = {
      id: newId(),
      role: "user",
      content: text,
      createdAt: Date.now(),
      persisted: false,
    };

    setMessages((current) => [...current, optimisticUserMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          persona_id: persona.id,
          session_id: currentSessionId,
          message: text,
        }),
      });

      const json = (await response.json()) as {
        success: boolean;
        data:
          | {
              reply: string;
              session_id: string;
              assistant_message: MessageRecord;
              memory_context?: {
                memories: MemoryContextItem[];
                user_profile: string | null;
              };
            }
          | null;
        error: { message: string } | null;
      };

      if (!json.success || !json.data) {
        throw new Error(json.error?.message || "聊天请求失败");
      }

      const data = json.data;

      setCurrentSessionId(data.session_id);
      setSessionMemoryContext(
        data.memory_context
          ? {
              memories: data.memory_context.memories,
              userProfile: data.memory_context.user_profile,
            }
          : null,
      );
      setMessages((current) => [
        ...current,
        {
          id: data.assistant_message.id,
          role: "assistant",
          content: data.assistant_message.content,
          createdAt: data.assistant_message.created_at
            ? new Date(data.assistant_message.created_at).getTime()
            : Date.now(),
          persisted: true,
          memoryContext: data.memory_context
            ? {
                memories: data.memory_context.memories,
                userProfile: data.memory_context.user_profile,
              }
            : undefined,
        },
      ]);

      await refreshSessionList();
    } catch (error) {
      const message = error instanceof Error ? error.message : "聊天请求发生未知错误";

      // 移除乐观插入的用户消息，避免刷新后消失造成困惑
      setMessages((current) => [
        ...current.filter((m) => m.id !== optimisticUserMessage.id),
        {
          id: newId(),
          role: "assistant",
          content: `抱歉，当前暂时没法给你完整回复：${message}`,
          createdAt: Date.now(),
          persisted: false,
        },
      ]);
      setErrorText(message);
    } finally {
      setIsLoading(false);
    }
  }

  async function submitMemoryFeedback(memoryId: string) {
    if (submittingMemoryFeedbackId === memoryId) return;

    setSubmittingMemoryFeedbackId(memoryId);
    setErrorText(null);

    try {
      const response = await fetch("/api/memories/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memory_id: memoryId,
          feedback_type: "inaccurate",
          feedback_reason: "chat-memory-panel",
        }),
      });
      const json = (await response.json()) as {
        success: boolean;
        error: { message: string } | null;
      };

      if (!json.success) {
        throw new Error(json.error?.message || "提交记忆反馈失败");
      }

      setMessages((current) =>
        current.map((message) => {
          if (!message.memoryContext) return message;

          return {
            ...message,
            memoryContext: {
              ...message.memoryContext,
              memories: message.memoryContext.memories.filter((item) => item.id !== memoryId),
            },
          };
        }),
      );
      setSessionMemoryContext((current) =>
        current
          ? {
              ...current,
              memories: current.memories.filter((item) => item.id !== memoryId),
            }
          : current,
      );
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "提交记忆反馈失败");
    } finally {
      setSubmittingMemoryFeedbackId(null);
    }
  }

  async function submitFeedback(
    messageId: string,
    feedbackType: FeedbackValue,
    feedbackReason?: string,
  ) {
    if (submittingFeedbackFor === messageId) return;

    setSubmittingFeedbackFor(messageId);

    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          persona_id: persona.id,
          session_id: currentSessionId,
          message_id: messageId,
          feedback_type: feedbackType,
          feedback_reason: feedbackReason ?? null,
        }),
      });
      const json = (await response.json()) as {
        success: boolean;
        error: { message: string } | null;
      };

      if (!json.success) {
        throw new Error(json.error?.message || "提交反馈失败");
      }

      setFeedbackMap((current) => ({
        ...current,
        [messageId]: feedbackType,
      }));
      setPendingDownvoteFor(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "提交反馈时发生未知错误";
      setErrorText(message);
    } finally {
      setSubmittingFeedbackFor(null);
    }
  }

  useEffect(() => {
    if (requiresCharacterSelection && !currentSessionId && sessions.length === 0) {
      setShowNewSessionDialog(true);
    }
  }, [currentSessionId, requiresCharacterSelection, sessions.length]);

  useEffect(() => {
    if (!currentSessionId) {
      setSessionMemoryContext(null);
      setMemoryGenerationStatus(null);

      // 清理定时器
      if (memoryStatusCheckRef.current) {
        clearTimeout(memoryStatusCheckRef.current);
        memoryStatusCheckRef.current = null;
      }

      return;
    }

    const controller = new AbortController();
    let cancelled = false;

    void loadSessionMemoryContext(currentSessionId, controller.signal)
      .catch((error) => {
        if (controller.signal.aborted) {
          return;
        }
        if (!cancelled) {
          console.warn("[ChatWithPersona] Failed to load session memory context:", error);
          setSessionMemoryContext(null);
        }
      });

    return () => {
      cancelled = true;
      controller.abort();

      // 清理定时器
      if (memoryStatusCheckRef.current) {
        clearTimeout(memoryStatusCheckRef.current);
        memoryStatusCheckRef.current = null;
      }
    };
  }, [currentSessionId]);

  useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isLoading, isSwitchingSession, pendingDownvoteFor]);

  useEffect(() => {
    if (!currentSessionId || typeof window === "undefined") return;

    const url = new URL(window.location.href);
    if (url.pathname !== pathname) {
      url.pathname = pathname;
    }

    if (url.searchParams.get("session") === currentSessionId) return;

    url.searchParams.set("session", currentSessionId);
    window.history.replaceState(window.history.state, "", url);
  }, [currentSessionId, pathname]);

  return (
    <div className="h-[100dvh] w-full overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(78,160,128,0.18),_transparent_28%),linear-gradient(135deg,_#edf7f2,_#fbfffd)] text-[#0b141a]">
      <div className="flex h-full gap-4 p-4">
        <aside className="flex w-80 shrink-0 flex-col overflow-hidden rounded-[30px] bg-[#184f46] text-white shadow-[0_30px_80px_rgba(10,42,33,0.32)]">
          <div className="border-b border-white/10 px-5 py-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-[0.24em] text-white/60">
                  Companion
                </div>
                <div className="mt-2 text-xl font-semibold">陪伴对话工作台</div>
              </div>
              <div className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[11px]">
                {viewer.role === "admin" ? "Admin" : "User"}
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-white/10 bg-white/10 p-3 text-sm text-white/80">
              <div className="font-medium text-white">{viewer.nickname}</div>
              <div className="mt-1 text-xs text-white/65">{viewer.email}</div>
            </div>

            {/* 当前角色显示 */}
            <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 p-3">
              <div className="text-xs text-white/60">当前角色</div>
              <div className="mt-1 text-sm font-medium text-white">
                {(() => {
                  const charId = sessions.find((s) => s.id === currentSessionId)?.character_id;
                  if (!charId) return "无";
                  return characters.find((c) => c.id === charId)?.name || charId.slice(0, 8);
                })()}
              </div>
              <a
                href="/characters"
                className="mt-2 inline-block text-xs text-white/70 hover:text-white hover:underline"
              >
                切换角色
              </a>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 px-4 pb-3 pt-4">
            {viewer.role === "admin" ? (
              <Link
                href="/admin/dashboard"
                className="rounded-full border border-white/10 bg-white/10 px-3 py-2 text-xs transition-colors hover:bg-white/15"
              >
                管理后台
              </Link>
            ) : null}
            <Link
              href="/memories"
              className="rounded-full border border-white/10 bg-white/10 px-3 py-2 text-xs transition-colors hover:bg-white/15"
            >
              我的记忆
            </Link>
            <button
              type="button"
              onClick={() => setShowNewSessionDialog(true)}
              disabled={
                isCreatingSession ||
                isLoading ||
                isSwitchingSession ||
                Boolean(isDeletingSessionId) ||
                isClearingSessions ||
                characters.length === 0
              }
              className="rounded-full border border-white/10 bg-white/10 px-3 py-2 text-xs transition-colors hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isCreatingSession ? "创建中..." : "新会话"}
            </button>
            <button
              type="button"
              onClick={() => void handleClearSessions()}
              disabled={
                sessions.length === 0 ||
                isCreatingSession ||
                isLoading ||
                isSwitchingSession ||
                Boolean(isDeletingSessionId) ||
                isClearingSessions
              }
              className="rounded-full border border-white/10 bg-white/10 px-3 py-2 text-xs transition-colors hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isClearingSessions ? "清空中..." : "清空历史"}
            </button>
            <form action="/api/auth/logout" method="post">
              <button
                type="submit"
                className="rounded-full border border-white/10 bg-white/10 px-3 py-2 text-xs transition-colors hover:bg-white/15"
              >
                退出登录
              </button>
            </form>
          </div>

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="px-4 pb-2 pt-0 text-sm font-medium text-white/90">历史会话</div>

            <div className="shrink-0 space-y-2 overflow-y-auto px-3 pb-4" style={{ maxHeight: '35%' }}>
              {sessions.slice(0, showAllSessions ? sessions.length : 8).map((session, index) => {
              const active = session.id === currentSessionId;

              return (
                <div
                  key={session.id}
                  className={[
                    "w-full rounded-2xl border px-3 py-3 text-left transition-colors",
                    active
                      ? "border-white/25 bg-[#256658]"
                      : "border-white/10 bg-white/[0.08] hover:bg-white/[0.12]",
                  ].join(" ")}
                >
                  <div className="flex items-start justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => void handleSelectSession(session.id)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-sm font-semibold">会话 {index + 1}</div>
                        <div className="text-[11px] text-white/70">
                          {session.status === "active" ? "进行中" : session.status}
                        </div>
                      </div>
                      <div className="mt-1 text-xs text-white/75">
                        {formatDate(session.last_message_at || session.started_at) || "刚创建"}
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDeleteSession(session.id)}
                      disabled={
                        isLoading ||
                        isSwitchingSession ||
                        isCreatingSession ||
                        Boolean(isDeletingSessionId) ||
                        isClearingSessions
                      }
                      className="shrink-0 rounded-full border border-white/10 bg-white/10 px-2 py-1 text-[11px] text-white/75 transition-colors hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50"
                      aria-label="删除会话"
                    >
                      {isDeletingSessionId === session.id ? "..." : "删"}
                    </button>
                  </div>
                </div>
              );
            })}
            {sessions.length > 8 ? (
              <button
                type="button"
                onClick={() => setShowAllSessions((v) => !v)}
                className="w-full rounded-2xl border border-white/10 bg-white/[0.06] px-3 py-2 text-center text-xs text-white/60 transition-colors hover:bg-white/[0.10]"
              >
                {showAllSessions ? "收起" : `查看全部 ${sessions.length} 个会话`}
              </button>
            ) : null}
          </div>

          <div className="px-4 pb-2 text-sm font-medium text-white/90">人设列表</div>

          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 pb-4">
            {personas.map((item, index) => {
              const active = item.id === persona.id;

              return (
                <Link
                  key={item.id}
                  href={`/chat/${item.id}`}
                  className={[
                    "block rounded-2xl border px-3 py-3 transition-colors",
                    active
                      ? "border-white/25 bg-[#256658]"
                      : "border-white/10 bg-white/[0.08] hover:bg-white/[0.12]",
                  ].join(" ")}
                >
                  <div className="flex items-center gap-3">
                    {item.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.avatar_url}
                        alt={item.name}
                        className="h-10 w-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-sm">
                        {item.name.slice(0, 1)}
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="truncate font-semibold">{item.name}</div>
                        <div className="shrink-0 text-xs opacity-80">{index + 1}</div>
                      </div>
                      <div className="truncate text-xs text-white/80">
                        {personaSubtitle(item)}
                      </div>
                      <div className="mt-1 text-[11px] text-white/70">
                        {formatDate(item.created_at) || "刚创建"}
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
        </aside>

        <section className="relative flex flex-1 flex-col overflow-hidden rounded-[30px] border border-[#d7ebe2] bg-white/75 shadow-[0_25px_60px_rgba(36,79,64,0.12)] backdrop-blur">
          <header className="flex h-16 items-center justify-between border-b border-[#d2e6de] bg-[linear-gradient(135deg,_rgba(218,238,229,0.92),_rgba(244,250,247,0.92))] px-5">
            <div className="min-w-0">
              <div className="truncate text-lg font-semibold">{persona.name} · 人设对话</div>
              <div className="mt-1 truncate text-xs text-[#406658]">
                当前会话 {messages.length} 条消息，其中你的发言 {userMessageCount} 条
              </div>
            </div>
            <div className="rounded-full border border-white/50 bg-white/75 px-3 py-1 text-xs text-[#32584b]">
              会话 ID: {currentSessionId ? currentSessionId.slice(0, 8) : "-"}
            </div>
          </header>

          <main className="flex-1 space-y-3 overflow-y-auto bg-[linear-gradient(180deg,_rgba(241,250,246,0.55),_rgba(255,255,255,0.2))] px-5 py-4">
            <div className="rounded-2xl border border-[#dbece5] bg-white/70 px-4 py-3 text-sm text-[#466358]">
              设定摘要: {personaSubtitle(persona)}
              {persona.default_relationship
                ? ` · 默认关系: ${persona.default_relationship}`
                : ""}
            </div>

            {isSwitchingSession ? (
              <div className="mt-6 text-center text-sm text-[#5e7a6f]">正在切换会话...</div>
            ) : null}

            {!isSwitchingSession && messages.length === 0 ? (
              <div className="mt-6 text-center text-sm text-[#5e7a6f]">
                {currentSessionId
                  ? "这个会话还没有消息，先发一句话开始吧。"
                  : characters.length > 0
                    ? "请先选择角色并新建会话，然后再开始聊天。"
                    : "请先去创建一个角色，然后再开始聊天。"}
              </div>
            ) : null}

            {!isSwitchingSession &&
              messages.map((message) => {
                const isUser = message.role === "user";
                const feedback = feedbackMap[message.id];
                const showDownvoteReasons = pendingDownvoteFor === message.id && !feedback;

                return (
                  <div
                    key={message.id}
                    className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                  >
                    <div className="max-w-[78%]">
                      <div
                        className={[
                          "mb-1 px-1 text-[11px] text-[#6c7f77]",
                          isUser ? "text-right" : "text-left",
                        ].join(" ")}
                      >
                        {isUser ? "你" : persona.name}
                      </div>

                      <div
                        className={[
                          "whitespace-pre-wrap rounded-[22px] border px-4 py-3 text-sm leading-relaxed shadow-[0_10px_30px_rgba(15,40,30,0.04)]",
                          isUser
                            ? "rounded-tr-none border-[#b7e6b9] bg-[#d7f1d8] text-[#0b3320]"
                            : "rounded-tl-none border-[#e7f1ec] bg-white text-[#0b141a]",
                        ].join(" ")}
                      >
                        {message.content}
                      </div>

                      <div
                        className={[
                          "mt-1 flex items-center gap-2 px-1 text-[10px]",
                          isUser ? "justify-end text-[#2c6b58]" : "justify-between text-[#7b8f87]",
                        ].join(" ")}
                      >
                        <span>{formatTime(message.createdAt)}</span>

                        {!isUser && message.persisted ? (
                          <div className="flex items-center gap-2 text-[11px]">
                            {feedback ? (
                              <span className="rounded-full bg-[#edf7f2] px-2 py-1 text-[#2d6b57]">
                                {feedback === "up" ? "已点赞" : "已记录反馈"}
                              </span>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  disabled={submittingFeedbackFor === message.id}
                                  onClick={() => void submitFeedback(message.id, "up")}
                                  className="rounded-full border border-[#d7e9e1] bg-white px-2 py-1 transition-colors hover:border-[#b7d8cb] hover:bg-[#f4fbf7] disabled:opacity-50"
                                >
                                  👍
                                </button>
                                <button
                                  type="button"
                                  disabled={submittingFeedbackFor === message.id}
                                  onClick={() =>
                                    setPendingDownvoteFor((current) =>
                                      current === message.id ? null : message.id,
                                    )
                                  }
                                  className="rounded-full border border-[#d7e9e1] bg-white px-2 py-1 transition-colors hover:border-[#b7d8cb] hover:bg-[#f4fbf7] disabled:opacity-50"
                                >
                                  👎
                                </button>
                              </>
                            )}
                          </div>
                        ) : null}
                      </div>

                      {showDownvoteReasons ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {DOWN_REASONS.map((reason) => (
                            <button
                              key={reason}
                              type="button"
                              disabled={submittingFeedbackFor === message.id}
                              onClick={() => void submitFeedback(message.id, "down", reason)}
                              className="rounded-full border border-[#d8e9e2] bg-white px-3 py-1 text-xs text-[#31574a] transition-colors hover:bg-[#f3fbf7] disabled:opacity-50"
                            >
                              {reason}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}

            {isLoading ? (
              <div className="flex justify-start">
                <div className="max-w-[78%]">
                  <div className="mb-1 px-1 text-[11px] text-[#6c7f77]">{persona.name}</div>
                  <div className="flex items-center gap-2 rounded-[20px] rounded-tl-none border border-[#e7f1ec] bg-white px-4 py-3 text-sm">
                    <span className="text-[#6b7f77]">正在输入...</span>
                    <span className="inline-flex gap-1">
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#8aa39a]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#8aa39a] [animation-delay:-.25s]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#8aa39a] [animation-delay:-.5s]" />
                    </span>
                  </div>
                </div>
              </div>
            ) : null}

            <div ref={listEndRef} />
          </main>

          <footer className="border-t border-[#d9efe6] bg-white/[0.82] px-5 py-4 backdrop-blur">
            <div className="mb-4">
              <MemoryContextPanel
                memories={latestMemoryContext?.memories ?? []}
                userProfile={latestMemoryContext?.userProfile ?? null}
                isLoading={isLoading}
                onFeedback={(memoryId) => submitMemoryFeedback(memoryId)}
                pendingMemoryId={submittingMemoryFeedbackId}
                generationStatus={memoryGenerationStatus}
              />
            </div>
            <form
              className="flex items-end gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                void handleSend();
              }}
            >
              <div className="flex-1">
                <label className="sr-only" htmlFor="chat-input">
                  输入消息
                </label>
                <textarea
                  id="chat-input"
                  value={input}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  rows={1}
                  disabled={!currentSessionId || isSwitchingSession}
                  className="min-h-12 w-full resize-none rounded-[20px] border border-[#d9efe6] bg-white px-4 py-3 text-sm text-[#0b141a] outline-none placeholder:text-[#7b8f87] focus:ring-2 focus:ring-[#1fa66f]"
                  placeholder="输入消息，Enter 发送，Shift + Enter 换行"
                />
              </div>

              <button
                type="submit"
                disabled={!canSend}
                aria-label="发送"
                className="flex h-12 w-12 items-center justify-center rounded-full bg-[#1fa66f] text-white transition-colors hover:bg-[#22b573] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M4 20L20 12L4 4V10L14 12L4 14V20Z" fill="currentColor" />
                </svg>
              </button>
            </form>

            {errorText ? <div className="mt-2 text-xs text-red-500">{errorText}</div> : null}
          </footer>
        </section>
      </div>

      <NewSessionDialog
        isOpen={showNewSessionDialog}
        onClose={() => setShowNewSessionDialog(false)}
        onCreateSession={handleCreateSession}
        personaId={persona.id}
      />
    </div>
  );
}
