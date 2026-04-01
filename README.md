# AI Companion

AI 拟真人设陪伴对话系统，当前基于 `Next.js 16 + Supabase + MemoryGateway`。

## 当前架构

- 聊天层：`src/app/api/chat/route.ts`
- 人设与 Prompt：`src/lib/ai/`、`src/lib/persona/`
- 会话存储：`src/lib/chat/`
- 记忆网关：`src/lib/memory/gateway.ts`
- 默认记忆实现：`src/lib/memory/adapters/mem0-adapter.ts`
- 向量与重排服务：`src/lib/memory/services/embedding-service.ts`、`src/lib/memory/services/reranker-service.ts`
- 性能监控：`src/lib/memory/metrics.ts`、`src/app/api/admin/memory-metrics/route.ts`

当前记忆系统已经从旧的本地 JSON 检索逻辑迁移为 `MemoryGateway + Mem0Adapter + Supabase pgvector` 结构，并保留了中文指代词衔接规则。

## 记忆系统说明

### 核心链路

1. `/api/chat` 接收用户消息
2. `getMemoryContext()` 读取用户画像、最近摘要、长期记忆
3. `buildChatSystemPrompt()` 将记忆上下文注入系统提示词
4. 大模型生成回复
5. `maybeRefreshSessionMemory()` 提炼摘要、记忆和画像
6. `saveSessionMemories()` 通过 `MemoryGateway` 持久化

### 当前运行模式

- `MEMORY_PROVIDER=mem0`
- `EMBEDDING_PROVIDER=openai`
- 当未配置外部 embedding key 时，会自动退回本地 fallback embedding
- 当未配置 reranker key 时，会退回原始排序

### 中文记忆衔接

系统对这类输入做了专项优化：

- `那只猫今天又来了`
- `我今天去看了那个展`
- `你还记得我上次说的面试吗`

核心逻辑在：

- `src/lib/memory/adapters/mem0-adapter.ts`
- `src/lib/ai/prompt-builder.ts`

## 开发

### 环境准备

1. 复制 `.env.example` 为 `.env.local`
2. 填入 Supabase、模型和可选的 embedding / reranker 配置
3. 安装依赖

```bash
npm install
```

### 启动

```bash
npm run dev
```

默认本地地址：

- [http://localhost:3000](http://localhost:3000)

### 常用测试命令

```bash
npm test
npm run test:memory
npm run test:batch -- --category C --persona <persona-id>
npm run test:memory:performance
npm run test:regression
npm run lint
npm run typecheck
```

## 迁移相关文档

- `docs/MEMORY_MIGRATION.md`
- `docs/API_MEMORY.md`
- `.kiro/specs/mem0-memory-migration/requirements.md`
- `.kiro/specs/mem0-memory-migration/design.md`
- `.kiro/specs/mem0-memory-migration/tasks.md`

## 已验证结果

- C 类记忆衔接测试：`10/10` 通过
- `C01`、`C09` 单项验证通过
- 记忆检索性能：`memory.getContext` 均值 `483.25ms`，P95 `677ms`

详见：

- `docs/test-results/task-22-c-validation-20260328.md`
- `docs/perf-reports/memory-performance-20260328-200548.md`
