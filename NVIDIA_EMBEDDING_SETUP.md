# NVIDIA Embedding 配置说明

## 当前配置

已成功集成 NVIDIA embedding API 到记忆系统。

### 环境变量配置

```bash
# Embedding Configuration (使用 NVIDIA BGE-M3)
EMBEDDING_PROVIDER=nvidia
EMBEDDING_MODEL=nvidia/nv-embedqa-e5-v5
NVIDIA_API_KEY=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
NVIDIA_BASE_URL=https://integrate.api.nvidia.com/v1
```

### 向量维度

- **NVIDIA nv-embedqa-e5-v5**: 1024 维度
- **OpenAI text-embedding-3-large**: 1536 维度

### Supabase Schema 更新

需要更新 Supabase 的 `memories` 表来支持 1024 维度：

```sql
-- 运行此脚本更新 schema
-- 文件: scripts/update-schema-for-nvidia.sql

DROP INDEX IF EXISTS idx_memories_embedding;
ALTER TABLE memories ALTER COLUMN embedding TYPE VECTOR(1024);
CREATE INDEX idx_memories_embedding ON memories 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);
```

## 测试结果

### API 可用性测试 ✅

```bash
npm run test:nvidia-embedding
```

结果：
- ✅ 英文文本 embedding 生成成功
- ✅ 中文文本 embedding 生成成功
- ✅ 混合文本 embedding 生成成功
- ✅ API 响应时间：~800ms/请求

### 中文语义相似度测试 ⚠️

测试场景：
- C01: "我昨天在公园看到一只很可爱的橘猫" vs "那只猫今天又来了"
- C09: "上周末我去看了一个很棒的艺术展览" vs "我今天去看了那个展"

结果：
- ❌ C01: 相关性判断不准确（0.45 vs 0.53）
- ❌ C09: 相关性判断不准确（0.42 vs 0.53）

**问题分析**：
- `nv-embedqa-e5-v5` 模型在中文指代词场景下表现不佳
- 模型可能更关注词汇重叠而非语义理解
- 对于"今天"这样的高频词给予了过高的权重

### 建议

#### 短期方案（当前）
继续使用 `nv-embedqa-e5-v5`，但需要注意：
- ✅ 免费使用（NVIDIA 提供的免费 API）
- ✅ 响应速度快（~800ms）
- ⚠️ 中文指代词场景需要依赖 reranker 优化
- ⚠️ 可能需要调整检索策略

#### 中期方案
考虑使用更好的多语言模型：
1. **NVIDIA llama-nemotron-embed-1b-v2**
   - 2048 维度
   - 专门优化的多语言支持（包括中文）
   - 需要本地部署或 vLLM 服务器
   - 在多语言基准测试中表现优异

2. **OpenAI text-embedding-3-large**
   - 1536 维度
   - 中文支持较好
   - 需要付费 API

#### 长期方案
实现混合检索策略：
- 使用 NVIDIA embedding 进行初步检索（快速、免费）
- 使用 reranker 进行二次排序（提高准确性）
- 结合 BM25 关键词匹配（处理高频词问题）

## 代码更新

### EmbeddingService 更新

已添加 NVIDIA 支持：

```typescript
// src/lib/memory/services/embedding-service.ts

private async embedWithNVIDIA(text: string): Promise<number[]> {
  const baseUrl = this.baseUrl || 'https://integrate.api.nvidia.com/v1';
  
  const response = await fetch(`${baseUrl}/embeddings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`,
    },
    body: JSON.stringify({
      model: this.model,
      input: text,
      input_type: 'query', // Required for asymmetric models
      encoding_format: 'float',
    }),
  });
  
  // ... error handling and validation
  return embedding; // 1024 dimensions
}
```

### Config 更新

已添加 NVIDIA provider 支持：

```typescript
// src/lib/memory/config.ts

export type EmbeddingProvider = 'openai' | 'nvidia' | 'bge-m3';

// 配置读取支持 NVIDIA_API_KEY 和 NVIDIA_BASE_URL
const embeddingApiKey = 
  process.env.EMBEDDING_API_KEY ?? 
  process.env.NVIDIA_API_KEY ??
  process.env.OPENAI_API_KEY ?? 
  '';

const embeddingBaseUrl = process.env.NVIDIA_BASE_URL ?? process.env.EMBEDDING_BASE_URL;
```

## 使用方法

### 切换到 NVIDIA Embedding

1. 更新 `.env.local`:
```bash
EMBEDDING_PROVIDER=nvidia
EMBEDDING_MODEL=nvidia/nv-embedqa-e5-v5
NVIDIA_API_KEY=your_nvidia_api_key
NVIDIA_BASE_URL=https://integrate.api.nvidia.com/v1
```

2. 更新 Supabase schema:
```bash
# 在 Supabase SQL Editor 中运行
# scripts/update-schema-for-nvidia.sql
```

3. 重新生成 embeddings:
```bash
npm run migrate:mem0
```

### 切换回 OpenAI Embedding

1. 更新 `.env.local`:
```bash
EMBEDDING_PROVIDER=openai
EMBEDDING_MODEL=text-embedding-3-large
OPENAI_API_KEY=your_openai_api_key
```

2. 更新 Supabase schema（改回 1536 维度）
3. 重新生成 embeddings

## 性能对比

| 指标 | NVIDIA nv-embedqa-e5-v5 | OpenAI text-embedding-3-large |
|------|-------------------------|-------------------------------|
| 维度 | 1024 | 1536 |
| 响应时间 | ~800ms | ~500ms |
| 成本 | 免费 | ~$0.0001/请求 |
| 中文支持 | 一般 | 较好 |
| 指代词理解 | 较弱 | 较好 |
| 多语言支持 | 支持 | 支持 |

## 下一步

1. ✅ 更新 Supabase schema 支持 1024 维度
2. ✅ 运行迁移脚本生成 NVIDIA embeddings
3. ⏭️ 测试 C-category 场景的实际表现
4. ⏭️ 根据测试结果决定是否需要切换模型或优化策略

## 相关文件

- `src/lib/memory/services/embedding-service.ts` - EmbeddingService 实现
- `src/lib/memory/config.ts` - 配置管理
- `scripts/test-nvidia-embedding.mjs` - NVIDIA API 测试
- `scripts/test-nvidia-integration.mjs` - 集成测试
- `scripts/test-nvidia-simple.mjs` - C-category 测试
- `scripts/update-schema-for-nvidia.sql` - Schema 更新脚本
