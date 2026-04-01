# 多角色系统实现总结

**日期**: 2026-03-29
**功能**: 多角色对话系统 + Line 聊天记录导入

## 概述

实现了一个完整的多角色系统，允许用户在一个账号下创建多个虚拟角色，每个角色可以独立与 AI 人设进行对话，拥有独立的对话历史和记忆。同时支持导入 Line 聊天记录。

## 核心功能

### 1. 角色管理系统

**数据库表**: `user_characters`
- `id`: UUID 主键
- `owner_id`: 用户 ID（外键）
- `name`: 角色名称
- `personality`: 人格描述
- `avatar_url`: 头像 URL
- `bio`: 角色简介
- `is_active`: 是否激活（软删除标记）
- `created_at`: 创建时间

**API 路由**: `/api/characters`
- `GET`: 获取当前用户的所有角色
- `POST`: 创建新角色
- `PUT`: 更新角色信息
- `DELETE`: 软删除角色（设置 `is_active = false`）

**管理页面**: `/characters`
- 角色列表展示
- 创建新角色表单
- 删除角色功能
- 选择角色并返回对话

### 2. 会话关联角色

**数据库修改**:
- `sessions` 表添加 `character_id` 字段
- `memories` 表添加 `character_id` 字段（预留，用于未来角色记忆隔离）

**会话创建流程**:
```typescript
// src/lib/chat/sessions.ts
export async function createSession(
  personaId: string,
  options?: { userId?: string; characterId?: string }
)
```

### 3. 新会话对话框

**组件**: `src/components/NewSessionDialog.tsx`

**功能**:
- 角色选择下拉框（从 `/api/characters` 加载）
- 可选的 Line 聊天记录文件上传
- 记住上次选择的角色（localStorage）
- 创建普通会话或导入会话

**集成位置**: 聊天界面的"新会话"按钮

### 4. Line 聊天记录导入

**API 路由**: `/api/chat/import`

**支持格式**:
```
04:13 用户名 消息内容
04:14 芷晴秋葉🍂 回复内容
04:15 用户名 继续对话
```

**解析逻辑**:
- 正则匹配: `^(\d{2}:\d{2})\s+(.+?)\s+(.+)$`
- 根据发送者名称判断角色（包含人设名称 = assistant，否则 = user）
- 自动过滤"貼圖"、"圖片"、"照片"等非文字消息
- 批量插入到数据库

**导入流程**:
1. 用户选择角色和上传文件
2. 解析文件内容
3. 创建新会话
4. 批量插入消息记录
5. 跳转到新会话

## 文件修改清单

### 新增文件

1. **数据库迁移**
   - `supabase/migrations/007_user_characters.sql`
   - 创建 `user_characters` 表
   - 为 `sessions` 和 `memories` 添加 `character_id` 字段

2. **API 路由**
   - `src/app/api/characters/route.ts` - 角色 CRUD
   - `src/app/api/chat/import/route.ts` - Line 聊天导入

3. **页面组件**
   - `src/app/characters/page.tsx` - 角色管理页面
   - `src/components/NewSessionDialog.tsx` - 新会话对话框
   - `src/components/CharacterSelector.tsx` - 角色选择器（测试页面用）
   - `src/app/test-character/page.tsx` - 测试页面

### 修改文件

1. **聊天界面**
   - `src/app/chat/[personaId]/ChatWithPersona.tsx`
   - 集成 NewSessionDialog 组件
   - 修改 `handleCreateSession` 支持角色和文件参数
   - "新会话"按钮打开对话框而非直接创建

2. **会话管理**
   - `src/lib/chat/sessions.ts`
   - `createSession` 函数支持 `characterId` 参数
   - `src/app/api/personas/[id]/sessions/route.ts`
   - POST 接口接受 `character_id` 参数

3. **角色页面路由修复**
   - `src/app/characters/page.tsx`
   - 修复 `/chat` 不存在的路由问题
   - 改为返回上一页或首页

## 技术要点

### 1. UUID 问题修复

**问题**: 角色 API 使用 `user.id` 可能是 "demo-local-user" 字符串，不是有效 UUID

**解决方案**:
```typescript
// 使用 admin client 和真实 UUID
const supabase = getSupabaseAdminClient();
const userId = await getOrCreateDemoUserId();
```

### 2. localStorage 持久化

角色选择会保存到 localStorage:
```typescript
localStorage.setItem(`selected_character_${personaId}`, characterId);
```

每次打开对话框时自动恢复上次选择。

### 3. 文件上传处理

使用 FormData 上传文件:
```typescript
const formData = new FormData();
formData.append("file", file);
formData.append("personaId", personaId);
formData.append("characterId", characterId);
formData.append("personaName", personaName);
```

### 4. 对话框状态管理

```typescript
const [showNewSessionDialog, setShowNewSessionDialog] = useState(false);

// 打开对话框
<button onClick={() => setShowNewSessionDialog(true)}>新会话</button>

// 对话框组件
<NewSessionDialog
  isOpen={showNewSessionDialog}
  onClose={() => setShowNewSessionDialog(false)}
  onCreateSession={handleCreateSession}
  personaId={persona.id}
  personaName={persona.name}
/>
```

## 用户流程

### 创建角色并开始对话

1. 点击聊天界面的"新会话"按钮
2. 在弹出的对话框中选择或创建角色
3. （可选）上传 Line 聊天记录
4. 点击"创建会话"或"导入并创建"
5. 开始与 AI 人设对话

### 管理角色

1. 在对话框中点击"管理角色"链接
2. 跳转到 `/characters` 页面
3. 创建、查看、删除角色
4. 点击"返回"回到对话界面

## 数据隔离

- **会话隔离**: 每个角色的会话通过 `character_id` 关联
- **记忆隔离**: 预留 `memories.character_id` 字段，未来可实现角色级别的记忆隔离
- **用户隔离**: 所有角色通过 `owner_id` 关联到用户

## 测试建议

1. **创建角色**: 测试创建不同人格的角色
2. **会话创建**: 测试为不同角色创建会话
3. **Line 导入**: 测试导入真实的 Line 聊天记录
4. **角色切换**: 测试在不同角色间切换对话
5. **记忆隔离**: 验证不同角色的对话和记忆是否独立

## 已知问题

1. **记忆系统未完全隔离**: 当前记忆系统尚未按角色隔离，需要后续实现
2. **导入时间戳**: Line 导入的时间戳只有时分，没有日期信息
3. **文件格式限制**: 仅支持 Line 的特定文本格式

## 后续优化方向

1. **记忆隔离**: 实现基于 `character_id` 的记忆查询和存储
2. **角色头像**: 支持上传和显示角色头像
3. **导入格式**: 支持更多聊天平台的导出格式（微信、Telegram 等）
4. **批量操作**: 支持批量导入多个对话文件
5. **角色模板**: 提供预设的角色人格模板
6. **统计信息**: 显示每个角色的对话数量、消息数等统计

## 相关文档

- 数据库 Schema: `supabase/migrations/007_user_characters.sql`
- API 文档: 见各 API 路由文件的注释
- 组件文档: 见组件文件的 TypeScript 类型定义
