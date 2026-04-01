# Codex 启动说明（请先读）

## 你现在应该使用哪份文档
请**不要继续使用旧的剩余修复计划文档**，改为直接按下面这份最新文档执行：

- `CODEX_MEMORY_REPAIR_INSTRUCTIONS.md`

这是当前唯一有效的 Codex 修复执行文档。

---

## 为什么不用之前那份计划
旧计划已经不适合作为当前执行依据，原因如下：

### 1. 旧计划里有一部分内容已经过时
例如：
- `supabase/migrations/014_add_character_id_to_memory_operation_logs.sql` **已经存在**
- import 消费侧并不是空白，`src/lib/memory/adapters/mem0-adapter.ts` 里已经有：
  - `currentSessionMemories`
  - current session 与 search result 合并
  - early-session 窗口
  - `dedupeConflictingUserFacts()`
  - `memory.search / memory.getContext / memory.saveSession` 日志字段

如果继续按旧计划执行，很容易：
- 重复设计已存在 migration
- 重复实现已有 recall 消费侧结构
- 浪费时间，并增加回归风险

### 2. 旧计划没有明确和 Claude 当前改动的边界
Claude 当前正在处理另一条**互不干扰**的并行线：
- `src/lib/chat/sessions.ts`
- `src/app/api/chat/route.ts`
- `src/lib/admin/insights.ts`
- `src/app/admin/conversations/page.tsx`

旧计划没有清晰标出这些文件是 **out of scope**。
继续沿用旧计划，容易与 Claude 当前改动冲突。

### 3. 旧计划对“工程红灯”处理过于笼统
旧计划倾向于把 `lint / typecheck / build` 放在最后统一处理。

现在的新计划已经改成更合理的执行方式：
- 先修 **memory 验收链上的假绿和真实阻断项**
- 再单独汇报工程健康度
- 如果仍有红灯，要区分：
  - 本轮新增问题
  - 本轮已修问题
  - 仓库既有旧债

### 4. 新计划已经把真实阻塞点改写清楚
最新文档已经明确：
- 014 migration 的重点是**确认真实数据库已落地**，不是重新编写
- import 首次召回的重点是**补强现有消费侧逻辑**，不是从零重写
- schema / E2E 脚本当前存在**假绿**，必须优先修
- 只处理 memory 验收链，不碰 Postgres 热路径迁移线

---

## 你的任务范围
你只负责：
- 日志链闭环
- schema 校验脚本升级
- E2E 脚本升级
- import 首次召回消费侧补强
- 与以上直接相关的 memory 类型/测试/脚本修复

你**不要修改**：
- `src/lib/chat/sessions.ts`
- `src/app/api/chat/route.ts`
- `src/lib/admin/insights.ts`
- `src/app/admin/conversations/page.tsx`
- 大范围 Supabase -> Postgres 迁移
- 与本轮 memory 验收无关的全仓历史债务

---

## 你应该按什么顺序做
严格按 `CODEX_MEMORY_REPAIR_INSTRUCTIONS.md` 中的顺序执行：

1. 日志链闭环
2. schema 校验脚本升级
3. E2E 脚本升级
4. import 首次召回消费侧补强
5. memory 验收阻断型类型/测试修复

不要跳步。

---

## 你最终必须交付什么
至少交付以下内容：

### 核心验收结果
```bash
npm run test:memory:schema
npx tsx scripts/test-import-memory-flow.ts
npx tsx scripts/run-memory-frontend-e2e.ts
```

### 工程健康度结果
```bash
npm run lint
npm run typecheck
npm run build
npm test -- --runInBand --no-coverage
```

### 数据库证据
- `memory_operation_logs.character_id` 列存在
- 索引存在
- 新生成日志中 `character_id` 非空

### 汇报格式
必须明确区分：
- 本轮修复完成项
- 本轮未完成阻塞项
- 外部依赖
- 仓库既有旧债

不接受模糊汇报，例如：
- “大致修好了”
- “应该没问题了”
- “还有一些 typecheck 错误”

---

## 执行入口
现在请从这里开始：

- 先完整阅读：`CODEX_MEMORY_REPAIR_INSTRUCTIONS.md`
- 然后严格按该文档执行
