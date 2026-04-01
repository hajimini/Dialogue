# Codex 复验结果（2026-03-31）

说明：

- 本轮原计划继续使用真实浏览器复验。
- 但浏览器 MCP 在当前环境再次被系统目录权限阻断，无法恢复到可用状态。
- 因此本轮采用的是：
  - 实际运行中的本地接口验收
  - 登录态下的真实请求链验证
  - 生产代码路径检查
- 不能把这轮结果等同于完整浏览器视觉验收。

## 结论

本轮 **不能通过验收**。

原因很直接：`/admin/memory-performance` 依赖的日志链路仍然没有写入 `character_id`，页面不可能出现真实角色选项。

## 逐项结果

### A. 聊天页“当前角色”

- 代码层状态：**大概率已修**
- 证据：
  - `src/app/chat/[personaId]/ChatWithPersona.tsx` 中“当前角色”区块已经改成无条件渲染
  - 逻辑为：
    - 有 `session.character_id` 时显示角色名
    - 没有时显示“无”
- 当前限制：
  - 本轮无法做真实 DOM 复验
  - 因此 **不能正式签字为已通过**

### B. `/memories` 角色筛选

- 后端筛选链路：**已修**
- 证据：
  - `src/app/api/memories/route.ts` 已解析 `character_id`
  - 查询已加入 `.eq("character_id", characterId)`
  - 实际 demo 用户 `/api/characters` 返回了 1 个角色：
    - `67e1ca2c-13b9-4ea7-8c34-399085ef05ab / 默认角色`
- 当前限制：
  - 本轮无法做真实页面下拉框复验
  - 所以 **只能确认后端和数据源已接通，不能确认 UI 已通过**

### D. `/admin/memory-performance` 角色筛选

- 状态：**失败，未修复**
- ClaudeCode 声称：
  - 给 `MemoryOperationLogRecord` 加了 `character_id`
  - 给 mem0 adapter 的 6 个 `memoryLogger.log` 调用加了 `character_id`
- 实际复验结果：
  - 我创建了一个带 `character_id` 的真实会话
  - 我用这个会话真实调用了 `/api/chat`
  - 我又调用了带 `character_id` 的 `/api/memories`
  - 然后用管理员读取 `/api/admin/memory-logs?limit=50`
  - **结果：最近日志中的 `character_id` 仍然全部是 `null`**
- 直接证据：
  - 最近日志样本包含：
    - `memory.list` -> `character_id: null`
    - `chat.reply` -> `character_id: null`
    - `memory.cache_miss` -> `character_id: null`
  - 以 demo 用户默认角色 `67e1ca2c-13b9-4ea7-8c34-399085ef05ab` 为条件过滤日志：
    - `matchingLogCount = 0`
- 结论：
  - 页面角色下拉的真实数据源仍然没有被打通
  - 所以 `/admin/memory-performance` **不能通过验收**

### G. `/admin/memories/quality`

- 接口层状态：**看起来正常**
- 证据：
  - 带 `userId + personaId + characterId` 调用 `/api/admin/memories/quality`
  - 返回：
    - `success: true`
    - `data` 存在
    - keys: `scored_memories`, `summary`
- 当前限制：
  - 本轮无法复验真实 UI 是否已从“请选择用户和人设查看质量评分”切换到数据展示
  - 所以 **接口通过，不等于页面通过**

## 当前判定

### 明确不通过项

1. `/admin/memory-performance`

### 只能暂定“待浏览器确认”的项

1. 聊天页“当前角色”
2. `/memories` 角色下拉是否真的显示角色
3. `/admin/memories/quality` 页面是否真的展示结果

## 对 ClaudeCode 的直接结论

这次不能说“都修好了”。

至少有一项是被实测证伪的：

- `memory-performance` 的角色选项仍然不会出来，因为日志根本没有 `character_id`

在这个问题修掉之前，不要再提交“全部完成”的总结。
