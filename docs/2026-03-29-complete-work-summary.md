# 2026-03-29 完整工作总结

## 一、记忆系统核心架构

### 1. MemoryGateway 抽象层 (`src/lib/memory/gateway.ts`)
- 定义统一的记忆操作接口，隔离具体实现（Mem0/Letta）
- 核心方法：`add()`, `search()`, `update()`, `delete()`, `getMemoryContext()`
- 支持批量保存会话记忆 + 用户画像更新

### 2. Mem0Adapter 实现 (`src/lib/memory/adapters/mem0-adapter.ts`)
- 实现 MemoryGateway 接口
- 集成 EmbeddingService（OpenAI/NVIDIA/BGE-M3）
- 集成 RerankerService（Jina/Cohere）
- 中文指代消解：检测"还记得/上次/那个"等续接线索
- 向量搜索 + Reranking 二次排序

### 3. 配置管理 (`src/lib/memory/config.ts`)
- 环境变量读取与验证
- 支持运行时配置覆盖（`setMemoryRuntimeConfigOverrides()`）
- 多 Provider 配置：
  - `MEMORY_PROVIDER`: mem0 | letta
  - `EMBEDDING_PROVIDER`: openai | nvidia | bge-m3
  - `RERANKER_PROVIDER`: jina | cohere | none
  - `MEMORY_RETRIEVAL_LIMIT`: 默认 5
  - `MEMORY_CONTEXT_CACHE_ENABLED`: 默认 true

### 4. Embedding Service (`src/lib/memory/services/embedding-service.ts`)
- OpenAI text-embedding-3-large (1536维)
- NVIDIA nv-embedqa-e5-v5 (1024维)
- 重试机制（指数退避，最多3次）
- 超时控制（默认8秒）
- Fallback：hash-based embedding（API失败时）
- 性能监控：记录每次请求耗时、成功率

### 5. Reranker Service (`src/lib/memory/services/reranker-service.ts`)
- Jina Reranker v2（多语言，支持中英文）
- 重排序逻辑：根据查询相关性重新排序搜索结果
- 支持续接元数据（continuation cues）增强排序
- 重试 + 超时 + Fallback（返回原始顺序）

### 6. 性能监控 (`src/lib/memory/metrics.ts`)
- `MemoryMetrics` 类：记录操作耗时
- 统计指标：count, mean, median, p95, p99, min, max
- 慢查询警告（>2秒）
- 保留最近1000条记录

### 7. 操作日志 (`src/lib/memory/memory-logger.ts`)
- 记录所有记忆操作到 `memory_operation_logs` 表
- 字段：operation, user_id, persona_id, duration, success, error_message, metadata
- 支持查询过滤：按操作类型、用户、人设、成功/失败

### 8. 记忆上下文缓存 (`src/lib/memory/memory-context-cache.ts`)
- 缓存 `getMemoryContext()` 结果，避免重复查询
- Key: `sessionId:messageCount`
- 允许复用前3条消息的缓存（MAX_REUSE_OFFSET=3）
- TTL: 30分钟
- 支持按 userId+personaId 或 personaId 失效

---

## 二、人设身份一致性系统

### `src/lib/persona/identity.ts`
防止 AI 人设在对话中出现身份混淆（如职业错误）。

#### 核心功能
1. **规范化文本**：繁简转换、大小写统一、去空格
2. **职业别名组**：调香师/調香師/perfumer 等同义词映射
3. **冲突检测**：
   - 检测人设提及（第一人称/第三人称）
   - 检测职业关键词（工作/上班/职业）
   - 检测不一致线索（不是/没说过/记错/纠正）
4. **清洗函数**：
   - `cleanConflictingPersonaSentences()` — 按句子过滤冲突内容
   - `filterConflictingPersonaMemories()` — 过滤记忆
   - `filterConflictingSessionSummaries()` — 过滤会话摘要
   - `sanitizeAssistantHistory()` — 清洗历史消息

#### 应用场景
- 记忆检索后过滤冲突记忆
- 会话摘要清洗
- Prompt 构建时注入规范身份信息

---

## 三、评估与监控系统

### `src/lib/evaluation/logs.ts`
记录 AI 回复质量评分，支持多维度评估。

#### 评分维度
- `role_adherence` — 角色一致性（1-5分）
- `naturalness` — 自然度
- `emotional_accuracy` — 情绪准确性
- `memory_accuracy` — 记忆衔接
- `anti_ai_score` — 去AI味
- `length_appropriate` — 长度合适性

#### 核心函数
- `createEvaluationLog()` — 创建评估记录
- `listEvaluationLogs()` — 查询评估记录（支持过滤）
- `getEvaluationOverview()` — 统计概览：
  - 各维度平均分
  - 按 prompt 版本分组统计
  - 用户反馈统计（👍/👎）
  - 反馈原因分布

---

## 四、多角色（Character）系统

### 数据库
`supabase/migrations/007_user_characters.sql`：
- `user_characters` 表：id, owner_id, name, personality, bio, avatar_url, is_active
- `sessions.character_id` 字段
- `memories.character_id` 字段（预留）

### API
`src/app/api/characters/route.ts`：
- GET — 获取用户角色列表
- POST — 创建角色
- PUT — 更新角色
- DELETE — 软删除（is_active=false）

### UI 组件
`src/components/NewSessionDialog.tsx`：
- 角色选择下拉框
- Line 聊天记录上传
- localStorage 记住上次选择

### Line 导入
`src/app/api/chat/import/route.ts`：
- 解析格式：`04:13 用户名 消息内容`
- 根据发送者名称判断角色（包含人设名=assistant）
- 过滤"貼圖/圖片/照片"
- 批量插入消息

### 集成
`src/app/chat/[personaId]/ChatWithPersona.tsx`：
- "新会话"按钮打开对话框
- `handleCreateSession(characterId, file?)` 支持导入

---

## 五、记忆系统错误修复

### 问题
```
invalid input syntax for type uuid: "demo-local-user"
```

### 原因
`/api/characters` 使用 `user.id`（字符串），但数据库需要 UUID。

### 修复
所有角色 API 改用：
- `getSupabaseAdminClient()`
- `getOrCreateDemoUserId()`

---

## 六、性能优化

### 1. 记忆上下文缓存
- 缓存 `getMemoryContext()` 结果
- 避免重复 embedding + 向量搜索
- 30分钟 TTL

### 2. 批量操作
- `saveSessionMemories()` 批量插入记忆
- 减少数据库往返次数

### 3. 超时控制
- Embedding API: 8秒超时
- Reranker API: 8秒超时
- 防止慢请求阻塞

### 4. 重试机制
- 指数退避（1s → 2s → 4s）
- 最多3次重试
- 401/Invalid 错误不重试

---

## 七、测试覆盖

### 单元测试
- `src/lib/memory/__tests__/` — 记忆系统各模块
- `src/lib/memory/services/*.test.ts` — Embedding/Reranker
- `src/lib/memory/adapters/mem0-adapter.test.ts`
- `src/lib/memory/memory-context-cache.test.ts`

### 集成测试
- `src/lib/memory/__tests__/integration.test.ts`

---

## 八、配置文档

### 环境变量
```bash
# 记忆系统
MEMORY_PROVIDER=mem0
MEM0_API_KEY=xxx

# Embedding
EMBEDDING_PROVIDER=openai
EMBEDDING_API_KEY=xxx
EMBEDDING_MODEL=text-embedding-3-large

# Reranker
RERANKER_PROVIDER=jina
RERANKER_API_KEY=xxx

# 检索配置
MEMORY_RETRIEVAL_LIMIT=5
MEMORY_CONTEXT_CACHE_ENABLED=true

# 超时配置
EMBEDDING_REQUEST_TIMEOUT_MS=8000
RERANKER_REQUEST_TIMEOUT_MS=8000
```

---

## 九、文件清单

### 新增文件
- `src/lib/memory/gateway.ts` — 抽象接口
- `src/lib/memory/adapters/mem0-adapter.ts` — Mem0 实现
- `src/lib/memory/services/embedding-service.ts` — Embedding
- `src/lib/memory/services/reranker-service.ts` — Reranker
- `src/lib/memory/config.ts` — 配置管理
- `src/lib/memory/metrics.ts` — 性能监控
- `src/lib/memory/memory-logger.ts` — 操作日志
- `src/lib/memory/memory-context-cache.ts` — 缓存
- `src/lib/persona/identity.ts` — 身份一致性
- `src/lib/evaluation/logs.ts` — 评估日志
- `src/components/NewSessionDialog.tsx` — 新会话对话框
- `src/app/api/chat/import/route.ts` — Line 导入
- `supabase/migrations/007_user_characters.sql` — 角色表

### 修改文件
- `src/app/api/characters/route.ts` — UUID 修复
- `src/app/chat/[personaId]/ChatWithPersona.tsx` — 集成对话框
- `src/lib/chat/sessions.ts` — 支持 characterId
- `src/app/api/personas/[id]/sessions/route.ts` — 接受 character_id
- `src/app/characters/page.tsx` — 路由修复

---

## 十、后续优化方向

1. **记忆隔离**：基于 `character_id` 隔离记忆
2. **BGE-M3 实现**：本地 embedding 模型
3. **Cohere Reranker**：备选 reranker
4. **更多导入格式**：微信、Telegram
5. **角色头像**：上传和显示
6. **记忆质量评分**：自动评估记忆准确性
7. **A/B 测试**：不同 prompt 版本对比
