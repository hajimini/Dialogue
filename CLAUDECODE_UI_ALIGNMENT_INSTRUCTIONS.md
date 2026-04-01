# ClaudeCode 执行指令：账号清理 + 一对一角色对话 UI 全面补齐

## 任务背景

当前项目已经从“普通人设聊天”演进为“用户角色 Character 与 Persona 的一对一对话系统”。后端、数据表、API、记忆隔离、性能日志、Prompt 版本、测试评估等能力已经实现了很多，但前端工作台和管理后台是否完整承接了这些能力，需要做一次**全量代码审计 + UI 补齐 + 旧流程清理**。

这次任务不是只改几个页面视觉，而是要确保：

1. 数据层真实存在的功能，在 UI 上有入口、有状态、有交互、有正确的数据边界
2. 一对一角色对话模式，在用户端和管理端都被完整体现
3. 老的测试账号、老的测试角色、老的试验页面、旧设计残留，全部清理或收口

不要偷懒，不要只看导航页和几个主页面。必须把前后端相关代码都读完后再动手。

---

## 已确认的当前事实

### 1. 账号数据确实有残留

当前 Supabase `auth.users` 中至少存在以下账号：

- `admin@ai-companion.local`
- `demo@ai-companion.local`
- `demo-user@ai-companion.local`
- `codex-274074@example.com`
- `memory-rls-1774709400008@ai-companion.local`
- `memory-rls-1774709219945@ai-companion.local`

当前 `profiles` 里也至少存在 4 条资料，其中包含测试/重复用户资料。

结论：账号清理不是建议项，是必做项。

### 2. 角色数据也有大量测试残留

`user_characters` 中已存在明显测试角色残留，例如：

- `隔离验收A-* / 隔离验收B-*`
- `隔离复验A-* / 隔离复验B-*`
- `唯一A-* / 唯一B-*`
- `终验A-* / 终验B-*`
- `直连A-* / 直连B-*`
- 多个默认角色

结论：账号清理时必须同步考虑角色、会话、消息、记忆、画像、反馈、日志等关联数据，避免删掉账号但把垃圾角色和脏数据留下。

### 3. 后端能力很多，但需要确认 UI 是否完整承接

代码中已存在或高度疑似已存在以下能力：

- 用户端：
  - `/chat/[personaId]`
  - `/characters`
  - `/memories`
  - 角色选择、导入对话、记忆上下文、记忆反馈

- 管理端：
  - `/admin/dashboard`
  - `/admin/personas`
  - `/admin/conversations`
  - `/admin/memories`
  - `/admin/memory-performance`
  - `/admin/memory-config`
  - `/admin/prompts`
  - `/admin/testing`
  - `/admin/memories/stats`
  - `/admin/memories/timeline`
  - `/admin/memories/graph`
  - `/admin/memories/quality`

- API / 功能模块：
  - `memory metrics`
  - `memory logs`
  - `memory config`
  - `prompt versions`
  - `evaluations`
  - `memory search`
  - `memory versions`
  - `memory duplicates`
  - `memory tags`
  - `memory export`
  - `character isolation`

结论：本次任务必须做**功能覆盖审计**，而不是凭印象改页面。

### 4. 已观察到的疑似旧设计/旧流程残留

以下点优先检查并处理：

- `src/app/admin/personas/page.tsx`
  - 文案里仍有 “Phase 2.1 / 暂未接入认证” 之类旧阶段痕迹
  - 视觉风格与其他后台页不一致

- `src/app/test-character/page.tsx`
  - 明显是测试页，需要判断是否应删除、隐藏或迁移到正式流程

- `src/app/personas/page.tsx`
  - 目前只是重定向，需确认是否还应保留

- `src/app/characters/page.tsx`
  - 需要确认是否真正符合当前“一对一角色对话”的正式工作流，而不是测试工具页

- `src/components/CharacterSelector.tsx`
- `src/components/NewSessionDialog.tsx`
  - 需要确认是否与当前会话创建、角色切换、导入对话、角色隔离逻辑完全一致

- 管理端记忆相关子页虽然存在，但必须确认：
  - 是否有清晰入口
  - 是否和主 `Memories` 页面形成统一的信息架构
  - 是否真正支持 user/persona/character 维度

---

## 强制执行方式

### 第一阶段：先做全量审计，再开始改

你必须先完成下面两个动作，再开始写代码：

#### A. 建立“功能覆盖矩阵”

请创建文档：

- `docs/ui-feature-coverage-audit.md`

文档必须包含表格，按下面格式列出：

| 模块/能力 | 后端/数据/API 已实现 | 当前 UI 页面/入口 | 当前问题 | 必须动作 |
|---|---|---|---|---|

至少覆盖这些范围：

- 登录 / 注册 / 首页重定向
- 用户端工作台
- 人设进入流程
- 角色创建/角色选择/角色切换
- 新建会话
- 对话导入
- 记忆上下文展示
- 用户端记忆页
- 管理端仪表盘
- 管理端人设页
- 管理端对话记录
- 管理端记忆管理主页面
- 记忆统计 / 时间线 / 图谱 / 质量子页面
- 性能监控
- 系统配置
- Prompt 版本
- 测试评估
- 任何仅有 API 但没有 UI 的已实现功能

#### B. 做“页面与路由清单”

在同一文档中列出：

- 正式保留页面
- 需要重做页面
- 需要并入其他页面的页面
- 需要删除或隐藏的测试页/旧页

不得跳过任何 `src/app` 下与工作台、管理端、记忆、测试、Prompt、角色相关的页面。

---

## 任务 1：清理多余账号，只保留两个账号体系

### 目标

最终系统里只保留：

- 1 个用户端账号
- 1 个管理端账号

### 保留策略

默认保留：

- `admin@ai-companion.local`
- `demo@ai-companion.local`

但如果你通过最近登录时间、实际会话数据、当前前端工作流确认“用户当前真正使用的不是 `demo@ai-companion.local`”，则保留真实在用用户账号，删除其他用户账号。

### 必做要求

1. 清理 `auth.users` 多余账号
2. 清理 `profiles` 中对应多余资料
3. 清理多余账号关联的：
   - `user_characters`
   - `sessions`
   - `messages`
   - `memories`
   - `user_profiles_per_persona`
   - `memory_feedback`
   - 其他任何通过 `user_id / owner_id` 关联的表
4. 删除测试账号后，不得留下孤儿数据
5. 清理后，用户选择器、管理后台筛选器、测试页下拉框都只能看到保留后的有效账号

### 实现要求

必须提供一个**可复用、可再次执行的清理脚本**，例如：

- `scripts/cleanup-redundant-users.ts`

脚本要求：

- 先打印将删除的账号和关联数据数量
- 再执行删除
- 最后输出清理报告

同时生成文档：

- `docs/account-cleanup-report.md`

文档写清：

- 保留了哪两个账号
- 删除了哪些账号
- 删除了哪些关联数据
- 清理后数据库剩余统计

---

## 任务 2：按“一对一角色对话系统”重做前端信息架构

### 你必须遵守的核心原则

**后端已经实现的能力，前端不能缺席。**

如果代码里已经实现：

- persona + character 维度隔离
- character 级会话
- character 级记忆
- character 级画像
- character 级性能/日志追踪

那么对应的 UI 里必须能让人看见、切换、筛选、验证、管理。

### 用户端必须重点检查并补齐

#### 1. 工作台首页/进入流程

确认并修正：

- 首页如何进入聊天
- 是否先选 Persona 再选 Character
- 是否能看出当前正在以哪个 Character 与哪个 Persona 对话
- 新建会话时是否强制绑定 Character
- 是否存在旧的人设流程残留，导致用户不知道 Character 在哪里生效

#### 2. 聊天工作台

必须体现：

- 当前 Persona
- 当前 Character
- 当前会话绑定关系
- 会话切换是否是“当前 Persona 下、当前 Character 的会话”
- 新建会话、导入会话、切换角色的行为是否一致
- 记忆上下文是否是当前 Character 范围下的内容

如果当前 UI 无法明确区分 Persona 与 Character 的责任分工，必须重做信息结构。

#### 3. 角色管理页 `/characters`

必须判断它现在到底是：

- 正式产品页面
- 还是测试遗留页面

如果保留，就重做成正式页面，且：

- 文案、布局、入口、返回路径都符合正式流程
- 与聊天工作台、新建会话、导入会话逻辑一致

如果不保留，就把其能力并入正式工作台，并删除/隐藏旧页。

#### 4. 用户记忆页 `/memories`

要检查：

- 是否支持按 Persona / Character / Memory Type 查看
- 是否能让用户看清“这是哪个 Persona + 哪个 Character 下产生的记忆”
- 是否支持删除和反馈的正确范围
- 是否仍有旧的“用户维度聚合”设计没有更新成角色隔离视角

---

## 任务 3：管理后台要完整承接“一对一角色对话”的后台运营视角

### 1. 仪表盘 `/admin/dashboard`

不是只显示总量就算完成。必须判断并补齐：

- 现在显示的是不是“角色对话系统”真正关心的指标
- 是否能看出 Persona 维度和 Character 维度的关系
- 是否能快速判断哪些 Persona 活跃、哪些 Character 活跃
- 是否能快速发现异常角色、异常会话、异常记忆、异常延迟

如果当前只是通用聊天后台样式，要改成贴合当前系统的运营总览。

### 2. 人设页 `/admin/personas`

必须重做并统一到当前后台视觉体系。

重点：

- 去掉旧阶段说明
- 体现 Persona 在一对一角色对话系统中的位置
- 是否需要显示与 Character / 会话 / 记忆相关的运营数据
- 不能再是旧版的孤立“人设 CRUD 页”

### 3. 对话记录 `/admin/conversations`

必须检查：

- 是否按 Persona 分组还不够，是否还需要 Character 维度
- 是否能快速筛到某个用户、某个 Character、某个 Persona 的会话
- 是否能判断当前会话是不是角色隔离正确
- 是否能看出用户是谁、角色是谁、Persona 是谁

如果当前仅仅“按 Persona 分栏”，但无法完成角色隔离验证或运营排查，则继续补。

### 4. 记忆管理 `/admin/memories`

这是本次任务重点。

必须确保主页面能承接并合理组织以下能力：

- 用户筛选
- Persona 筛选
- Character 筛选
- Memory Type 筛选
- 搜索测试
- 记忆编辑/删除
- 反馈情况
- 版本/重复检测/导出
- 与统计/时间线/图谱/质量子页面的跳转关系

要求：

- 不是把所有按钮堆在一起
- 要形成清晰的主页面 + 子页面体系
- 让管理员能围绕“某用户 + 某 Persona + 某 Character”完整排查

### 5. 性能监控 `/admin/memory-performance`

必须确认和增强：

- 是否显示了所有关键操作类型
- 是否能看到成功/失败/延迟/慢请求/错误消息
- 是否能看到 user/persona/character 维度上下文
- 是否能看出操作时间序列
- 是否能支持快速排查问题

不能只做一个“有图表就算完成”的页面。

### 6. 系统配置 `/admin/memory-config`

你要判断这个页面是不是还停留在工程配置层，而没有产品化。

需要考虑：

- 当前配置项是否足够
- 是否要展示当前实际运行状态
- 是否要展示上次测试结果、可用性状态、配置变更历史
- 是否需要更清晰地说明这些配置对当前角色对话系统的影响

### 7. Prompt 版本 `/admin/prompts`

你必须判断它是不是已经适配当前系统，而不是老的“只改 Prompt 文本”页面。

重点检查：

- 是否能看出版本用途
- 是否能看出版本与测试评估结果的关系
- 是否能在当前系统中真正被运营使用

如果太简陋，就补成真正可用的版本管理界面。

### 8. 测试评估 `/admin/testing`

你必须判断这个页面是不是已经和当前项目实际测试体系对齐，包括：

- batch tester
- prompt comparator
- regression
- evaluator

如果只是一个半成品调试台，必须升级或重构为可用的后台测试评估模块。

---

## 任务 4：任何“代码已实现但 UI 没承接”的功能，都要处理

这是本次任务最重要的原则之一。

### 必须审查并判断是否需要 UI 承接的能力

- memory stats
- memory timeline
- memory graph
- memory quality
- memory versions
- memory duplicates
- memory tags
- memory export
- evaluation overview
- prompt activation
- quick/batch testing
- character isolation view/filter

对每一个能力，只能有三种结果之一：

1. 已纳入正式 UI，并且入口清晰
2. 明确并入其他页面，由主页面统一承接
3. 明确判定为不再保留，并删除对应旧页面/旧入口/旧死代码

不允许存在：

- API 在，但没有任何正式 UI
- 页面在，但主导航/主流程永远到不了
- 页面在，但还是旧设计，没跟当前系统同步

---

## 任务 5：清理旧页面、测试页、残留流程

重点检查并处理：

- `/test-character`
- `/personas`
- 任何仅用于临时调试的页面
- 任何旧版入口文案
- 任何与当前角色隔离模型相冲突的页面说明

规则：

- 正式产品保留的页面，要重做到正式质量
- 纯测试页要么移入管理后台测试模块，要么删除/隐藏
- 不允许让最终产品里继续留着临时实验入口

---

## 交付物要求

### 代码交付

完成所有必要代码修改，覆盖：

- 用户端工作台
- 管理后台
- 清理脚本
- 相关 API/查询修正
- 必要的类型更新
- 必要的导航和布局调整

### 文档交付

必须新增或更新以下文档：

- `docs/ui-feature-coverage-audit.md`
- `docs/account-cleanup-report.md`
- `docs/ui-alignment-change-log.md`

其中 `ui-alignment-change-log.md` 需说明：

- 哪些页面改了
- 哪些旧页面删了/隐藏了
- 哪些功能从“代码存在但 UI 不可用”变成“正式可用”

---

## 验收标准

### 一、账号清理

- 最终只保留 2 个账号体系
- 无多余测试账号
- 无孤儿资料、孤儿角色、孤儿会话、孤儿记忆

### 二、产品信息架构

- 用户端和管理端都明确体现 Persona + Character 的一对一对话模型
- 任何关键功能都有正式 UI 承接
- 旧设计、旧流程、测试残留页得到处理

### 三、后台运营可用性

- 管理员可以围绕“用户 / Persona / Character / 会话 / 记忆 / 性能 / Prompt / 测试”完成完整排查
- 不是单页好看，而是全链路可操作

### 四、工程质量

必须运行并通过：

1. `npm run lint`
2. `npm run build`
3. `npm test -- --runInBand --no-coverage`

如果有无法通过的项，必须说明原因、影响范围和后续处理建议。

### 五、浏览器实际检查

你必须实际打开并检查至少这些页面：

- `/`
- `/chat/[personaId]`
- `/characters`
- `/memories`
- `/admin/dashboard`
- `/admin/personas`
- `/admin/conversations`
- `/admin/memories`
- `/admin/memory-performance`
- `/admin/memory-config`
- `/admin/prompts`
- `/admin/testing`

并在最终报告中写明：

- 每个页面是否通过
- 哪些页面被重构
- 哪些页面被移除或合并

---

## 最终汇报格式

完成后请按以下顺序汇报：

1. 功能覆盖审计结果
2. 删除/保留的账号与数据清理结果
3. 重构或补齐的页面列表
4. 删除/隐藏的旧页面或旧入口
5. 代码实现的关键点
6. 测试结果
7. 浏览器逐页验收结果
8. 仍存在的非阻塞问题

不要只给“已完成”一句话。必须给出结构化结果，便于继续验收。
