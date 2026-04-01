# Requirements Document

## Introduction

本需求文档定义了 AI Companion 前端界面集成 Mem0 记忆系统的功能需求。后端已完成 Mem0 记忆系统迁移（包括 MemoryGateway 抽象层、Mem0Adapter、EmbeddingService、RerankerService、性能监控等），现需要在前端界面中展示这些新能力，提升用户体验和管理效率。

系统现有前端包括：
- 管理后台（/admin）：Dashboard、Personas、Conversations、Memories、Prompts、Testing
- 用户界面：聊天页面（/chat/[personaId]）、登录/注册页面
- API 端点：/api/admin/memories、/api/admin/memory-metrics、/api/chat

本次需求涵盖三个方向：
1. 管理后台增强：记忆性能监控、记忆详情展示、系统配置管理
2. 用户界面增强：记忆上下文提示、个人记忆查看、记忆反馈机制
3. 后端 API 补充：用户端记忆查看、记忆反馈、实时监控

## Glossary

- **Memory_System**: Mem0 记忆系统，包括 MemoryGateway、Mem0Adapter、EmbeddingService、RerankerService
- **Admin_Console**: 管理后台，路径为 /admin，仅管理员可访问
- **User_Interface**: 用户界面，包括聊天页面和个人记忆页面
- **Memory_Metrics**: 记忆系统性能指标，包括响应时间、embedding 耗时、reranker 耗时等
- **Memory_Context**: 记忆上下文，包括用户画像、相关记忆、会话摘要
- **Embedding_Vector**: 文本向量，由 EmbeddingService 生成
- **Reranker_Score**: 重排序分数，由 RerankerService 计算
- **Memory_Feedback**: 用户对记忆准确性的反馈
- **Performance_Dashboard**: 性能监控仪表板，展示 Memory_Metrics 数据

## Requirements

### Requirement 1: 管理后台 - 记忆性能监控仪表板

**User Story:** 作为管理员，我希望查看记忆系统的性能指标，以便监控系统健康状况和识别性能瓶颈。

#### Acceptance Criteria

1. THE Admin_Console SHALL 提供一个新的 /admin/memory-performance 页面
2. WHEN 管理员访问 Performance_Dashboard 时，THE System SHALL 展示以下性能指标：
   - memory.add.duration（记忆添加耗时）
   - memory.search.duration（记忆搜索耗时）
   - memory.update.duration（记忆更新耗时）
   - memory.delete.duration（记忆删除耗时）
   - embedding.duration（embedding 生成耗时）
   - reranker.duration（reranker 重排序耗时）
3. FOR ALL 性能指标，THE Performance_Dashboard SHALL 展示以下统计数据：
   - count（操作次数）
   - mean（平均值）
   - median（中位数）
   - p95（95 百分位）
   - p99（99 百分位）
   - min（最小值）
   - max（最大值）
4. THE Performance_Dashboard SHALL 使用图表可视化展示性能趋势
5. THE Performance_Dashboard SHALL 提供"重置指标"按钮，调用 DELETE /api/admin/memory-metrics
6. WHEN 某个操作耗时超过 2000ms 时，THE Performance_Dashboard SHALL 高亮显示该指标为慢查询
7. THE Performance_Dashboard SHALL 每 30 秒自动刷新数据

### Requirement 2: 管理后台 - 记忆详情增强展示

**User Story:** 作为管理员，我希望查看记忆的详细技术信息（embedding 向量、相似度分数、reranker 结果等），以便调试和优化记忆系统。

#### Acceptance Criteria

1. WHEN 管理员在 /admin/memories 页面查看记忆列表时，THE System SHALL 为每条记忆展示以下额外信息：
   - embedding_provider（embedding 提供商：openai 或 bge-m3）
   - embedding_model（embedding 模型名称）
   - embedding_dimension（向量维度）
   - created_at（创建时间）
   - source_session_id（来源会话 ID）
2. THE System SHALL 提供"查看向量"按钮，点击后展示 Embedding_Vector 的前 10 个维度值
3. WHEN 管理员执行记忆搜索时，THE System SHALL 为每条搜索结果展示：
   - similarity_score（向量相似度分数）
   - reranker_score（重排序分数，如果启用）
   - final_rank（最终排名）
4. THE System SHALL 提供"测试检索"功能，允许管理员输入查询文本并查看检索结果及其分数
5. THE System SHALL 在记忆详情中展示该记忆被检索的历史次数（retrieval_count）

### Requirement 3: 管理后台 - 记忆系统配置管理

**User Story:** 作为管理员，我希望在界面中查看和修改记忆系统配置（embedding provider、reranker provider 等），以便灵活调整系统行为。

#### Acceptance Criteria

1. THE Admin_Console SHALL 提供一个新的 /admin/memory-config 页面
2. THE Memory_Config_Page SHALL 展示以下当前配置：
   - MEMORY_PROVIDER（mem0 或 letta）
   - EMBEDDING_PROVIDER（openai 或 bge-m3）
   - EMBEDDING_MODEL（模型名称）
   - RERANKER_PROVIDER（jina、cohere 或 none）
3. THE Memory_Config_Page SHALL 提供表单允许管理员修改配置
4. WHEN 管理员提交配置修改时，THE System SHALL 验证配置有效性（如 API key 是否有效）
5. WHEN 配置修改成功后，THE System SHALL 显示成功提示并要求重启应用以生效
6. THE Memory_Config_Page SHALL 提供"测试连接"按钮，验证 embedding 和 reranker API 是否可用
7. THE Memory_Config_Page SHALL 展示配置修改历史记录（最近 10 条）

### Requirement 4: 用户界面 - 聊天界面记忆上下文提示

**User Story:** 作为用户，我希望在聊天界面中看到 AI 记住了哪些关于我的信息，以便了解对话上下文并建立信任。

#### Acceptance Criteria

1. THE Chat_Interface SHALL 在聊天输入框上方展示"记忆上下文"区域
2. WHEN 用户发送消息后，THE System SHALL 在 Memory_Context 区域展示本次对话使用的记忆：
   - 相关记忆条目（最多 3 条）
   - 用户画像摘要（如果存在）
3. THE Memory_Context 区域 SHALL 使用折叠面板，默认折叠，用户可点击展开
4. FOR ALL 展示的记忆条目，THE System SHALL 显示：
   - 记忆内容
   - 记忆类型（user_fact、shared_event 等）
   - 相似度分数（0-1）
5. THE Memory_Context 区域 SHALL 提供"这条记忆不准确"按钮，允许用户反馈错误记忆
6. WHEN 用户点击"这条记忆不准确"时，THE System SHALL 记录反馈并在下次检索时降低该记忆的权重

### Requirement 5: 用户界面 - 个人记忆查看页面

**User Story:** 作为用户，我希望查看 AI 记住了关于我的所有信息，以便了解我的数据并管理隐私。

#### Acceptance Criteria

1. THE User_Interface SHALL 提供一个新的 /memories 页面（用户端）
2. THE Personal_Memories_Page SHALL 展示当前用户在所有人设中的记忆列表
3. THE Personal_Memories_Page SHALL 支持按人设筛选记忆
4. THE Personal_Memories_Page SHALL 支持按记忆类型筛选（user_fact、shared_event 等）
5. FOR ALL 记忆条目，THE Personal_Memories_Page SHALL 显示：
   - 记忆内容
   - 记忆类型
   - 关联人设
   - 创建时间
   - 来源会话（如果有）
6. THE Personal_Memories_Page SHALL 提供"删除记忆"按钮，允许用户删除不准确或不想保留的记忆
7. THE Personal_Memories_Page SHALL 提供搜索功能，允许用户搜索记忆内容

### Requirement 6: 用户界面 - 记忆反馈机制

**User Story:** 作为用户，我希望能够纠正 AI 的错误记忆，以便提高对话质量和准确性。

#### Acceptance Criteria

1. WHEN 用户在 Chat_Interface 或 Personal_Memories_Page 中标记记忆为"不准确"时，THE System SHALL 创建一条 Memory_Feedback 记录
2. THE Memory_Feedback 记录 SHALL 包含以下字段：
   - user_id（用户 ID）
   - memory_id（记忆 ID）
   - feedback_type（accurate 或 inaccurate）
   - feedback_reason（可选，用户填写的原因）
   - created_at（反馈时间）
3. WHEN Memory_Feedback 标记为 inaccurate 时，THE System SHALL 在记忆检索时降低该记忆的 importance 权重（乘以 0.5）
4. THE System SHALL 在 Admin_Console 的 /admin/memories 页面展示记忆的反馈统计（准确/不准确次数）
5. THE System SHALL 提供 API 端点 POST /api/memories/feedback 用于提交反馈
6. WHEN 某条记忆收到 3 次以上"不准确"反馈时，THE System SHALL 在 Admin_Console 中高亮显示该记忆需要人工审核

### Requirement 7: 后端 API - 用户端记忆查看接口

**User Story:** 作为开发者，我需要提供用户端记忆查看 API，以便用户界面展示个人记忆数据。

#### Acceptance Criteria

1. THE System SHALL 提供 GET /api/memories 端点（用户端，非 admin）
2. THE API SHALL 要求用户身份认证（通过 session）
3. THE API SHALL 返回当前用户的所有记忆列表
4. THE API SHALL 支持以下查询参数：
   - persona_id（可选，按人设筛选）
   - memory_type（可选，按类型筛选）
   - limit（可选，限制返回数量，默认 50）
   - offset（可选，分页偏移，默认 0）
5. THE API SHALL 返回以下字段：
   - memories（记忆数组）
   - total_count（总数量）
   - has_more（是否有更多数据）
6. THE API SHALL 仅返回当前用户的记忆，不得泄露其他用户数据
7. THE API SHALL 按 updated_at 降序排序记忆

### Requirement 8: 后端 API - 记忆反馈接口

**User Story:** 作为开发者，我需要提供记忆反馈 API，以便用户提交记忆准确性反馈。

#### Acceptance Criteria

1. THE System SHALL 提供 POST /api/memories/feedback 端点
2. THE API SHALL 要求用户身份认证
3. THE API SHALL 接受以下请求参数：
   - memory_id（必填，记忆 ID）
   - feedback_type（必填，accurate 或 inaccurate）
   - feedback_reason（可选，反馈原因文本）
4. THE API SHALL 验证 memory_id 属于当前用户
5. WHEN 反馈提交成功时，THE API SHALL 返回 success: true
6. THE API SHALL 将反馈记录存储到 memory_feedback 表
7. THE API SHALL 在反馈为 inaccurate 时，更新 memories 表中的 importance 字段（乘以 0.5）

### Requirement 9: 后端 API - 记忆搜索测试接口

**User Story:** 作为管理员，我需要测试记忆检索功能，以便调试和优化检索质量。

#### Acceptance Criteria

1. THE System SHALL 提供 POST /api/admin/memories/search 端点
2. THE API SHALL 要求管理员身份认证
3. THE API SHALL 接受以下请求参数：
   - user_id（必填）
   - persona_id（必填）
   - query（必填，查询文本）
   - limit（可选，默认 5）
4. THE API SHALL 调用 MemoryGateway.search() 执行检索
5. THE API SHALL 返回以下详细信息：
   - memories（检索结果数组）
   - embedding_time（embedding 生成耗时）
   - search_time（向量搜索耗时）
   - rerank_time（reranker 耗时，如果启用）
   - total_time（总耗时）
6. FOR ALL 检索结果，THE API SHALL 返回：
   - memory（记忆对象）
   - similarity_score（向量相似度）
   - reranker_score（重排序分数，如果启用）
   - final_rank（最终排名）

### Requirement 10: 数据库 Schema - 记忆反馈表

**User Story:** 作为开发者，我需要存储用户的记忆反馈数据，以便优化记忆系统。

#### Acceptance Criteria

1. THE System SHALL 创建 memory_feedback 表，包含以下字段：
   - id（UUID，主键）
   - user_id（TEXT，用户 ID）
   - memory_id（UUID，记忆 ID，外键）
   - feedback_type（TEXT，accurate 或 inaccurate）
   - feedback_reason（TEXT，可选）
   - created_at（TIMESTAMPTZ，创建时间）
2. THE memory_feedback 表 SHALL 创建索引 idx_memory_feedback_memory_id ON memory_feedback(memory_id)
3. THE memory_feedback 表 SHALL 创建索引 idx_memory_feedback_user_id ON memory_feedback(user_id)
4. THE System SHALL 在 memories 表中添加 feedback_count_accurate 字段（INTEGER，默认 0）
5. THE System SHALL 在 memories 表中添加 feedback_count_inaccurate 字段（INTEGER，默认 0）
6. WHEN 用户提交反馈时，THE System SHALL 更新 memories 表中的对应计数字段

### Requirement 11: 管理后台 - 导航菜单更新

**User Story:** 作为管理员，我希望在导航菜单中看到新增的记忆性能和配置页面入口，以便快速访问。

#### Acceptance Criteria

1. THE Admin_Console 导航菜单 SHALL 在"记忆"菜单项下添加子菜单：
   - "记忆管理"（/admin/memories）
   - "性能监控"（/admin/memory-performance）
   - "系统配置"（/admin/memory-config）
2. THE User_Interface 侧边栏 SHALL 添加"我的记忆"菜单项，链接到 /memories
3. THE 导航菜单 SHALL 使用图标区分不同功能模块
4. WHEN 用户在某个页面时，THE 导航菜单 SHALL 高亮显示当前页面对应的菜单项

### Requirement 12: 性能优化 - 记忆上下文缓存

**User Story:** 作为开发者，我希望缓存记忆上下文数据，以便减少重复的 embedding 和检索操作，提升响应速度。

#### Acceptance Criteria

1. THE System SHALL 在用户会话期间缓存 Memory_Context 数据
2. THE 缓存 SHALL 使用 session_id + message_count 作为缓存键
3. WHEN 用户在同一会话中连续发送消息时，THE System SHALL 复用最近 3 条消息的 Memory_Context
4. THE 缓存 SHALL 在会话结束或超过 30 分钟后失效
5. THE System SHALL 在记忆被修改（添加、更新、删除）时清除相关缓存
6. THE System SHALL 提供环境变量 MEMORY_CONTEXT_CACHE_ENABLED（默认 true）控制缓存开关

### Requirement 13: 用户体验 - 记忆加载状态提示

**User Story:** 作为用户，我希望在记忆加载时看到明确的加载状态提示，以便了解系统正在处理。

#### Acceptance Criteria

1. WHEN 用户发送消息时，THE Chat_Interface SHALL 在 Memory_Context 区域显示"正在检索相关记忆..."
2. WHEN 记忆检索完成时，THE System SHALL 显示"已加载 N 条相关记忆"
3. WHEN 记忆检索失败时，THE System SHALL 显示错误提示"记忆加载失败，将使用基础上下文"
4. THE Personal_Memories_Page SHALL 在加载记忆列表时显示骨架屏（skeleton screen）
5. THE Performance_Dashboard SHALL 在刷新数据时显示加载指示器
6. THE 加载状态提示 SHALL 使用动画效果提升用户体验

### Requirement 14: 安全性 - 记忆数据访问控制

**User Story:** 作为系统架构师，我需要确保用户只能访问自己的记忆数据，防止数据泄露。

#### Acceptance Criteria

1. THE System SHALL 在所有用户端记忆 API 中验证 user_id 与当前登录用户匹配
2. THE System SHALL 在 Supabase RLS（Row Level Security）中配置 memories 表的访问策略：
   - 用户只能读取 user_id = auth.uid() 的记忆
   - 用户只能删除 user_id = auth.uid() 的记忆
3. THE System SHALL 在 memory_feedback 表中配置 RLS 策略：
   - 用户只能创建 user_id = auth.uid() 的反馈
   - 用户只能读取 user_id = auth.uid() 的反馈
4. THE Admin_Console SHALL 使用 service_key 绕过 RLS，访问所有用户数据
5. THE System SHALL 记录所有记忆访问日志（audit log），包括 user_id、操作类型、时间戳
6. WHEN 检测到异常访问模式时（如短时间内大量读取），THE System SHALL 触发安全警报

### Requirement 15: 可观测性 - 记忆操作日志

**User Story:** 作为运维人员，我希望记录所有记忆操作的详细日志，以便排查问题和审计。

#### Acceptance Criteria

1. THE System SHALL 记录以下记忆操作日志：
   - memory.add（添加记忆）
   - memory.search（搜索记忆）
   - memory.update（更新记忆）
   - memory.delete（删除记忆）
   - memory.feedback（反馈记忆）
2. FOR ALL 操作日志，THE System SHALL 记录以下字段：
   - timestamp（时间戳）
   - operation（操作类型）
   - user_id（用户 ID）
   - persona_id（人设 ID，如果适用）
   - memory_id（记忆 ID，如果适用）
   - duration（操作耗时）
   - success（是否成功）
   - error_message（错误信息，如果失败）
3. THE System SHALL 将日志输出到标准输出（stdout），格式为 JSON
4. THE System SHALL 提供 GET /api/admin/memory-logs 端点，允许管理员查询最近的操作日志
5. THE Admin_Console SHALL 在 Performance_Dashboard 中展示操作日志的统计图表（成功率、失败率、操作类型分布）
