# 输入框卡顿和连续发送问题修复方案

## 问题 1：输入框卡顿

### 根本原因
- 每次输入触发整个组件重渲染
- messages 数组可能很大（几百条）
- 没有优化的 onChange 回调

### 解决方案

#### A. 使用 useCallback 优化回调
```typescript
const handleInputChange = useCallback((event: React.ChangeEvent<HTMLTextAreaElement>) => {
  setInput(event.target.value);
}, []);
```

#### B. 使用 React.memo 优化消息列表
```typescript
const MessageList = React.memo(({ messages }: { messages: ChatMessage[] }) => {
  return (
    <>
      {messages.map(message => (
        <MessageItem key={message.id} message={message} />
      ))}
    </>
  );
});
```

#### C. 虚拟滚动（如果消息很多）
```typescript
import { useVirtualizer } from '@tanstack/react-virtual';

const virtualizer = useVirtualizer({
  count: messages.length,
  getScrollElement: () => scrollRef.current,
  estimateSize: () => 100,
});
```

#### D. 输入框独立组件（最简单有效）
```typescript
// 把输入框拆成独立组件，避免被父组件重渲染影响
const ChatInput = React.memo(({ 
  value, 
  onChange, 
  onSend, 
  disabled 
}: ChatInputProps) => {
  return (
    <textarea
      value={value}
      onChange={onChange}
      // ...
    />
  );
});
```

## 问题 2：不能连续发送多条消息

### 当前行为
- 发送一条 → 等待 AI 回复 → 才能发送下一条
- 不符合真实聊天场景

### 真实场景
```
用户: 在吗
用户: 今天好累
用户: 想找你聊聊
AI: 在啊，怎麼了
```

### 解决方案

#### 方案 A：允许连续发送（推荐）

```typescript
// 1. 移除 isLoading 的阻塞
const canSend = input.trim().length > 0 && currentSessionId;
// 不再检查 && !isLoading

// 2. 支持消息队列
const [pendingMessages, setPendingMessages] = useState<string[]>([]);

async function handleSend() {
  if (!canSend) return;
  
  const message = input.trim();
  setInput("");
  
  // 立即显示用户消息
  const userMessage = {
    id: newId(),
    role: "user",
    content: message,
    createdAt: Date.now(),
    persisted: false,
  };
  
  setMessages(current => [...current, userMessage]);
  
  // 异步发送，不阻塞下一条
  sendMessageAsync(message);
}

async function sendMessageAsync(message: string) {
  // 发送到后端
  const response = await fetch("/api/chat", {
    method: "POST",
    body: JSON.stringify({ message, ... }),
  });
  
  // 显示 AI 回复
  const reply = await response.json();
  setMessages(current => [...current, {
    id: reply.data.id,
    role: "assistant",
    content: reply.data.reply,
    createdAt: Date.now(),
    persisted: true,
  }]);
}
```

#### 方案 B：批量发送模式

```typescript
// 用户可以连续输入多条，一起发送
const [messageQueue, setMessageQueue] = useState<string[]>([]);

function addToQueue() {
  if (!input.trim()) return;
  setMessageQueue(current => [...current, input.trim()]);
  setInput("");
}

async function sendQueue() {
  // 一次性发送多条消息
  for (const msg of messageQueue) {
    await sendMessage(msg);
  }
  setMessageQueue([]);
}
```

#### 方案 C：真实聊天模式（最佳）

```typescript
// 模拟真人聊天：连续发送，AI 看到所有消息后统一回复
const [unreadMessages, setUnreadMessages] = useState<string[]>([]);

function handleSend() {
  const message = input.trim();
  setInput("");
  
  // 立即显示
  setMessages(current => [...current, {
    id: newId(),
    role: "user",
    content: message,
    createdAt: Date.now(),
    persisted: false,
  }]);
  
  // 加入未读队列
  setUnreadMessages(current => [...current, message]);
  
  // 延迟发送（等待用户是否还有后续消息）
  clearTimeout(sendTimerRef.current);
  sendTimerRef.current = setTimeout(() => {
    sendBatchMessages(unreadMessages);
    setUnreadMessages([]);
  }, 2000); // 2秒内没有新消息，就发送
}
```

### 推荐实施方案

**短期（立即可做）**：
1. 移除 `isLoading` 阻塞，允许连续发送
2. 使用 `useCallback` 优化输入框

**中期（Phase 7 Round 3）**：
3. 拆分输入框为独立组件
4. 实现消息队列机制

**长期（Phase 8）**：
5. 实现真实聊天模式（批量发送）
6. 虚拟滚动优化长列表

## 实施优先级

| 问题 | 优先级 | 工作量 | 效果 |
|------|--------|--------|------|
| 输入框卡顿 - useCallback | P0 | 5分钟 | 立即改善 |
| 允许连续发送 | P0 | 10分钟 | 显著提升体验 |
| 输入框独立组件 | P1 | 30分钟 | 彻底解决卡顿 |
| 消息队列 | P1 | 1小时 | 更真实 |
| 虚拟滚动 | P2 | 2小时 | 性能优化 |
| 批量发送模式 | P2 | 2小时 | 高级功能 |
