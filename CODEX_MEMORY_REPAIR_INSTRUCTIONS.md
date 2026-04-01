# Codex 修复指令：Memory 验收链剩余修复

## 概述

本次任务不是新功能开发，而是**收口 memory 验收链上的真实阻塞项**，避免“代码看起来已经改了，但真实数据库、真实脚本、真实浏览器仍未闭环”的假完成状态。

你只负责 **memory 验收链**，不要碰已经切到 Postgres 的热点文件。目标是把日志链、schema/e2e 验证、import 后首次召回，以及与这些验收链直接相关的类型/测试缺口修到可验证。

## 当前状态

已确认现状如下：

- ✅ `supabase/migrations/014_add_character_id_to_memory_operation_logs.sql` **已经存在**
- ✅ `supabase/migrations/013_fix_match_memories_character_id.sql`、`015_refresh_match_memories_metadata.sql` **已经存在**
- ✅ `src/lib/memory/adapters/mem0-adapter.ts` 中已经存在：
  - `currentSessionMemories`
  - current session 与 search result 合并
  - early-session 窗口逻辑
  - `dedupeConflictingUserFacts()`
  - `memory.search / memory.getContext / memory.saveSession` 的日志字段
- ✅ 数据库 pooler 直连已验证通过，当前数据库连通性不是主阻塞
- ❌ `src/lib/memory/memory-logger.ts` 的 `query()` 在 schema cache / 缺表缺列时仍会返回空数组，存在**假绿**
- ❌ `scripts/verify-memory-frontend-schema.mjs` 未检查 `memory_operation_logs.character_id`
- ❌ `scripts/run-memory-frontend-e2e.ts` 未对齐当前强制 `characterId / character_id` 契约
- ❌ 当前仓库仍存在一批 memory 相关 `characterId` 参数缺口和 type errors

## 范围

### In scope
你只处理以下问题：

1. **日志链闭环**
2. **schema 校验脚本升级**
3. **E2E 验证脚本升级**
4. **import 后首次召回的消费侧补强**
5. **与以上验收链直接相关的 memory 类型/测试/脚本红灯**

### Out of scope
不要修改以下文件或方向：

- `src/lib/chat/sessions.ts`
- `src/app/api/chat/route.ts`
- `src/lib/admin/insights.ts`
- `src/app/admin/conversations/page.tsx`
- 大范围 Supabase -> Postgres 迁移
- 与本轮 memory 验收无关的全仓历史债务
- deterministic 抽取规则本身（只允许在消费侧补强，不重写抽取规则）

## 执行顺序

按以下顺序执行，不要打乱：

1. 日志链闭环
2. schema 校验脚本升级
3. E2E 脚本升级
4. import 首次召回消费侧补强
5. memory 验收阻断型类型/测试修复

原因：
- 先修假绿，再修逻辑，再做类型收口
- 避免在脚本本身不可信时判断功能是否已修复

---

## 阶段 1：日志链闭环

### 目标
修复“代码已传 `character_id`，但真实数据库和管理端仍看不到”的假完成状态。

### 具体任务

#### Task 1.1：确认 migration 014 是否已落到真实数据库
不要重复设计 migration。`014_add_character_id_to_memory_operation_logs.sql` 已存在。

你要做的是：
- 确认真实 Supabase 数据库里：
  - `memory_operation_logs` 表存在
  - `character_id` 列存在
  - 相关索引存在
- 如果未落地，再执行 migration

#### Task 1.2：修复 `memoryLogger.query()` 吞错假绿
修改：
- `src/lib/memory/memory-logger.ts`

要求：
- 遇到以下错误时**不再静默返回空数组**：
  - schema cache 错误
  - 缺表错误
  - 缺列错误
  - `memory_operation_logs` 结构未就绪错误
- 改为抛出明确错误，让上层 API 明确暴露“数据库结构未就绪”
- 保留现有 `memoryLogger.log()` 的 `character_id` 透传

#### Task 1.3：必要时联动 admin logs API
如果 admin logs API 目前把 query 层错误吞掉或转成空数据，需要修到能明确返回错误。

### 阶段验收
- 真实数据库中 `memory_operation_logs.character_id` 存在
- 相关索引存在
- 触发一轮真实聊天/记忆操作后：
  - `/api/admin/memory-logs?character_id=<uuid>` 能查到非空日志
- 缺列时不再伪装成“无日志”

---

## 阶段 2：Schema 校验脚本升级

### 目标
把现有 schema 校验脚本从“表存在即算通过”升级为真正能识别结构缺口。

### 修改文件
- `scripts/verify-memory-frontend-schema.mjs`

### 当前问题
当前脚本会检查：
- `memory_operation_logs` 表存在

但不会检查：
- `character_id` 列存在
- 索引存在

因此会出现假绿。

### 具体任务
补强脚本，使其至少检查：
- `memory_operation_logs.character_id`
- 相关索引存在
- 缺列 / 缺索引时明确 FAIL

### 阶段验收
运行：
```bash
npm run test:memory:schema
```

必须满足：
- 缺列时 FAIL
- 缺索引时 FAIL
- 不再出现“表在但字段缺失仍 PASS”的假绿

---

## 阶段 3：E2E 验证脚本升级

### 目标
把现有 E2E 脚本升级成真正覆盖角色维度记忆契约与 import 召回路径的回归基线。

### 修改文件
- `scripts/run-memory-frontend-e2e.ts`

### 当前问题
当前脚本存在以下问题：
- `admin create memory` 没带 `characterId`
- `user list memories` 没带 `character_id`
- `admin memory search` 没带 `character_id`
- 没真正覆盖 import transcript
- 没验证 first post-import recall
- 没验证 logs 按 `character_id` 可读
- 没完整覆盖角色 -> session -> 消息 -> 记忆链路

### 具体任务
脚本必须对齐当前 API 契约，至少覆盖：

1. 登录用户 / 管理员
2. 获取 persona / character
3. 创建或选定 character
4. 创建 session，并确保 session 绑定 `character_id`
5. 发消息
6. 校验：
   - `messages`
   - `memories`
   - `profile`
   - `session summary`
7. 走 import transcript
8. 校验 first post-import chat 是否命中 imported memory
9. 校验 admin logs 按 `character_id` 可读
10. 清理临时数据

### 调用契约要求
必须明确传递：
- admin create memory：`characterId`
- user list memories：`character_id`
- admin search memory：`character_id`

### 阶段验收
运行：
```bash
npx tsx scripts/run-memory-frontend-e2e.ts
```

报告中必须明确包含：
- 角色维度 memory create/search 生效
- import 后 memory rows 是否立即可见
- first post-import chat 是否命中 marker
- logs 是否含正确 `character_id`

---

## 阶段 4：import 首次召回消费侧补强

### 目标
导入后第一次追问时，`memory_context` 能直接命中刚导入的事实。

### 修改文件
- `src/lib/memory/adapters/mem0-adapter.ts`
- 如有必要，联动 `scripts/test-import-memory-flow.ts`

### 重要边界
这部分**不是从零实现**。现有仓库里已经有：
- `currentSessionMemories`
- current session 与 search result 合并
- early-session 窗口
- `dedupeConflictingUserFacts()`
- `memory.search / memory.getContext / memory.saveSession` 的日志字段

所以你的任务是：
> **审计并补强现有逻辑**，不是重写整套 recall 机制。

### 与 deterministic 抽取的关系
- 不要默认“别的执行者一定会完成 deterministic 抽取”
- 本轮不重写 deterministic 抽取规则本身
- 若抽取分支尚未合入，本轮只处理抽取之后的消费侧
- 若它成为阻断项，请明确标记为外部依赖

### 具体任务
审计并补强以下几点：

#### Task 4.1：当前 session 优先窗口
- 保留现有 `currentSessionMemories + searchResult.memories` 合并
- 检查 early-session 窗口是否过窄
- 当前 session 已有记忆时，不应只依赖极小 `messageCount` 才能优先保留

#### Task 4.2：截断前保留策略
- 在最终 `slice(limit)` 前，确保至少保留 1-2 条：
  - `sourceSessionId === 当前 sessionId`
  - 且为关键 `user_fact`

#### Task 4.3：冲突去重优先级
- `dedupeConflictingUserFacts()` 必须保证：
  - 同槽位冲突时，当前 session 事实优先于旧 session
  - 旧事实不能在最终 `relevantMemories` 中压掉新事实

#### Task 4.4：日志证据补强
保留并补强以下日志字段：
- 当前 session 候选数
- merge 后数量
- final result 数量
- cache hit/miss
- 如方便，再增加：final 中当前 session memory 保留数

### 阶段验收
运行：
```bash
npx tsx scripts/test-import-memory-flow.ts
```

必须达到：
- `Import auto-persisted immediately: PASS`
- `First post-import chat retrieved imported memory in memory_context: PASS`
- `Memory rows eventually persisted after follow-up chat: PASS`
- `Profile/summary eventually persisted after follow-up chat: PASS`
- `Character isolation remained intact: PASS`

---

## 阶段 5：memory 验收阻断型类型/测试修复

### 目标
只修掉与本轮 memory 验收链直接相关的红灯，不要顺手吞掉全仓历史债务。

### 修改范围
优先处理以下文件：
- `scripts/quick-test-isolation.ts`
- `src/lib/memory/__tests__/gateway.test.ts`
- `src/lib/memory/__tests__/integration.test.ts`
- `src/lib/memory/__tests__/memory-context-cache.test.ts`
- `tests/admin/memories-search.test.ts`
- `tests/memory/character-isolation.test.ts`
- `src/lib/memory/**` 中与 `characterId` 契约直接相关的源码类型错误

### 要求
- 统一补齐 `characterId / character_id` 缺口
- 先修 memory 验收链上的阻断型错误
- 不要顺手清理与本轮无关的 duplicate function / 旧 import / 旧测试债务，除非它直接阻断本轮命令

### 阶段验收
你需要分别汇报两组结果：

#### 核心验收组
```bash
npm run test:memory:schema
npx tsx scripts/test-import-memory-flow.ts
npx tsx scripts/run-memory-frontend-e2e.ts
```

#### 工程健康度组
```bash
npm run lint
npm run typecheck
npm run build
npm test -- --runInBand --no-coverage
```

如果第二组失败，必须明确区分：
- 本轮新增问题
- 本轮已修问题
- 仓库既有旧债

不允许只写“仍有 typecheck 问题”。

---

## 数据库证据要求
最终交付时，必须附上：
- `memory_operation_logs.character_id` 列存在证据
- 相关索引存在证据
- 新生成日志中 `character_id` 非空证据

---

## 交付格式
请按以下格式交付：

1. **已修改文件列表**
2. **每个阶段的完成情况**
   - PASS / FAIL
   - 简短说明
3. **核心验收命令结果**
4. **工程健康度命令结果**
5. **数据库证据**
6. **未解决阻塞项**（如果有）
   - 必须写明是否属于：
     - 本轮问题
     - 外部依赖
     - 仓库既有旧债

---

## 最终验收标准
只有满足以下条件，才算本轮真正完成：

- `memory_operation_logs.character_id` 在真实数据库中存在且可查询
- schema 校验脚本不再假绿
- E2E 脚本对齐当前 character 维度契约
- import 后首次召回脚本通过
- memory 验收链上的阻断型类型/测试缺口已修复
- 汇报中清晰区分本轮修复成果与历史旧债
