# Memory Frontend Integration

## 已接入内容

- 用户侧新增 `/memories`，可查看、筛选、搜索和删除自己的长期记忆
- 聊天页新增“记忆上下文”面板，展示本轮命中的记忆和用户画像摘要
- 管理后台新增：
  - `/admin/memory-performance`
  - `/admin/memory-config`
  - `/admin/memories` 增强版

## 依赖接口

- `GET /api/memories`
- `DELETE /api/memories/:id`
- `POST /api/memories/feedback`
- `GET /api/admin/memory-config`
- `POST /api/admin/memory-config`
- `POST /api/admin/memory-config/test`
- `POST /api/admin/memories/search`
- `GET /api/admin/memory-logs`
- `GET /api/admin/memory-metrics`

## 上线前必做

1. 执行 [`setup-memory-frontend-integration-schema.sql`](/D:/Dialogue/ai-companion/scripts/setup-memory-frontend-integration-schema.sql)
2. 在 `.env` 中补齐新的记忆相关配置
3. 重启 Next.js 服务，使运行时配置和新路由生效

## 已知行为

- 如果 `memory_operation_logs` / `memory_config_history` 还未建表，页面会降级为空数据，不再直接报错
- `memory_context` 缓存默认开启，使用 `session_id + message_count` 作为 key，并允许复用最近 3 条消息的上下文
