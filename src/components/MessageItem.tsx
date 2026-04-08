import React from "react";

type ChatRole = "user" | "assistant";
type FeedbackValue = "up" | "down";

type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: number;
  persisted: boolean;
};

type MessageItemProps = {
  message: ChatMessage;
  personaName: string;
  isUser: boolean;
  feedback: FeedbackValue | undefined;
  showDownvoteReasons: boolean;
  submittingFeedbackFor: string | null;
  onSubmitFeedback: (messageId: string, type: FeedbackValue, reason?: string) => void;
  onToggleDownvote: (messageId: string) => void;
  formatTime: (timestamp: number) => string;
};

const DOWN_REASONS = ["太像 AI", "答非所问", "忘了之前的事", "太长了"] as const;

const MessageItem = React.memo(({
  message,
  personaName,
  isUser,
  feedback,
  showDownvoteReasons,
  submittingFeedbackFor,
  onSubmitFeedback,
  onToggleDownvote,
  formatTime,
}: MessageItemProps) => {
  const assistantSegments = isUser
    ? [message.content]
    : message.content
        .split(/\n+/)
        .map((segment) => segment.trim())
        .filter(Boolean);

  return (
    <div
      className={`flex ${isUser ? "justify-end" : "justify-start"}`}
    >
      <div className="max-w-[78%]">
        <div
          className={[
            "mb-1 px-1 text-[11px] text-[#6c7f77]",
            isUser ? "text-right" : "text-left",
          ].join(" ")}
        >
          {isUser ? "你" : personaName}
        </div>

        <div className="space-y-2">
          {assistantSegments.map((segment, index) => (
            <div
              key={`${message.id}-${index}`}
              className={[
                "whitespace-pre-wrap rounded-[22px] border px-4 py-3 text-sm leading-relaxed shadow-[0_10px_30px_rgba(15,40,30,0.04)]",
                isUser
                  ? "rounded-tr-none border-[#b7e6b9] bg-[#d7f1d8] text-[#0b3320]"
                  : index === 0
                    ? "rounded-tl-none border-[#e7f1ec] bg-white text-[#0b141a]"
                    : "border-[#e7f1ec] bg-white text-[#0b141a]",
              ].join(" ")}
            >
              {segment}
            </div>
          ))}
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
                    onClick={() => onSubmitFeedback(message.id, "up")}
                    className="rounded-full border border-[#d7e9e1] bg-white px-2 py-1 transition-colors hover:border-[#b7d8cb] hover:bg-[#f4fbf7] disabled:opacity-50"
                  >
                    👍
                  </button>
                  <button
                    type="button"
                    disabled={submittingFeedbackFor === message.id}
                    onClick={() => onToggleDownvote(message.id)}
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
                onClick={() => onSubmitFeedback(message.id, "down", reason)}
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
});

MessageItem.displayName = "MessageItem";

export default MessageItem;
