# ai-companion 系统验收计划（阶段 1-2）

## Context
当前任务范围只限 ai-companion 的系统验收阶段 1-2，不进入大规模修复：
1. 用户端真实功能链路
2. 管理后台功能覆盖与缺失模块

目标不是泛泛列 QA 清单，而是产出一份可以直接交给 team 并行执行的验收计划：每一块都要明确页面/组件、依赖 API、涉及数据库表、端到端数据流、哪些必须真实浏览器检查、哪些可 API/数据先验、以及最后的 team 分工顺序。

已确认的现状与约束：
- 用户端主链围绕 persona -> user character -> session -> chat -> memory -> feedback。
- 管理端主链围绕 admin auth -> dashboard/conversations -> personas -> memories analytics -> prompt/testing -> memory ops。
- 当前仓库中已经存在较多页面与 API，但不是每个 API 都等价于“已被 UI 完整接入并可验收”，因此本计划会同时标记“功能覆盖”和“疑似缺口”。
- 聊天与记忆链路是否闭环，不仅取决于 UI，也取决于 `sessions/messages/memories/user_profiles_per_persona/evaluation_logs/prompt_versions/memory_operation_logs` 这些数据面是否连通。

---

## Phase 0. 预检与验收前置条件
先做一次统一预检，避免后面所有 lane 因环境问题假失败。

### 0.1 预检目标
- 确认普通用户与管理员账号都可登录。
- 确认至少存在一个 `is_active = true` 的 persona，避免首页/聊天入口无落点。
- 确认关键表与关键日志面存在，否则用户链和 admin memory/performance 链会出现“页面能开但数据全空”的假通过。

### 0.2 需要核对的 API / 数据面
- Auth: `POST /api/auth/register` `POST /api/auth/login` `GET /api/auth/session` `POST /api/auth/logout`
- Personas: `GET /api/personas` `GET /api/personas/[id]`
- 关键表：
  - `auth.users`
  - `profiles`
  - `personas`
  - `user_characters`
  - `sessions`
  - `messages`
  - `memories`
  - `user_profiles_per_persona`
  - `evaluation_logs`
  - `prompt_versions`
  - `memory_operation_logs`

### 0.3 并行性
- 这一步不建议拆太散，作为 team 全局入口统一完成。

### 0.4 必须浏览器检查
- 登录后跳转与受保护页面访问，必须真实浏览器检查。

---

## 1. 用户端真实功能链路

### U1. 登录 / 注册 / 入口重定向
**页面 / 组件**
- `src/app/login/page.tsx`
- `src/app/register/page.tsx`
- `src/components/auth/AuthForm.tsx`
- `src/app/page.tsx`

**API**
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/session`
- `POST /api/auth/logout`

**数据库表**
- `auth.users`
- `profiles`

**验收目标**
- 新用户注册后，认证用户与业务侧 profile 都真正落库。
- 登录后 cookie/session 生效，普通用户能进入用户侧入口，管理员能进入 `/admin/dashboard`。
- 退出登录后，受保护路由回到登录页。

**数据流**
- 前端表单提交 -> auth API -> 认证状态建立 -> profile 角色解析 -> 页面重定向。

**并行性**
- 可以单独成 lane，但建议作为用户侧所有验收的前置。

**是否必须真实浏览器**
- 必须。

---

### U2. 人设列表 / 入口落点
**页面 / 组件**
- `src/app/page.tsx`
- `src/app/chat/[personaId]/page.tsx`

**API**
- `GET /api/personas`
- `GET /api/personas/[id]`

**数据库表**
- `personas`

**验收目标**
- 首页能基于有效 persona 将用户带入正确聊天入口。
- 用户端只暴露应可见的人设；失效 persona 不应被正常入口继续使用。
- 进入 `/chat/[personaId]` 时，页面 bootstrap 能拿到 persona 与会话初始数据。

**数据流**
- 首页/入口 -> personas 查询 -> 目标 persona 解析 -> chat 页面 SSR/bootstrap。

**是否必须真实浏览器**
- 建议必须。

---

### U3. 角色列表 / 创建角色 / 选择角色
**页面 / 组件**
- `src/app/characters/page.tsx`
- `src/components/CharacterSelector.tsx`
- `src/components/NewSessionDialog.tsx`
- `src/app/chat/[personaId]/ChatWithPersona.tsx`

**API**
- `GET /api/characters`
- `POST /api/characters`
- `PUT /api/characters`
- `DELETE /api/characters`

**数据库表**
- `user_characters`

**验收目标**
- 用户可以创建自己的 character，并只看到自己的 character。
- character 选择结果能真正传给新建会话流程，而不是只停留在前端状态。
- character 修改/删除后，聊天页和新会话对话框能反映最新状态。

**数据流**
- characters 页面 CRUD -> `user_characters.owner_id = 当前用户`
- 聊天页/新会话框读取角色列表 -> 用户选择 character -> 后续 session 创建使用该 `character_id`

**是否必须真实浏览器**
- 必须。

**风险/缺口**
- `CharacterSelector` 与 `NewSessionDialog` 可能是两套交互路径，验收时要确认哪条是主链。
- 角色选择本地持久化键名疑似不完全一致，需重点确认“创建后是否真的带到新会话”。

---

### U4. 新建会话 / 会话列表 / 会话切换
**页面 / 组件**
- `src/app/chat/[personaId]/page.tsx`
- `src/app/chat/[personaId]/ChatWithPersona.tsx`
- `src/components/NewSessionDialog.tsx`

**API**
- `GET /api/personas/[id]/sessions`
- `POST /api/personas/[id]/sessions`
- `DELETE /api/personas/[id]/sessions`
- `GET /api/sessions/[sessionId]/messages`
- `DELETE /api/sessions/[sessionId]`

**数据库表**
- `sessions`
- `messages`

**验收目标**
- 新会话必须绑定 `persona_id + character_id + user_id`，不能出现坏 session 混入正常链路。
- 会话列表只展示当前用户、当前 persona 下应可用的会话。
- 切换会话后，消息列表真正切到对应 session，而不是前端假切换。
- 删除单个会话 / 清空该 persona 会话后，UI 与数据库状态一致。

**数据流**
- 选择角色 -> `POST /api/personas/[id]/sessions` -> `sessions` 落库 -> chat 页面刷新 current session -> `GET /api/sessions/[sessionId]/messages` 拉取消息。

**是否必须真实浏览器**
- 必须。

---

### U5. 对话工作台聊天
**页面 / 组件**
- `src/app/chat/[personaId]/ChatWithPersona.tsx`
- `src/components/MemoryContextPanel.tsx`

**API**
- `POST /api/chat`
- `POST /api/feedback`
- `POST /api/memories/feedback`

**数据库表**
- `sessions`
- `messages`
- `prompt_versions`
- `evaluation_logs`
- `memories`
- `user_profiles_per_persona`
- `memory_operation_logs`

**验收目标**
- 用户发送消息后，user/assistant message 都真正落库。
- 记忆上下文确实参与当前响应，而不是 UI 假显示。
- 回应后的反馈按钮能写入评估数据。
- 聊天主链中 persona、character、session 三个维度不串线。

**数据流**
- 输入消息 -> `POST /api/chat` -> user message insert -> recent history / memory retrieve -> prompt version resolve -> model reply -> assistant message insert -> 返回 memory context preview -> UI 展示。

**是否必须真实浏览器**
- 必须。

---

### U6. 导入聊天记录
**页面 / 组件**
- `src/components/NewSessionDialog.tsx`
- 聊天页中的 import 入口（如存在）

**API**
- `POST /api/chat/import`

**数据库表**
- `sessions`
- `messages`
- `memories`
- `user_profiles_per_persona`

**验收目标**
- 上传聊天记录后，系统会创建绑定正确 character 的 session。
- 导入消息真正落库，且导入后的 session 能直接作为正常会话打开。
- 导入完成后，记忆提取/概要刷新链路真正启动，而不是只生成会话壳子。

**数据流**
- 文件上传 -> import API -> 新 session 创建 -> messages 批量插入 -> memory summarizer / extractor 触发 -> 后续聊天可召回导入事实。

**是否必须真实浏览器**
- 必须。

---

### U7. 记忆是否生成
**页面 / 组件**
- `src/app/chat/[personaId]/ChatWithPersona.tsx`
- `src/components/MemoryContextPanel.tsx`
- `src/app/memories/page.tsx`
- `src/app/memories/MemoriesPageClient.tsx`

**API**
- `POST /api/chat`
- `GET /api/memories`
- `GET /api/memories/[id]`
- `POST /api/memories/feedback`

**数据库表**
- `memories`
- `user_profiles_per_persona`
- `memory_feedback`（如实际存在）
- 相关统计字段所在表结构

**验收目标**
- 多轮聊天后，memory 与 user profile 真的出现，不是空跑。
- 用户侧 memory 页面能看到与当前 persona/character 对应的数据。
- 对 memory 的反馈会真正影响后台可见的数据，而不是只前端 toast 成功。

**是否必须真实浏览器**
- 建议必须。

**风险/缺口**
- memory 反馈与统计字段存在 schema 漂移风险，验收时要把“前端可点”与“数据库真实变化”一起核对。

---

### U8. 角色隔离 / 会话隔离 / 记忆隔离
**页面 / 组件**
- `src/app/chat/[personaId]/page.tsx`
- `src/app/chat/[personaId]/ChatWithPersona.tsx`
- `src/app/memories/page.tsx`

**API**
- `GET/POST /api/personas/[id]/sessions`
- `POST /api/chat`
- `GET /api/memories`
- 管理端对 memory 的交叉查询 API（用于反证）

**数据库表**
- `sessions`
- `messages`
- `memories`
- `user_profiles_per_persona`

**验收目标**
- 同一用户不同 character 的 session 不串消息。
- 同一 persona 下不同 character 的记忆不串用。
- 不同用户之间不会看到彼此 character/session/memory。

**是否必须真实浏览器**
- 建议真实浏览器 + 数据库双验。

---

### U9. 前端操作后是否真正传到后台
**覆盖对象**
- character CRUD
- session create/delete/clear
- chat send
- import
- memory feedback
- reply feedback

**API**
- 以上所有用户侧 API

**数据库表**
- `user_characters`
- `sessions`
- `messages`
- `memories`
- `evaluation_logs`
- `user_profiles_per_persona`

**验收目标**
- 每个前端成功操作都要能在网络请求与数据库落点中找到对应证据。
- 要明确区分“按钮可点”与“真实成功”。

**是否必须真实浏览器**
- 必须，并结合网络/数据库证据。

---

## 2. 管理后台功能覆盖与缺失模块

### A1. 管理后台壳层 / 权限门禁
**页面 / 组件**
- `src/app/admin/layout.tsx`
- `src/components/admin/AdminNav.tsx`

**API**
- 所有 `/api/admin/**`

**数据库表**
- `profiles`（admin 角色）

**验收目标**
- 非 admin 不可打开 admin 页面，也不可调用 admin API。
- admin 登录后导航、退出登录、页面壳层都正常。

**是否必须真实浏览器**
- 必须。

---

### A2. 仪表盘
**页面 / 组件**
- `src/app/admin/dashboard/page.tsx`
- 数据来源：`src/lib/admin/insights.ts`

**数据库表**
- `profiles`
- `personas`
- `sessions`
- `messages`
- `user_characters`
- `memory_operation_logs`

**验收目标**
- 用户数、会话数、消息数、persona 使用、character 使用、memory 健康等卡片都是实际数据，不是占位。
- 仪表盘聚合结果与数据库抽样一致。

**是否必须真实浏览器**
- 必须。

**风险/缺口**
- character usage 展示质量疑似不足，可能只显示 ID 片段而不是可读名称。

---

### A3. 人设管理
**页面 / 组件**
- `src/app/admin/personas/page.tsx`
- `src/app/admin/personas/new/page.tsx`
- `src/app/admin/personas/[id]/edit/page.tsx`

**API**
- `POST /api/admin/personas`
- `PATCH /api/admin/personas/[id]`
- `DELETE /api/admin/personas/[id]`
- `GET /api/personas`
- `GET /api/personas/[id]`

**数据库表**
- `personas`

**验收目标**
- 新建 persona 后能在 admin 列表出现，并能影响用户端入口。
- 编辑 persona 后，聊天页显示与 prompt/persona 行为基线能同步变化。
- 禁用/删除 persona 的行为要明确：用户端是否还能看到、已有会话是否受影响。

**是否必须真实浏览器**
- 必须。

**风险/缺口**
- 删除看起来是硬删除，验收时需明确这是不是产品预期。

---

### A4. 对话记录
**页面 / 组件**
- `src/app/admin/conversations/page.tsx`
- `src/app/admin/conversations/ConversationsClient.tsx`

**数据库表**
- `sessions`
- `messages`
- `personas`
- `profiles`
- `user_characters`

**验收目标**
- admin 能看到真实会话列表、筛选结果和对应消息内容。
- persona / user / character / session 维度的筛选与展示一致。
- 不只是看到 session 元数据，还要确认是否能追到完整对话内容。

**是否必须真实浏览器**
- 必须。

**风险/缺口**
- 需要重点确认当前页面是否展示完整 transcript，还是只展示 session 级摘要/元信息。

---

### A5. 记忆管理主页面
**页面 / 组件**
- `src/app/admin/memories/page.tsx`

**API**
- `GET /api/admin/memories`
- `POST /api/admin/memories`
- `POST /api/admin/memories/search`
- `GET/PUT/DELETE /api/admin/memories/[memoryId]`

**数据库表**
- `memories`
- `user_profiles_per_persona`
- `sessions`
- `messages`

**验收目标**
- admin 能按 user / persona / character / type / query 查 memory。
- memory 创建、编辑、删除、检索结果与数据库一致。
- character 一对一设定下，memory 不应跨 character 混查。

**是否必须真实浏览器**
- 必须。

---

### A6. 记忆 stats / timeline / graph / quality
**页面 / 组件**
- `src/app/admin/memories/stats/page.tsx`
- `src/app/admin/memories/timeline/page.tsx`
- `src/app/admin/memories/graph/page.tsx`
- `src/app/admin/memories/quality/page.tsx`

**API**
- `GET /api/admin/memories/stats`
- `GET /api/admin/memories/timeline`
- `GET /api/admin/memories/graph`
- `GET /api/admin/memories/quality`
- 相关附属：`/duplicates` `/versions` `/tags` `/export`

**数据库表**
- `memories`
- `memory_versions`
- `memory_tags`
- `memory_tag_relations`
- `user_profiles_per_persona`
- `sessions`

**验收目标**
- 各分析页都能返回结构正确、含真实数据的数据集。
- 图谱、时间线、质量页的聚合结果和 memory 主表抽样一致。
- tags / versions / duplicates / export 至少要确认是否有 UI 接入口；若无，要标成“后台能力存在但 UI 未验收闭环”。

**是否必须真实浏览器**
- 建议必须。

**风险/缺口**
- API 覆盖面可能比现有可见页面更宽，需防止“后端有能力但前端没接出”。

---

### A7. 性能监控
**页面 / 组件**
- `src/app/admin/memory-performance/page.tsx`

**API**
- `GET /api/admin/memory-logs`
- `GET /api/admin/memory-metrics`
- `DELETE /api/admin/memory-metrics`
- `GET /api/admin/all-characters`

**数据库表**
- `memory_operation_logs`
- 以及 metrics 的实际持久层/内存层来源

**验收目标**
- 管理员能看到真实 memory operation logs，而不是空壳页。
- 按 operation/status/character 过滤能得到正确结果。
- reset metrics 的行为与页面展示一致。

**是否必须真实浏览器**
- 必须。

**风险/缺口**
- `src/app/api/admin/all-characters/route.ts` 疑似缺少 admin 权限校验。
- 需要确认 `memory_operation_logs` 在真实数据库已存在且字段齐全。

---

### A8. Prompt 版本
**页面 / 组件**
- `src/app/admin/prompts/page.tsx`

**API**
- `GET /api/admin/prompt-versions`
- `POST /api/admin/prompt-versions`
- `POST /api/admin/prompt-versions/[id]/activate`

**数据库表**
- `prompt_versions`

**验收目标**
- 创建 prompt version 后可在后台看到。
- 激活后的 prompt version 会真正被 `/api/chat` 使用，而不是只改数据库状态。
- 同时只能有符合预期的 active 版本。

**是否必须真实浏览器**
- 必须，并配合真实聊天联动验证。

---

### A9. 测试评估页
**页面 / 组件**
- `src/app/admin/testing/page.tsx`

**API**
- `POST /api/admin/testing/quick`
- `POST /api/admin/testing/batch`
- `GET/POST /api/admin/evaluations`
- 用户侧联动：`POST /api/feedback`

**数据库表**
- `evaluation_logs`

**验收目标**
- quick / batch 测试能真正跑出结果，而不是只返回占位响应。
- 评估日志能在后台被查看，并能区分来源。
- 用户反馈与后台测试评估都能落入统一的 evaluation 数据面。

**是否必须真实浏览器**
- 建议必须。

---

### A10. 其他与 persona + character 一对一设定相关的页面 / 模块
**重点核对对象**
- `src/app/admin/diagnostic/page.tsx`
- `src/app/admin/memory-config/page.tsx`
- `src/app/api/admin/characters/route.ts`
- `src/app/api/admin/all-characters/route.ts`
- `src/app/memories/page.tsx`

**验收目标**
- 找出当前系统中与 persona + character 一对一约束直接相关、但未被主链覆盖的辅助页面/接口。
- 区分三类结果：
  1. 已有页面且可用
  2. 有 API 但缺页面/缺明显入口
  3. 有页面但缺权限/缺真实数据支撑

**当前已发现的重点缺口**
- `admin/all-characters` 疑似无 admin auth。
- 某些 memory 扩展能力（versions/tags/duplicates/export）可能后端已存在，但 UI 验收入口不足。
- admin conversations 需要确认是否真的能查看完整对话内容。
- dashboard 的 character 展示质量可能不足。

---

## 3. 适合 team 并行的拆分

### Lane A：用户认证与入口
- 登录 / 注册 / 登出
- 首页落点
- persona 可见性与 chat 页面 bootstrap

### Lane B：用户角色与会话
- characters CRUD
- 角色选择
- 新建会话 / 切换会话 / 删除 / 清空

### Lane C：用户聊天与导入
- 聊天工作台
- feedback
- import 聊天记录
- 导入后继续聊天

### Lane D：记忆与隔离
- memory 生成
- user memory 页面
- 角色隔离 / 会话隔离 / 记忆隔离
- 前端动作到后端证据闭环

### Lane E：管理后台核心
- admin 门禁
- dashboard
- personas
- conversations

### Lane F：管理后台记忆运维
- memories 主页
- stats / timeline / graph / quality
- performance
- memory-config / diagnostic / 缺口盘点

### Lane G：Prompt 与测试评估
- prompt versions
- testing quick/batch
- evaluations
- prompt 激活后对真实聊天的联动验证

---

## 4. 哪些必须真实浏览器检查

### 必须真实浏览器的项目
- 登录 / 注册 / 登出
- 首页到聊天入口的跳转
- 角色创建 / 选择 / 删除
- 新建会话 / 切换会话 / 清空会话
- 聊天发送、消息展示、记忆上下文面板、反馈
- 聊天记录导入与导入后跳转
- 用户 memory 页面
- admin dashboard
- admin personas
- admin conversations
- admin memories 主页与 stats / timeline / graph / quality
- admin memory-performance
- admin memory-config
- admin prompts
- admin testing
- admin diagnostic

### 可先 API / 数据检查，再做浏览器终验的项目
- 各类 CRUD 是否真实落库
- session/message/memory/evaluation 的数据一致性
- prompt active 状态切换
- memory logs / metrics 的底层数据正确性
- admin API 权限校验

---

## 5. 建议的 team 执行顺序

### Step 1. 统一预检
先完成 Phase 0，确保账号、persona、关键表、关键日志面正常。

### Step 2. 先跑用户链，生成真实数据
优先执行：Lane A -> Lane B -> Lane C
原因：admin 端很多页面要依赖真实 session/message/memory 数据才能验收。

### Step 3. 同步启动两条后台 lane
在用户链能产出真实数据后，并行执行：
- Lane E（admin core）
- Lane F（admin memory ops）

### Step 4. 再跑隔离与 prompt/evaluation
并行执行：
- Lane D（隔离/记忆闭环）
- Lane G（prompt/testing/evaluations）

### Step 5. 最终交叉终验
至少完成 4 条跨模块场景：
1. 注册 -> 创建角色 -> 新建会话 -> 聊两轮 -> 看到记忆 -> 提交反馈
2. 导入聊天记录 -> 打开导入会话 -> 后续聊天召回导入事实
3. admin 登录 -> 看 dashboard -> 查 conversations -> 查 memories/performance
4. admin 修改 persona / 激活 prompt version -> 用户侧重新聊天验证真实生效

---

## 6. 最终建议的 team 分工方案

### Team 1：用户入口与角色/会话
- 覆盖 Lane A + Lane B
- 负责把“用户能不能稳定进入可聊天状态”验清楚

### Team 2：用户聊天 / 导入 / 记忆闭环
- 覆盖 Lane C + Lane D
- 负责把“聊天和记忆是否真的闭环”验清楚

### Team 3：管理后台核心运营面
- 覆盖 Lane E
- 负责 dashboard / personas / conversations 的业务可操作性

### Team 4：管理后台记忆运营与技术面
- 覆盖 Lane F + Lane G
- 负责 memories analytics / performance / config / prompts / testing / evaluations

如果人数不足，最小可压缩为 3 组：
1. 用户链（A+B+C+D）
2. admin core（E）
3. admin memory + prompt/testing（F+G）

---

## 7. 最终输出要求（给执行团队）
所有发现的问题必须带：
- 页面
- API
- 数据表
- 现象
- 复现条件
- 证据类型（浏览器 / 网络 / 数据库 / 日志）

问题统一按以下严重级别排序：
- Critical
- High
- Medium
- Low

最终输出必须包含：
1. 已验收页面清单
2. 已覆盖功能清单
3. 缺失页面或缺失模块
4. 前后端未打通的问题
5. persona + character 一对一设定下 UI 不一致的问题
6. 建议修复优先级

---

## Critical files
### 用户侧关键页面 / 组件
- `src/app/login/page.tsx`
- `src/app/register/page.tsx`
- `src/components/auth/AuthForm.tsx`
- `src/app/page.tsx`
- `src/app/chat/[personaId]/page.tsx`
- `src/app/chat/[personaId]/ChatWithPersona.tsx`
- `src/components/NewSessionDialog.tsx`
- `src/components/CharacterSelector.tsx`
- `src/app/characters/page.tsx`
- `src/app/memories/page.tsx`
- `src/app/memories/MemoriesPageClient.tsx`
- `src/components/MemoryContextPanel.tsx`

### 管理端关键页面 / 组件
- `src/app/admin/layout.tsx`
- `src/components/admin/AdminNav.tsx`
- `src/app/admin/dashboard/page.tsx`
- `src/app/admin/conversations/page.tsx`
- `src/app/admin/conversations/ConversationsClient.tsx`
- `src/app/admin/personas/page.tsx`
- `src/app/admin/personas/new/page.tsx`
- `src/app/admin/personas/[id]/edit/page.tsx`
- `src/app/admin/memories/page.tsx`
- `src/app/admin/memories/stats/page.tsx`
- `src/app/admin/memories/timeline/page.tsx`
- `src/app/admin/memories/graph/page.tsx`
- `src/app/admin/memories/quality/page.tsx`
- `src/app/admin/memory-performance/page.tsx`
- `src/app/admin/memory-config/page.tsx`
- `src/app/admin/prompts/page.tsx`
- `src/app/admin/testing/page.tsx`
- `src/app/admin/diagnostic/page.tsx`

### 关键 API / 服务层
- `src/app/api/auth/**`
- `src/app/api/personas/**`
- `src/app/api/characters/route.ts`
- `src/app/api/chat/route.ts`
- `src/app/api/chat/import/route.ts`
- `src/app/api/sessions/**`
- `src/app/api/memories/**`
- `src/app/api/feedback/route.ts`
- `src/app/api/admin/**`
- `src/lib/chat/sessions.ts`
- `src/lib/admin/insights.ts`

---

## Verification
### 浏览器终验清单
- 普通用户完整走通：注册/登录 -> persona 入口 -> 创建角色 -> 建会话 -> 聊天 -> 生成记忆 -> 查看 memory -> 导入聊天 -> 再次召回
- 管理员完整走通：登录 -> dashboard -> personas -> conversations -> memories -> quality/timeline/graph/stats -> performance -> prompt -> testing

### 数据核对清单
每一条前端成功操作都要对应至少一类后端证据：
- 网络请求成功返回
- 相关数据库行真正新增/更新
- 管理后台或用户页能够再次读回这条数据

### 必须明确标红的缺口
验收结束时不要只给“通过/不通过”，必须额外单列：
- 已有 UI + 已通过
- 有 API 但 UI 未覆盖
- 有页面但权限/数据不完整
- 高风险操作语义不明确（如 persona 硬删除）
- 需要修复后才能进入下一阶段的阻断项

---

## Implementation notes
- 本计划是系统验收执行依据，不是修复方案；后续修复应严格根据各 lane 的证据输出再定范围。
- 验收时要优先证明“前端动作真的进后台、后台结果真的再回前端”，不要停留在单点页面截图。
- 对 memory / prompt / performance 相关页面，必须防止“页面能开但底层数据为空或 schema 漂移”造成假通过。
- 对 persona + character 一对一设定，要把 user character、session、memory 三层一起验，不可只看其中一层。
