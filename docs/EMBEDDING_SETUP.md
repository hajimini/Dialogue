# Embedding 配置指南

## 概述

记忆系统使用 **文本嵌入（Text Embedding）** 来实现语义检索。这样 AI 就能理解"昨天聊的猫"和"之前说的宠物"是相关的。

## 配置方式

### 方案 1：使用 OpenRouter 免费 Embedding（推荐）

OpenRouter 提供免费的 embedding 模型，适合测试阶段使用。

#### 步骤：

1. **注册 OpenRouter 账号**
   - 访问：https://openrouter.ai/
   - 注册并获取 API Key

2. **配置环境变量**（`.env.local`）
   ```bash
   # 使用你的 OpenRouter API Key
   ANTHROPIC_AUTH_TOKEN=sk-or-v1-your-key-here
   ANTHROPIC_BASE_URL=https://openrouter.ai
   
   # 启用 Embedding API
   USE_EMBEDDING_API=true
   
   # 使用免费的 embedding 模型
   EMBEDDING_MODEL=openai/text-embedding-3-small
   ```

3. **测试配置**
   ```bash
   node scripts/test-embedding.mjs
   ```

#### OpenRouter 免费 Embedding 模型：

| 模型 | 维度 | 说明 |
|------|------|------|
| `openai/text-embedding-3-small` | 1536 | 推荐，质量好 |
| `openai/text-embedding-ada-002` | 1536 | 经典模型 |

### 方案 2：使用本地 Fallback（不推荐）

如果不想配置 API，系统会自动使用本地哈希算法。

**缺点：**
- ❌ 无法理解语义（只能匹配相同词汇）
- ❌ 记忆检索质量很差
- ❌ "猫"和"宠物"无法关联

**配置：**
```bash
# 禁用 API，使用本地 fallback
USE_EMBEDDING_API=false
```

## 测试

### 运行测试脚本

```bash
node scripts/test-embedding.mjs
```

**预期输出：**
```
🧪 测试 Embedding API

配置信息：
  API Key: ✅ 已配置
  Base URL: https://openrouter.ai
  Endpoint: https://openrouter.ai/api/v1/embeddings
  Model: openai/text-embedding-3-small

测试文本：
  1. "我昨天去了动物园，看到了很多可爱的猫科动物"
  2. "上次我们聊过关于宠物的话题"
  3. "今天天气真好"

📡 正在调用 Embedding API...

[1/3] 处理: "我昨天去了动物园，看到了很多可爱的猫科动物..."
  ✅ 成功 (向量维度: 1536)
[2/3] 处理: "上次我们聊过关于宠物的话题..."
  ✅ 成功 (向量维度: 1536)
[3/3] 处理: "今天天气真好..."
  ✅ 成功 (向量维度: 1536)

✅ 所有测试通过！

📊 语义相似度测试：

文本 1 vs 文本 2 (都关于动物/宠物): 85.23%
文本 1 vs 文本 3 (不相关): 42.15%
文本 2 vs 文本 3 (不相关): 38.67%

💡 解读：
✅ 语义检索正常！相关文本的相似度更高。

🎉 Embedding 功能测试完成！
现在记忆系统可以进行真正的语义检索了。
```

### 在应用中测试

1. 启动开发服务器：
   ```bash
   npm run dev
   ```

2. 登录并与 AI 聊天

3. 聊几轮后，查看记忆是否正确存储：
   - 访问：http://localhost:3000/admin/memories
   - 查看生成的记忆片段

4. 测试跨会话记忆：
   - 第一天：聊"我养了一只猫"
   - 第二天：问"你还记得我的宠物吗？"
   - AI 应该能回忆起来

## 工作原理

### 1. 记忆存储流程

```
用户消息 → 会话摘要生成 → 提取记忆片段 → 生成向量 → 存入数据库
```

**代码位置：**
- `src/lib/memory/summarizer.ts` - 摘要生成
- `src/lib/memory/long-term.ts` - 记忆存储
- `src/lib/memory/embedding.ts` - 向量生成

### 2. 记忆检索流程

```
用户新消息 → 生成查询向量 → 向量相似度搜索 → 返回相关记忆 → 注入 Prompt
```

**代码位置：**
- `src/lib/memory/retriever.ts` - 记忆检索
- `src/lib/ai/prompt-builder.ts` - Prompt 组装

### 3. 向量相似度计算

使用余弦相似度（Cosine Similarity）：

```typescript
similarity = dot(A, B) / (||A|| * ||B||)
```

- 值范围：0 到 1
- 越接近 1 表示越相似
- 阈值设置：0.7（可在 `retriever.ts` 中调整）

## 性能优化

### 1. 减少 API 调用

记忆向量会被缓存，不会重复生成：

```typescript
// 如果记忆内容没变，不重新生成向量
if (existing && existing.content === memory.content) {
  // 复用已有的 embedding
  existing.embedding = existing.embedding;
}
```

### 2. 批量处理

会话摘要时一次性处理多条记忆：

```typescript
// 一次会话生成多条记忆，批量存储
await saveSessionMemories({
  memories: [
    { type: 'user_fact', content: '...' },
    { type: 'shared_event', content: '...' },
    // ...
  ]
});
```

### 3. 检索优化

使用加权评分，综合考虑：
- 语义相似度（75%）
- 重要性（15%）
- 时效性（10%）

```typescript
score = similarity * 0.75 + importance * 0.15 + recencyBoost
```

## 故障排查

### 问题 1：API 调用失败

**症状：**
```
[Embedding] API failed (401): Unauthorized. Using fallback.
```

**解决：**
- 检查 API Key 是否正确
- 确认 API Key 有效期
- 检查 Base URL 配置

### 问题 2：向量维度不匹配

**症状：**
```
[Embedding] Vector size mismatch (got 768, expected 1536). Using fallback.
```

**解决：**
- 更换模型为 `openai/text-embedding-3-small`（1536 维）
- 或修改 `VECTOR_SIZE` 常量匹配模型维度

### 问题 3：记忆检索不准确

**可能原因：**
1. 使用了 fallback（哈希向量）
2. 相似度阈值太高
3. 记忆内容太短或太模糊

**解决：**
1. 确保 API 正常工作（运行测试脚本）
2. 降低阈值：在 `retriever.ts` 中调整
3. 优化摘要生成的 Prompt

## 成本估算

### OpenRouter 免费额度

- 大多数 embedding 模型都是免费的
- 每次调用约 0.0001 美元（如果收费）
- 每天 100 次对话 ≈ 0.01 美元

### 调用频率

- 每条用户消息：1 次（查询向量）
- 每次会话摘要：N 次（N = 记忆片段数量，通常 3-5 条）
- 平均每天 100 条消息 ≈ 150 次 API 调用

## 下一步

配置完成后，可以：

1. ✅ 运行测试脚本验证
2. ✅ 启动应用测试记忆功能
3. ✅ 查看管理后台的记忆面板
4. ✅ 开始 Phase 7 的系统打磨

## 参考资料

- [OpenRouter 文档](https://openrouter.ai/docs)
- [OpenAI Embeddings 指南](https://platform.openai.com/docs/guides/embeddings)
- [向量检索原理](https://www.pinecone.io/learn/vector-embeddings/)
