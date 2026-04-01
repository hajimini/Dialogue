# 2026-03-29 工作总结

## 一、记忆系统错误修复

### 问题
记忆系统在查询时因 UUID 格式不匹配导致报错：
```
invalid input syntax for type uuid: \"demo-local-user\"
```
根本原因：角色相关 API 使用了 `getSupabaseServerClient()` + `user.id`，而 demo 模式下 `user.id` 是字符串 `\"demo-local-user\"`，不是合法 UUID，导致 Postgres 报错。

### 修复方案
将 `src/app/api/characters/route.ts` 的所有方法（GET / POST / DELETE）改为：
- `getSupabaseAdminClient()` — 使用 service role 绕过 RLS
- `getOrCreateDemoUserId()` — 获取数据库中真实的 demo 用户 UUID

---

## 二、多角色（Character）系统实现

### 背景
原来系统只支持单一人设（Persona），无法区分对话对象（角色）。新增 Character 系统，让用户可以管理多个虚拟角色，并在创建会话时选择对话对象。

### 核心改动

#### `src/components/NewSessionDialog.tsx`（新增）
新会话创建对话框：
- 从 `/api/characters` 加载用户角色列表
- 角色选择下拉框，`localStorage` 记住上次选择
- 可选上传 Line 聊天记录（`.txt`）进行导入
- 无角色时引导跳转至角色管理页

#### `src/app/chat/[personaId]/ChatWithPersona.tsx`
- 导入 `NewSessionDialog` 组件
- 新增 `showNewSessionDialog` 状态
- \"新会话\" 按钮改为打开对话框，不再直接创建
- `handleCreateSession(characterId, file?)` 支持两种模式：
  - 普通创建：POST `/api/personas/[id]/sessions` 带 `character_id`
  - 导入创建：POST `/api/chat/import` 带文件 + `characterId`
- 初始化时和删除后检测到无会话，也改为弹出对话框而非直接创建

#### `src/app/api/personas/[id]/sessions/route.ts`
- POST 方法从请求体读取可选的 `character_id` 字段

#### `src/lib/chat/sessions.ts`
- `createSession(personaId, options?)` 增加 `characterId` 可选参数
- 创建会话时将 `character_id` 写入 `sessions` 表

#### `src/app/characters/page.tsx`（修复）
- 修复