# Implementation Plan: Memory System Frontend Integration

## Overview

本实施计划将 Mem0 记忆系统集成到 AI Companion 前端界面，包括管理后台增强、用户界面增强和 API 补充。实施将分为数据库准备、后端 API 开发、前端组件开发和集成测试四个阶段。

## Tasks

- [x] 1. 数据库 Schema 和安全策略设置
  - [x] 1.1 创建 memory_feedback 表和索引
    - 创建表结构：id, user_id, memory_id, feedback_type, feedback_reason, created_at
    - 创建索引：idx_memory_feedback_memory_id, idx_memory_feedback_user_id, idx_memory_feedback_created_at
    - _Requirements: 10.1, 10.2, 10.3_

  - [x] 1.2 扩展 memories 表字段
    - 添加 feedback_count_accurate, feedback_count_inaccurate, retrieval_count 字段
    - 创建索引：idx_memories_feedback_inaccurate
    - _Requirements: 10.4, 10.5_

  - [x] 1.3 创建 memory_config_history 表
    - 创建表结构：id, config, changed_by, changed_at
    - 创建索引：idx_memory_config_history_changed_at
    - _Requirements: 3.7_

  - [x] 1.4 创建 memory_operation_logs 表
    - 创建表结构：id, timestamp, operation, user_id, persona_id, memory_id, duration, success, error_message, metadata
    - 创建索引：idx_memory_operation_logs_timestamp, idx_memory_operation_logs_operation, idx_memory_operation_logs_user_id
    - _Requirements: 15.1, 15.2_

  - [x] 1.5 配置 Supabase RLS 策略
    - 为 memories 表配置用户读取和删除策略
    - 为 memory_feedback 表配置用户创建和读取策略
    - _Requirements: 14.2, 14.3_


- [ ] 2. 后端服务层实现
  - [x] 2.1 实现 MemoryContextCache 服务
    - 创建 src/lib/memory/memory-context-cache.ts
    - 实现 get, set, invalidate, clear 方法
    - 使用 Map 存储缓存，30 分钟 TTL
    - 支持环境变量 MEMORY_CONTEXT_CACHE_ENABLED 控制开关
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.6_

  - [ ]* 2.2 编写 MemoryContextCache 属性测试
    - **Property 20: 缓存复用**
    - **Property 21: 缓存失效**
    - **Validates: Requirements 12.3, 12.5**

  - [x] 2.3 实现 ConfigService 服务
    - 创建 src/lib/memory/config-service.ts
    - 实现 getCurrentConfig, updateConfig, getConfigHistory, testConnection 方法
    - 支持读取和更新环境变量配置
    - _Requirements: 3.2, 3.3, 3.4, 3.6, 3.7_

  - [x] 2.4 实现 MemoryLogger 服务
    - 创建 src/lib/memory/memory-logger.ts
    - 实现 log, query 方法
    - 输出 JSON 格式日志到 stdout
    - 支持按操作类型过滤
    - _Requirements: 15.1, 15.2, 15.3, 15.4_

  - [x]* 2.5 编写 MemoryLogger 单元测试
    - 测试日志记录功能
    - 测试日志查询和过滤
    - _Requirements: 15.1, 15.2_

- [ ] 3. 用户端记忆 API 实现
  - [x] 3.1 实现 GET /api/memories 端点
    - 创建 src/app/api/memories/route.ts
    - 验证用户身份认证
    - 支持查询参数：persona_id, memory_type, limit, offset
    - 返回字段：memories, total_count, has_more
    - 按 updated_at 降序排序
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_

  - [ ]* 3.2 编写 GET /api/memories 属性测试
    - **Property 11: API 身份认证**
    - **Property 12: API 响应字段完整性**
    - **Property 13: 数据访问隔离**
    - **Property 14: 记忆排序一致性**
    - **Validates: Requirements 7.2, 7.5, 7.6, 7.7**

  - [x] 3.3 实现 DELETE /api/memories/[id] 端点
    - 创建 src/app/api/memories/[id]/route.ts
    - 验证用户身份和记忆所有权
    - 删除记忆并清除相关缓存
    - _Requirements: 5.6, 14.1_

  - [x] 3.4 实现 POST /api/memories/feedback 端点
    - 创建 src/app/api/memories/feedback/route.ts
    - 验证用户身份和参数有效性
    - 创建 memory_feedback 记录
    - 更新 memories 表的反馈计数和 importance 权重
    - _Requirements: 6.5, 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7_

  - [ ]* 3.5 编写 POST /api/memories/feedback 属性测试
    - **Property 7: 反馈降低记忆权重**
    - **Property 9: 反馈记录完整性**
    - **Property 18: 反馈计数更新**
    - **Validates: Requirements 6.3, 8.6, 8.7, 10.6**


- [ ] 4. 管理员记忆 API 实现
  - [x] 4.1 实现 GET /api/admin/memory-metrics 端点
    - 创建 src/app/api/admin/memory-metrics/route.ts
    - 验证管理员权限
    - 调用 MemoryMetrics.getAllStats() 获取性能数据
    - 返回所有性能指标的统计数据
    - _Requirements: 1.2, 1.3_

  - [ ]* 4.2 编写 GET /api/admin/memory-metrics 属性测试
    - **Property 1: 性能指标统计完整性**
    - **Validates: Requirements 1.3**

  - [x] 4.3 实现 DELETE /api/admin/memory-metrics 端点
    - 在 src/app/api/admin/memory-metrics/route.ts 添加 DELETE 方法
    - 验证管理员权限
    - 调用 MemoryMetrics.reset() 重置指标
    - _Requirements: 1.5_

  - [x] 4.4 实现 GET /api/admin/memory-config 端点
    - 创建 src/app/api/admin/memory-config/route.ts
    - 验证管理员权限
    - 返回当前配置和历史记录
    - _Requirements: 3.2, 3.7_

  - [x] 4.5 实现 POST /api/admin/memory-config 端点
    - 在 src/app/api/admin/memory-config/route.ts 添加 POST 方法
    - 验证管理员权限和配置有效性
    - 更新配置并记录历史
    - _Requirements: 3.3, 3.4, 3.5_

  - [ ]* 4.6 编写配置管理 API 属性测试
    - **Property 5: 配置验证有效性**
    - **Validates: Requirements 3.4**

  - [x] 4.7 实现 POST /api/admin/memory-config/test 端点
    - 创建 src/app/api/admin/memory-config/test/route.ts
    - 验证管理员权限
    - 测试 embedding 或 reranker API 连接
    - _Requirements: 3.6_

  - [x] 4.8 实现 POST /api/admin/memories/search 端点
    - 创建 src/app/api/admin/memories/search/route.ts
    - 验证管理员权限
    - 调用 MemoryGateway.search() 执行检索
    - 返回详细的检索结果和性能数据
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6_

  - [ ]* 4.9 编写 POST /api/admin/memories/search 属性测试
    - **Property 4: 搜索结果分数完整性**
    - **Property 15: 管理员 API 权限验证**
    - **Property 16: 搜索 API 响应完整性**
    - **Property 17: 搜索结果详情完整性**
    - **Validates: Requirements 2.3, 9.2, 9.5, 9.6**

  - [x] 4.10 实现 GET /api/admin/memory-logs 端点
    - 创建 src/app/api/admin/memory-logs/route.ts
    - 验证管理员权限
    - 调用 MemoryLogger.query() 查询日志
    - 支持分页和过滤
    - _Requirements: 15.4_


- [ ] 5. 增强 /api/chat 端点返回记忆上下文
  - [x] 5.1 修改 /api/chat 端点集成 MemoryContextCache
    - 修改 src/app/api/chat/route.ts
    - 在生成回复前检查缓存
    - 缓存未命中时调用 MemoryGateway.getMemoryContext()
    - 在响应中包含 memory_context 字段
    - _Requirements: 4.2, 12.1, 12.3_

  - [ ]* 5.2 编写 /api/chat 记忆上下文属性测试
    - **Property 6: 记忆上下文字段完整性**
    - **Validates: Requirements 4.4**

- [x] 6. Checkpoint - 确保所有后端 API 测试通过
  - 运行所有 API 单元测试和属性测试
  - 验证数据库 Schema 正确创建
  - 确保所有测试通过，如有问题请询问用户

- [ ] 7. 前端共享组件开发
  - [x] 7.1 创建 MemoryContextPanel 组件
    - 创建 src/components/MemoryContextPanel.tsx
    - 实现折叠面板展示（默认折叠）
    - 展示相关记忆（最多 3 条）和用户画像
    - 显示相似度分数
    - 提供"这条记忆不准确"按钮
    - 显示加载状态
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 13.1, 13.2_

  - [ ]* 7.2 编写 MemoryContextPanel 单元测试
    - 测试组件渲染
    - 测试反馈按钮交互
    - 测试加载状态显示
    - _Requirements: 4.1, 4.5, 13.1_

  - [x] 7.3 创建 PerformanceMetricsChart 组件
    - 创建 src/components/admin/PerformanceMetricsChart.tsx
    - 使用 Recharts 渲染性能趋势图表
    - 支持多种图表类型（折线图、柱状图）
    - _Requirements: 1.4_

  - [x] 7.4 创建 MetricStatsTable 组件
    - 创建 src/components/admin/MetricStatsTable.tsx
    - 展示统计表格（count、mean、median、p95、p99、min、max）
    - 高亮显示慢查询（>2000ms）
    - _Requirements: 1.3, 1.6_

  - [ ]* 7.5 编写 MetricStatsTable 属性测试
    - **Property 1: 性能指标统计完整性**
    - **Property 2: 慢查询高亮显示**
    - **Validates: Requirements 1.3, 1.6**


- [ ] 8. 管理后台页面开发
  - [x] 8.1 创建 /admin/memory-performance 页面
    - 创建 src/app/admin/memory-performance/page.tsx
    - 从 /api/admin/memory-metrics 获取性能数据
    - 集成 PerformanceMetricsChart 和 MetricStatsTable 组件
    - 提供"重置指标"按钮
    - 实现每 30 秒自动刷新
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.7_

  - [ ]* 8.2 编写 /admin/memory-performance 单元测试
    - 测试页面渲染
    - 测试自动刷新功能
    - 测试重置按钮
    - _Requirements: 1.1, 1.5, 1.7_

  - [x] 8.3 创建 /admin/memory-config 页面
    - 创建 src/app/admin/memory-config/page.tsx
    - 展示当前配置
    - 提供表单修改配置
    - 实现"测试连接"功能
    - 展示配置修改历史（最近 10 条）
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.6, 3.7_

  - [ ]* 8.4 编写 /admin/memory-config 单元测试
    - 测试配置展示
    - 测试配置修改表单
    - 测试连接测试功能
    - _Requirements: 3.2, 3.3, 3.6_

  - [x] 8.5 增强 /admin/memories 页面
    - 修改 src/app/admin/memories/page.tsx
    - 展示记忆的技术详情（embedding provider、model、dimension）
    - 添加"查看向量"功能（展示前 10 个维度）
    - 在搜索结果中展示相似度分数和 reranker 分数
    - 添加"测试检索"功能
    - 展示记忆的反馈统计
    - 高亮显示需要人工审核的记忆（>3 次不准确反馈）
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 6.4, 6.6_

  - [ ]* 8.6 编写增强的 /admin/memories 属性测试
    - **Property 3: 记忆详情字段完整性**
    - **Property 4: 搜索结果分数完整性**
    - **Property 10: 高反馈记忆高亮显示**
    - **Validates: Requirements 2.1, 2.3, 6.6**

  - [x] 8.7 更新管理后台导航菜单
    - 修改 src/app/admin/layout.tsx
    - 在"记忆"菜单项下添加子菜单：记忆管理、性能监控、系统配置
    - 使用图标区分不同功能模块
    - 实现当前页面高亮
    - _Requirements: 11.1, 11.3, 11.4_

  - [ ]* 8.8 编写导航菜单属性测试
    - **Property 19: 导航菜单高亮**
    - **Validates: Requirements 11.4**


- [ ] 9. 用户界面页面开发
  - [x] 9.1 创建 /memories 页面（用户端）
    - 创建 src/app/memories/page.tsx
    - 从 /api/memories 获取记忆列表
    - 支持按人设筛选
    - 支持按记忆类型筛选
    - 提供搜索功能
    - 提供"删除记忆"按钮
    - 实现分页加载（limit=50）
    - 显示骨架屏加载状态
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 13.4_

  - [ ]* 9.2 编写 /memories 页面属性测试
    - **Property 8: 个人记忆字段完整性**
    - **Validates: Requirements 5.5**

  - [x] 9.3 增强聊天界面集成 MemoryContextPanel
    - 修改 src/app/chat/[personaId]/ChatWithPersona.tsx
    - 在消息发送后展示记忆上下文
    - 集成 MemoryContextPanel 组件
    - 处理记忆反馈提交
    - 显示记忆加载状态
    - _Requirements: 4.1, 4.2, 4.5, 4.6, 13.1, 13.2, 13.3_

  - [ ]* 9.4 编写聊天界面记忆上下文单元测试
    - 测试 MemoryContextPanel 集成
    - 测试反馈提交流程
    - 测试加载状态显示
    - _Requirements: 4.1, 4.5, 13.1, 13.2_

  - [x] 9.5 更新用户侧边栏添加"我的记忆"菜单
    - 修改聊天界面的侧边栏组件
    - 添加"我的记忆"菜单项，链接到 /memories
    - 使用图标区分功能
    - _Requirements: 11.2, 11.3_

- [x] 10. Checkpoint - 确保所有前端组件测试通过
  - 运行所有前端单元测试和属性测试
  - 验证页面渲染正确
  - 确保所有测试通过，如有问题请询问用户


- [ ] 11. 集成 MemoryLogger 到现有记忆操作
  - [x] 11.1 在 MemoryGateway 中集成 MemoryLogger
    - 修改 src/lib/memory/gateway.ts
    - 在 add, search, update, delete 方法中记录操作日志
    - 记录字段：timestamp, operation, user_id, persona_id, memory_id, duration, success, error_message
    - _Requirements: 15.1, 15.2, 15.3_

  - [ ]* 11.2 编写 MemoryLogger 集成属性测试
    - **Property 22: 记忆访问日志记录**
    - **Validates: Requirements 15.2**

  - [x] 11.3 在 /api/memories/feedback 中记录反馈日志
    - 修改 src/app/api/memories/feedback/route.ts
    - 记录 memory.feedback 操作日志
    - _Requirements: 15.1, 15.2_

- [ ] 12. 安全审计和访问控制验证
  - [x] 12.1 验证 Supabase RLS 策略生效
    - 编写测试脚本验证用户只能访问自己的记忆
    - 验证管理员可以通过 service_key 访问所有数据
    - _Requirements: 14.2, 14.3, 14.4_

  - [x] 12.2 实现记忆访问审计日志
    - 在所有记忆 API 中记录访问日志
    - 包含 user_id、操作类型、时间戳
    - _Requirements: 14.5_

  - [ ] 12.3 实现异常访问检测（可选）
    - 检测短时间内大量读取的异常模式
    - 触发安全警报
    - _Requirements: 14.6_

  - [ ]* 12.4 编写安全访问控制属性测试
    - **Property 13: 数据访问隔离**
    - **Validates: Requirements 14.1, 14.2**


- [ ] 13. 端到端集成测试
  - [x] 13.1 编写用户记忆查看和反馈流程测试
    - 测试用户登录 -> 访问 /memories -> 查看记忆 -> 提交反馈
    - 验证数据库中存在反馈记录
    - 验证记忆权重被降低
    - _Requirements: 5.1, 5.6, 6.1, 6.3, 8.7_

  - [x] 13.2 编写管理员性能监控流程测试
    - 测试管理员登录 -> 访问 /admin/memory-performance -> 查看指标 -> 重置指标
    - 验证指标被重置
    - _Requirements: 1.1, 1.2, 1.5_

  - [x] 13.3 编写聊天界面记忆上下文流程测试
    - 测试用户发送消息 -> 展示记忆上下文 -> 提交反馈
    - 验证缓存机制生效
    - _Requirements: 4.1, 4.2, 4.5, 4.6, 12.3_

  - [x] 13.4 编写管理员记忆搜索测试流程测试
    - 测试管理员访问 /admin/memories -> 使用"测试检索"功能 -> 查看详细结果
    - 验证返回相似度分数和 reranker 分数
    - _Requirements: 2.3, 2.4, 9.1, 9.5, 9.6_

  - [x] 13.5 编写配置管理流程测试
    - 测试管理员访问 /admin/memory-config -> 修改配置 -> 测试连接 -> 保存
    - 验证配置历史记录被创建
    - _Requirements: 3.2, 3.3, 3.4, 3.6, 3.7_

- [x] 14. 性能优化和监控验证
  - [x] 14.1 验证缓存机制减少重复操作
    - 运行性能测试，对比启用/禁用缓存的响应时间
    - 验证缓存命中率 > 50%
    - _Requirements: 12.1, 12.3_

  - [x] 14.2 验证性能监控数据准确性
    - 执行一系列记忆操作
    - 验证 Performance Dashboard 显示的指标与实际耗时一致
    - _Requirements: 1.2, 1.3_

  - [x] 14.3 验证慢查询高亮功能
    - 模拟慢查询场景（>2000ms）
    - 验证 Performance Dashboard 正确高亮显示
    - _Requirements: 1.6_


- [ ] 15. 文档和部署准备
  - [x] 15.1 创建数据库迁移脚本
    - 创建 scripts/setup-memory-frontend-integration-schema.sql
    - 包含所有新表和索引的创建语句
    - 包含 RLS 策略配置
    - _Requirements: 10.1, 10.2, 10.3, 14.2, 14.3_

  - [x] 15.2 更新环境变量文档
    - 更新 .env.example
    - 添加 MEMORY_CONTEXT_CACHE_ENABLED 说明
    - 添加新增配置项的说明
    - _Requirements: 12.6_

  - [x] 15.3 创建功能使用文档
    - 创建 docs/MEMORY_FRONTEND_INTEGRATION.md
    - 说明管理后台新功能的使用方法
    - 说明用户端新功能的使用方法
    - 包含截图和示例

  - [x] 15.4 更新 API 文档
    - 更新 docs/API_MEMORY.md
    - 添加所有新增 API 端点的文档
    - 包含请求/响应示例

- [x] 16. Final Checkpoint - 完整系统验证
  - 运行所有单元测试、属性测试和集成测试
  - 验证所有 15 个需求的验收标准都已满足
  - 验证所有 22 个正确性属性都通过测试
  - 手动测试关键用户流程
  - 确保所有测试通过，如有问题请询问用户

## Notes

- 任务标记 `*` 为可选测试任务，可以跳过以加快 MVP 开发
- 每个任务都引用了具体的需求编号，确保可追溯性
- Checkpoint 任务确保增量验证，及早发现问题
- 属性测试验证通用正确性属性，单元测试验证具体示例
- 集成测试覆盖端到端用户流程
- 所有代码使用 TypeScript 编写，确保类型安全
