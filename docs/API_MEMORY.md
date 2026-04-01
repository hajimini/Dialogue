# Memory API

## 用户侧

### `GET /api/memories`

查询参数：

- `persona_id`
- `memory_type`
- `q`
- `limit`
- `offset`

返回：

```json
{
  "success": true,
  "data": {
    "memories": [],
    "total_count": 0,
    "has_more": false
  },
  "error": null
}
```

### `DELETE /api/memories/:id`

删除当前用户拥有的记忆。

### `POST /api/memories/feedback`

请求体：

```json
{
  "memory_id": "uuid",
  "feedback_type": "accurate",
  "feedback_reason": "可选"
}
```

## 管理侧

### `GET /api/admin/memory-config`

返回当前运行时配置和最近配置历史。

### `POST /api/admin/memory-config`

```json
{
  "config": {
    "EMBEDDING_PROVIDER": "openai",
    "EMBEDDING_MODEL": "text-embedding-3-large"
  }
}
```

### `POST /api/admin/memory-config/test`

```json
{
  "provider": "embedding",
  "config": {
    "EMBEDDING_PROVIDER": "openai"
  }
}
```

### `POST /api/admin/memories/search`

```json
{
  "user_id": "demo-local-user",
  "persona_id": "persona-id",
  "query": "那个展",
  "limit": 5
}
```

返回检索分数、重排分数和耗时信息。

### `GET /api/admin/memory-logs`

支持：

- `limit`
- `offset`
- `operation`

## 聊天接口增强

### `POST /api/chat`

新增返回字段：

```json
{
  "memory_context": {
    "memories": [
      {
        "id": "uuid",
        "content": "用户提过最近在准备面试",
        "memory_type": "shared_event",
        "similarity_score": 0.91,
        "reranker_score": 0.88,
        "final_rank": 1
      }
    ],
    "user_profile": "最近在准备转职，也会因为工作压力失眠。"
  }
}
```
