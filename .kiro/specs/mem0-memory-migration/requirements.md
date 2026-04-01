# Requirements Document

## Introduction

本需求文档定义了从当前自实现RAG记忆系统迁移到Mem0记忆引擎的功能需求。当前系统存在上下文衔接问题（"牛头不对马嘴"），特别是在处理中文指代词（如"那个展""那只猫"）时，系统无法自然延续对话，而是生硬地反问用户。本次迁移通过引入Mem0记忆引擎、MemoryGateway抽象层、中文优化的embedding和reranker，解决记忆检索准确性和上下文衔接自然度问题。

## Glossary

- **Memory_System**: 整个记忆管理系统，包括存储、检索、更新等功能
- **MemoryGateway**: 记忆系统的抽象接口层，隔离具体实现（Mem0/Letta）与业务代码
- **Mem0**: 第三方记忆引擎，提供向量存储、语义检索、记忆管理等能力
- **Supabase_pgvector**: PostgreSQL向量扩展，用于统一存储记忆向量
- **Embedding_Service**: 文本向量化服务，支持OpenAI或BAAI/bge-m3模型
- **Reranker**: 重排序服务，用于优化检索结果相关性（Jina或Cohere）
- **Current_RAG**: 当前自实现的检索增强生成系统（OpenRouter embedding + 自定义加权检索）
- **Continuation_Context**: 对话延续上下文，指用户使用指代词（"那个""那只"）时需要的历史信息
- **Referential_Anchor**: 指代锚点，如"那只猫""那个展"等短语，用于识别对话延续意图
- **Chat_API**: 聊天接口，位于 /api/chat/route.ts
- **Persona**: 对话角色/人设
- **C_Category_Tests**: C类测试用例，专门测试记忆衔接场景（如"那只猫今天又来了"）

## Requirements

### Requirement 1: MemoryGateway抽象层

**User Story:** 作为系统架构师，我希望通过MemoryGateway抽象层隔离记忆引擎实现，以便未来可以在Mem0和Letta之间切换而不影响业务代码。

#### Acceptance Criteria

1. THE MemoryGateway SHALL定义统一的记忆操作接口，包括add、search、update、delete方法
2. THE MemoryGateway SHALL支持通过配置切换底层实现（Mem0或未来的Letta）
3. WHEN Chat_API调用记忆检索时，THE MemoryGateway SHALL返回标准化的记忆结果格式
4. THE MemoryGateway SHALL保持与现有代码的接口兼容性，使得getMemoryContext函数可以无缝切换
5. THE MemoryGateway SHALL隔离Mem0特定的配置和初始化逻辑

### Requirement 2: Mem0集成

**User Story:** 作为开发者，我希望集成Mem0 Node SDK作为核心记忆引擎，以便利用其成熟的向量检索和记忆管理能力。

#### Acceptance Criteria

1. THE Memory_System SHALL使用Mem0 Node SDK进行记忆的存储和检索
2. THE Memory_System SHALL配置Mem0使用Supabase_pgvector作为向量存储后端
3. WHEN 保存记忆时，THE Memory_System SHALL通过Mem0 API将记忆内容、元数据和向量存储到Supabase
4. WHEN 检索记忆时，THE Memory_System SHALL通过Mem0 API执行语义搜索并返回相关记忆
5. THE Memory_System SHALL保留现有的记忆类型分类（user_fact、persona_fact、shared_event、relationship、session_summary）

### Requirement 3: 中文优化的Embedding配置

**User Story:** 作为系统运维者，我希望配置中文友好的embedding模型，以便提升中文文本的语义理解和检索准确性。

#### Acceptance Criteria

1. THE Embedding_Service SHALL支持配置OpenAI text-embedding-3-large模型
2. THE Embedding_Service SHALL支持配置BAAI/bge-m3中文优化模型
3. WHEN 环境变量EMBEDDING_MODEL设置为text-embedding-3-large时，THE Embedding_Service SHALL使用OpenAI embedding API
4. WHEN 环境变量EMBEDDING_MODEL设置为bge-m3时，THE Embedding_Service SHALL使用对应的embedding服务
5. THE Embedding_Service SHALL在embedding API失败时提供降级方案

### Requirement 4: Reranker集成

**User Story:** 作为AI工程师，我希望在记忆检索后应用reranker，以便提升检索结果的相关性排序准确度。

#### Acceptance Criteria

1. THE Memory_System SHALL在向量检索后应用Reranker对结果进行重排序
2. THE Memory_System SHALL支持配置Jina Reranker
3. THE Memory_System SHALL支持配置Cohere Reranker
4. WHEN 环境变量RERANKER_PROVIDER设置为jina时，THE Memory_System SHALL使用Jina reranking API
5. WHEN 环境变量RERANKER_PROVIDER设置为cohere时，THE Memory_System SHALL使用Cohere reranking API
6. IF Reranker API调用失败，THEN THE Memory_System SHALL降级使用原始向量检索结果

### Requirement 5: 延续上下文检索优化

**User Story:** 作为用户，当我说"那个展""那只猫"等指代词时，我希望系统能自然延续对话，而不是反问"哪个展？"。

#### Acceptance Criteria

1. WHEN 用户输入包含Referential_Anchor（如"那个""那只""那家"），THE Memory_System SHALL提升相关历史记忆的检索权重
2. WHEN 用户输入包含延续线索词（如"后来""结果""又"），THE Memory_System SHALL优先检索最近的相关记忆
3. THE Memory_System SHALL使用Reranker对包含Referential_Anchor的查询结果进行精确重排序
4. WHEN 检索到唯一的高相关性记忆时，THE Memory_System SHALL将该记忆置于Continuation_Context的顶部
5. THE Memory_System SHALL保留现有的recency boost和importance weighting机制

### Requirement 6: 记忆存储迁移

**User Story:** 作为系统管理员，我希望将现有的本地JSON记忆数据迁移到Supabase pgvector，以便统一存储并支持高效的向量检索。

#### Acceptance Criteria

1. THE Memory_System SHALL提供迁移脚本，将.data/app-store.json中的记忆数据导入到Supabase
2. WHEN 执行迁移时，THE Memory_System SHALL保留所有现有记忆的内容、类型、重要性、时间戳等元数据
3. WHEN 执行迁移时，THE Memory_System SHALL为每条记忆重新生成embedding向量（使用新的Embedding_Service）
4. THE Memory_System SHALL在迁移完成后验证数据完整性（记录数量、必填字段）
5. THE Memory_System SHALL支持迁移回滚机制，在失败时恢复原始数据

### Requirement 7: 向后兼容性

**User Story:** 作为开发者，我希望迁移过程不破坏现有功能，以便保持系统稳定性和测试体系的有效性。

#### Acceptance Criteria

1. THE Memory_System SHALL保持getMemoryContext函数的输入输出接口不变
2. THE Memory_System SHALL保持saveSessionMemories函数的输入输出接口不变
3. THE Memory_System SHALL继续支持现有的UserProfile结构（summary、facts、preferences、relationship_notes、recent_topics、anchors）
4. THE Memory_System SHALL继续支持现有的记忆类型（user_fact、persona_fact、shared_event、relationship、session_summary）
5. THE Memory_System SHALL保持与Chat_API的集成方式不变

### Requirement 8: C类测试验证

**User Story:** 作为QA工程师，我希望使用现有C类测试用例验证迁移效果，以便量化评估上下文衔接改善程度。

#### Acceptance Criteria

1. THE Memory_System SHALL通过C01测试用例（"那只猫今天又来了"）
2. THE Memory_System SHALL通过C09测试用例（"我今天去看了那个展"）
3. WHEN 运行C类测试时，THE Memory_System SHALL不再出现"哪个XX？"类型的反问
4. THE Memory_System SHALL在C类测试中展现自然的对话延续能力
5. THE Memory_System SHALL保持C类测试的通过率达到90%以上

### Requirement 9: 配置管理

**User Story:** 作为系统运维者，我希望通过环境变量灵活配置记忆系统参数，以便在不同环境中调优性能。

#### Acceptance Criteria

1. THE Memory_System SHALL支持通过环境变量MEM0_API_KEY配置Mem0访问凭证
2. THE Memory_System SHALL支持通过环境变量EMBEDDING_MODEL配置embedding模型选择
3. THE Memory_System SHALL支持通过环境变量RERANKER_PROVIDER配置reranker提供商
4. THE Memory_System SHALL支持通过环境变量MEMORY_RETRIEVAL_LIMIT配置检索结果数量上限
5. THE Memory_System SHALL在配置缺失时提供合理的默认值（如MEMORY_RETRIEVAL_LIMIT默认为5）

### Requirement 10: 知识检索职责分离

**User Story:** 作为架构师，我希望明确区分记忆检索和外部知识检索的职责，以便保持系统模块化和可维护性。

#### Acceptance Criteria

1. THE Memory_System SHALL仅负责用户个人记忆和对话历史的检索
2. THE Memory_System SHALL不包含外部知识库（如百科、文档）的检索逻辑
3. THE MemoryGateway接口 SHALL不暴露知识检索相关的方法
4. THE Memory_System SHALL为未来的知识检索模块预留集成点（通过独立的KnowledgeGateway）
5. THE Chat_API SHALL继续仅调用Memory_System，不引入知识检索链路

### Requirement 11: Persona系统保留

**User Story:** 作为产品经理，我希望保留现有的persona系统和身份一致性检查，以便维持角色扮演的质量。

#### Acceptance Criteria

1. THE Memory_System SHALL继续使用filterConflictingPersonaMemories过滤与persona身份冲突的记忆
2. THE Memory_System SHALL继续使用sanitizeAssistantHistory清理历史消息中的身份冲突
3. THE Memory_System SHALL在保存记忆时应用cleanConflictingPersonaSentences清理冲突内容
4. THE Memory_System SHALL保持buildCanonicalIdentityLines生成的规范身份信息在prompt中的使用
5. THE Memory_System SHALL继续支持relationship_stage跟踪（new、warming、close）

### Requirement 12: 性能监控

**User Story:** 作为系统运维者，我希望监控记忆检索的性能指标，以便识别性能瓶颈和优化机会。

#### Acceptance Criteria

1. THE Memory_System SHALL记录每次记忆检索的响应时间
2. THE Memory_System SHALL记录embedding API的调用延迟
3. THE Memory_System SHALL记录reranker API的调用延迟
4. WHEN 记忆检索总时间超过2秒时，THE Memory_System SHALL记录警告日志
5. THE Memory_System SHALL提供性能统计接口，返回平均检索时间、P95延迟等指标
