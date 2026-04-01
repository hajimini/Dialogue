# Memory Migration Guide

## 目标

将旧的本地记忆检索逻辑迁移到：

- `MemoryGateway`
- `Mem0Adapter`
- `Supabase pgvector`
- 可切换 embedding / reranker 服务

重点改善中文对话中的记忆衔接问题，例如：

- `那只猫今天又来了`
- `我今天去看了那个展`
- `你还记得我上次说的面试吗`

## 当前落地方案

### 运行结构

- 网关接口：`src/lib/memory/gateway.ts`
- 工厂与配置：`src/lib/memory/factory.ts`、`src/lib/memory/config.ts`
- 默认实现：`src/lib/memory/adapters/mem0-adapter.ts`
- embedding 服务：`src/lib/memory/services/embedding-service.ts`
- reranker 服务：`src/lib/memory/services/reranker-service.ts`
- 性能指标：`src/lib/memory/metrics.ts`

### 兼容策略

- `getMemoryContext()` 保持原接口不变
- `saveSessionMemories()` 保持原接口不变
- persona 身份冲突过滤逻辑保留
- PromptBuilder 的记忆注入方式保留

## 环境变量

最关键的配置如下：

- `MEMORY_PROVIDER=mem0`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY` 或 `SUPABASE_SERVICE_ROLE_KEY`
- `EMBEDDING_PROVIDER`
- `EMBEDDING_MODEL`
- `RERANKER_PROVIDER`
- `MEMORY_RETRIEVAL_LIMIT`

如果没有配置外部 embedding key，系统会自动使用 fallback embedding。

如果没有配置 reranker key，系统会自动退回原始排序。

## 迁移步骤

1. 配置 `.env.local`
2. 确认 Supabase schema 可用
3. 运行迁移脚本
4. 执行 C 类记忆衔接验证
5. 执行性能测试
6. 回归测试

## 常用命令

```bash
npm run migrate:mem0
npm run rollback:mem0:latest
npm run test:memory
npm run test:batch -- --category C --persona <persona-id>
npx tsx scripts/run-memory-performance.ts
```

## 已完成验证

### C 类记忆衔接

- `C01` 通过
- `C09` 通过
- 全量 `C` 类 `10/10` 通过

### 性能

- `memory.search.duration` 均值：`214ms`
- `memory.getContext.duration` 均值：`483.25ms`
- `memory.getContext.duration` P95：`677ms`
- 并发 5 请求 wall time：`1774ms`

## 已知限制

- 当前 embedding 仍处于 fallback 模式时，语义能力会弱于真实 embedding API
- 当前未配置外部 reranker key 时，不会触发真实重排服务
- Supabase 模式下，本地登录体系与 Supabase auth user 之间通过 demo user 桥接

## 建议下一步

1. 接入正式 embedding key
2. 接入正式 reranker key
3. 用真实线上 Prompt 再跑一轮批量评估
4. 评估是否进一步接入 Letta 或更强记忆后端
