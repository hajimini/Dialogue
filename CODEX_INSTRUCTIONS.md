# Codex 任务指令：Memory System Frontend Integration

## 项目背景

AI Companion 项目已完成 Mem0 记忆系统后端迁移（spec: mem0-memory-migration，Task 1-25 已完成）。现在需要完善前端界面，将新的记忆系统能力展示给用户和管理员。

## 任务目标

实现前端界面集成，包括：
1. **管理后台增强**：性能监控仪表板、记忆详情展示、系统配置管理
2. **用户界面增强**：聊天界面记忆上下文提示、个人记忆查看页面、记忆反馈机制
3. **后端 API 补充**：用户端记忆查看、记忆反馈、搜索测试接口

## Spec 文件位置

```
.kiro/specs/memory-system-frontend-integration/
├── requirements.md  (15 个需求)
├── design.md        (22 个正确性属性)
└── tasks.md         (16 个主要任务组，60+ 个子任务)
```

## 执行指令

请按照以下步骤执行所有任务：

### 1. 阅读 Spec 文档

首先阅读以下文档，理解项目需求和设计：

```bash
# 需求文档（15 个需求）
cat .kiro/specs/memory-system-frontend-integration/requirements.md

# 设计文档（架构、组件、API、数据模型、22 个正确性属性）
cat .kiro/specs/memory-system-frontend-integration/design.md

# 任务列表（16 个主要任务组）
cat .kiro/specs/memory-system-frontend-integration/tasks.md
```

### 2. 执行所有必需任务

按照 tasks.md 中的顺序执行所有**未标记 `*` 的必需任务**（Task 1-16）：

**Phase 1: 数据库准备**
- Task 1: 数据库 Schema 和安全策略设置（5 个子任务）

**Phase 2: 后端开发**
- Task 2: 后端服务层实现（MemoryContextCache、ConfigService、MemoryLogger）
- Task 3: 用户端记忆 API（GET /api/memories、DELETE、POST feedback）
- Task 4: 管理员记忆 API（性能监控、配置管理、搜索测试、操作日志）
- Task 5: 增强 /api/chat 端点返回记忆上下文
- Task 6: Checkpoint - 后端 API 测试验证

**Phase 3: 前端开发**
- Task 7: 前端共享组件开发（MemoryContextPanel、图表组件等）
- Task 8: 管理后台页面开发（性能监控、配置管理、记忆管理增强）
- Task 9: 用户界面页面开发（个人记忆页面、聊天界面增强）
- Task 10: Checkpoint - 前端组件测试验证

**Phase 4: 集成和验证**
- Task 11: 集成 MemoryLogger 到现有记忆操作
- Task 12: 安全审计和访问控制验证
- Task 13: 端到端集成测试（5 个关键流程）
- Task 14: 性能优化和监控验证
- Task 15: 文档和部署准备
- Task 16: Final Checkpoint - 完整系统验证

### 3. 可选任务处理

**标记 `*` 的可选测试任务**可以跳过以加快开发速度，包括：
- Task 2.2, 2.5（服务层属性测试）
- Task 3.2, 3.5（用户端 API 属性测试）
- Task 4.2, 4.6, 4.9（管理员 API 属性测试）
- Task 5.2（/api/chat 属性测试）
- Task 7.2, 7.5（前端组件测试）
- Task 8.2, 8.4, 8.6, 8.8（管理后台页面测试）
- Task 9.2, 9.4（用户界面页面测试）
- Task 11.2（MemoryLogger 集成测试）
- Task 12.4（安全访问控制测试）

如果时间充裕，建议完成这些属性测试以确保系统的通用正确性。

### 4. 关键验证点

在以下 Checkpoint 任务时，必须确保所有测试通过：

**Checkpoint 1 (Task 6)**：
```bash
# 验证后端 API 测试通过
npm run test:api
npm run typecheck
```

**Checkpoint 2 (Task 10)**：
```bash
# 验证前端组件测试通过
npm run test:components
npm run typecheck
```

**Final Checkpoint (Task 16)**：
```bash
# 运行所有测试
npm test
npm run typecheck
npm run lint

# 验证所有 15 个需求的验收标准
# 验证所有 22 个正确性属性通过测试
```

### 5. 测试策略

本项目采用**双重测试方法**：

1. **单元测试**：验证具体示例、边缘情况和错误条件
2. **属性测试**：使用 fast-check 验证通用属性在所有输入下的正确性

属性测试配置：
```bash
# 安装 fast-check
npm install --save-dev fast-check

# 运行属性测试
npm run test:property
```

每个属性测试必须：
- 最少 100 次迭代
- 使用注释标记：`// Feature: memory-system-frontend-integration, Property {number}: {property_text}`
- 引用设计文档中的属性编号

### 6. 代码规范

所有代码必须遵循以下规范：

**TypeScript**：
- 使用严格类型检查
- 所有函数和组件都有类型注解
- 使用 `type` 而非 `interface`（除非需要扩展）

**React 组件**：
- 使用函数组件和 Hooks
- 使用 `"use client"` 标记客户端组件
- 组件文件名使用 PascalCase

**API 端点**：
- 统一的响应格式：`{ success: boolean, data: T | null, error: { message: string } | null }`
- 统一的错误处理
- 所有端点都有身份认证检查

**样式**：
- 使用 Tailwind CSS
- 遵循现有的设计系统（颜色、圆角、阴影等）
- 响应式设计（支持移动端）

### 7. 数据库迁移

执行数据库 Schema 更新：

```bash
# 运行迁移脚本
node scripts/setup-memory-frontend-integration-schema.sql

# 或者手动在 Supabase Dashboard 中执行 SQL
```

新增的表：
- `memory_feedback`：记忆反馈记录
- `memory_config_history`：配置修改历史
- `memory_operation_logs`：操作日志

扩展的表：
- `memories`：添加 `feedback_count_accurate`、`feedback_count_inaccurate`、`retrieval_count` 字段

### 8. 环境变量

更新 `.env.local`，添加以下配置：

```bash
# 记忆上下文缓存开关（默认启用）
MEMORY_CONTEXT_CACHE_ENABLED=true
```

### 9. 依赖安装

安装新增的依赖：

```bash
# 数据可视化库（用于性能监控图表）
npm install recharts

# 属性测试库
npm install --save-dev fast-check

# React Testing Library（如果未安装）
npm install --save-dev @testing-library/react @testing-library/jest-dom
```

### 10. 关键文件清单

执行任务时需要创建或修改的关键文件：

**新增文件**：
```
src/lib/memory/memory-context-cache.ts
src/lib/memory/config-service.ts
src/lib/memory/memory-logger.ts
src/app/api/memories/route.ts
src/app/api/memories/[id]/route.ts
src/app/api/memories/feedback/route.ts
src/app/api/admin/memory-config/route.ts
src/app/api/admin/memory-config/test/route.ts
src/app/api/admin/memories/search/route.ts
src/app/api/admin/memory-logs/route.ts
src/app/admin/memory-performance/page.tsx
src/app/admin/memory-config/page.tsx
src/app/memories/page.tsx
src/components/MemoryContextPanel.tsx
src/components/admin/PerformanceMetricsChart.tsx
src/components/admin/MetricStatsTable.tsx
scripts/setup-memory-frontend-integration-schema.sql
docs/MEMORY_FRONTEND_INTEGRATION.md
```

**修改文件**：
```
src/app/api/chat/route.ts (增强返回记忆上下文)
src/app/admin/layout.tsx (更新导航菜单)
src/app/admin/memories/page.tsx (增强记忆详情展示)
src/app/admin/memories/MemoriesClient.tsx (增强功能)
src/app/chat/[personaId]/ChatWithPersona.tsx (集成 MemoryContextPanel)
src/lib/memory/gateway.ts (集成 MemoryLogger)
.env.example (添加新配置项说明)
docs/API_MEMORY.md (更新 API 文档)
```

### 11. 验收标准

完成所有任务后，系统必须满足：

✅ **功能完整性**：
- 管理后台有 3 个新页面：性能监控、配置管理、增强的记忆管理
- 用户界面有 1 个新页面：个人记忆查看
- 聊天界面集成记忆上下文展示
- 所有 API 端点正常工作

✅ **测试覆盖**：
- 所有单元测试通过（>= 80% 覆盖率）
- 所有 22 个正确性属性都有对应的属性测试（如果执行可选测试任务）
- 所有 5 个端到端集成测试通过

✅ **代码质量**：
- TypeScript 编译通过（`npm run typecheck`）
- ESLint 检查通过（`npm run lint`）
- 无编译错误和类型错误

✅ **安全性**：
- Supabase RLS 策略生效
- 用户只能访问自己的记忆数据
- 所有 API 都有身份认证和权限检查

✅ **性能**：
- 缓存机制生效，缓存命中率 > 50%
- 记忆检索响应时间 < 2 秒
- 性能监控数据准确

✅ **文档**：
- 数据库迁移脚本完整
- 环境变量文档更新
- 功能使用文档完整
- API 文档更新

## 执行建议

1. **按阶段执行**：先完成数据库准备，再做后端 API，最后做前端界面
2. **增量验证**：每完成一个 Checkpoint 任务，运行测试确保没有问题
3. **遇到问题及时反馈**：如果某个任务不清楚或遇到技术障碍，及时询问
4. **保持代码质量**：每个任务完成后运行 `npm run typecheck` 和 `npm run lint`
5. **可选任务灵活处理**：如果时间紧张，可以跳过标记 `*` 的可选测试任务

## 参考资源

- **后端记忆系统设计**：`.kiro/specs/mem0-memory-migration/design.md`
- **现有记忆 API**：`src/app/api/admin/memories/route.ts`
- **现有记忆管理页面**：`src/app/admin/memories/MemoriesClient.tsx`
- **现有聊天界面**：`src/app/chat/[personaId]/ChatWithPersona.tsx`
- **MemoryGateway 接口**：`src/lib/memory/gateway.ts`
- **MemoryMetrics 服务**：`src/lib/memory/metrics.ts`

## 开始执行

请从 Task 1 开始，按顺序执行所有必需任务。每完成一个任务，更新 tasks.md 中的任务状态（将 `[ ]` 改为 `[x]`）。

祝顺利！有任何问题随时反馈。
