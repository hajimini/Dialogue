# 项目状态说明

## 项目定位

`AI Companion` 是一套拟真人设陪伴对话系统，当前基于：

- `Next.js 16`
- `Supabase`
- `Postgres`
- `MemoryGateway / Mem0Adapter`

核心目标是：

- 支持按 `persona + character` 的一对一对话
- 支持聊天记录导入
- 支持长期记忆、画像、摘要、后台监控
- 支持管理后台查看对话、记忆、性能指标

## 当前主链路

### 用户侧

- 登录
- 选择人设
- 选择角色
- 创建新会话
- 导入聊天记录
- 在聊天页继续对话
- 查看记忆上下文面板

### 管理侧

- 登录后台
- 查看仪表盘
- 查看对话记录
- 查看记忆管理
- 查看性能监控
- 管理人设与 Prompt 版本

## 当前数据库主对象

- `personas`
- `user_characters`
- `sessions`
- `messages`
- `memories`
- `user_profiles_per_persona`
- `evaluation_logs`
- `memory_operation_logs`

## 2026-04-03 这轮修复内容

### 1. 反馈链路修复

- 修复聊天页对 AI 回复点反馈时报：
  - `找不到可反馈的 AI 回复`
- 根因是 feedback 路由只在会话前 200 条消息里找目标消息
- 现在改成按 `session_id + message_id` 精确查找

涉及文件：

- [route.ts](/D:/Dialogue/ai-companion/src/app/api/feedback/route.ts)
- [sessions.ts](/D:/Dialogue/ai-companion/src/lib/chat/sessions.ts)

### 2. 会话删除补成 purge 模式

- 删除会话时，除了删：
  - `sessions`
  - `messages`
  - `memories`
  - `evaluation_logs`
- 还可以一起清：
  - `memory_operation_logs`
  - `user_profiles_per_persona` 画像残留

涉及文件：

- [route.ts](/D:/Dialogue/ai-companion/src/app/api/sessions/[sessionId]/route.ts)
- [route.ts](/D:/Dialogue/ai-companion/src/app/api/personas/[id]/sessions/route.ts)
- [sessions.ts](/D:/Dialogue/ai-companion/src/lib/chat/sessions.ts)
- [ChatWithPersona.tsx](/D:/Dialogue/ai-companion/src/app/chat/[personaId]/ChatWithPersona.tsx)

### 3. 人设修正

- 将 `芷晴秋葉🍂` 的职业与相关设定修正为：
  - `素食店老板娘`
- 不再使用插画师设定

辅助脚本：

- [fix-zhiqing-persona.mjs](/D:/Dialogue/ai-companion/scripts/fix-zhiqing-persona.mjs)

### 4. 角色选择跳转修复

- 修复“创建角色后点击选择此角色，会跳回管理员后台”的问题
- 现在会优先回到对应聊天页，并打开新会话入口

涉及文件：

- [page.tsx](/D:/Dialogue/ai-companion/src/app/characters/page.tsx)
- [page.tsx](/D:/Dialogue/ai-companion/src/app/chat/[personaId]/page.tsx)
- [NewSessionDialog.tsx](/D:/Dialogue/ai-companion/src/components/NewSessionDialog.tsx)

### 5. 导入链路修复

- 导入时保留图片/贴图占位，不再直接丢弃
- 导入消息写入 `created_at`
- 导入后同步更新 `last_message_at`
- 补强发送者识别逻辑
- 记忆总结改成基于最近 120 条有效文字消息

涉及文件：

- [route.ts](/D:/Dialogue/ai-companion/src/app/api/chat/import/route.ts)
- [summarizer.ts](/D:/Dialogue/ai-companion/src/lib/memory/summarizer.ts)

### 6. 记忆上下文展示修复

- 后台已经生成记忆时，前台 memory-context 面板不再一律显示“没有命中”
- 增加会话级记忆回退展示

涉及文件：

- [route.ts](/D:/Dialogue/ai-companion/src/app/api/sessions/[sessionId]/memory-context/route.ts)

## 当前仍需注意的点

### 导入排序的真实规则

用户要求：

- 以原始导入文件的消息顺序为准
- 不能只按时间值重排

这意味着后续如果还发现排序争议，应该继续以：

- 原始文件顺序
- 发送者顺序
- 物理消息块顺序

作为最高优先级，而不是单独信任时间字段。

### 记忆质量问题

当前“记忆是否生成”与“前台是否展示命中”已经分开处理，但记忆提炼质量仍然需要持续人工验收，尤其是：

- 长聊天记录导入
- 跨天聊天
- 大量媒体消息夹杂
- 强口语、强情绪、关系推进明显的对话

## 当前工程状态

本轮完成后已验证：

- `npm run typecheck` 通过

## 建议的后续验收顺序

1. 重新导入原始聊天记录
2. 核对消息总数是否与原文件一致
3. 核对头部/尾部顺序是否与原文件一致
4. 核对 persona / character 是否分离
5. 核对 summary / memories / profile 是否合理
6. 核对聊天页 memory-context 面板是否能展示已生成的记忆
7. 核对后台记忆管理页面是否能查到对应会话记忆
