# 记忆隔离测试脚本使用指南

## 概述

本项目包含两个测试脚本，用于验证系统在不同角色（Character）和人设（Persona）组合下的记忆隔离机制。

---

## 测试脚本

### 1. `test-memory-isolation.ts` - 角色记忆隔离测试

**测试目标**：验证同一用户与同一人设对话时，不同角色的记忆是否完全隔离。

**测试场景**：
- 场景 1：同用户 + 同人设 + 不同角色
  - 角色 A：存储"喜欢红色"、"宠物叫小白"
  - 角色 B：存储"喜欢蓝色"、"宠物叫小黑"
  - 验证：角色 A 的记忆不会出现在角色 B 的对话中

**运行方式**：
```bash
# 使用 tsx 运行
npx tsx scripts/test-memory-isolation.ts

# 或使用 Bun 运行
bun run scripts/test-memory-isolation.ts

# 自定义环境变量
BASE_URL=http://localhost:3000 \
TEST_USER_EMAIL=admin@ai-companion.local \
TEST_USER_PASSWORD=admin123 \
npx tsx scripts/test-memory-isolation.ts
```

---

### 2. `test-persona-isolation.ts` - 人设记忆隔离测试

**测试目标**：验证同一用户与不同人设对话时，记忆是否按人设隔离。

**测试场景**：
- 场景 2：同用户 + 不同人设 + 同角色
  - 人设 A（小芮嫣）：存储"在台北工作"、"软件工程师"
  - 人设 B（芷晴秋葉🍂）：存储"在上海工作"、"插画师"
  - 验证：人设 A 的记忆不会出现在人设 B 的对话中

- 场景 3：同用户 + 不同人设 + 不同角色
  - 组合 1（小芮嫣 + 直连A）：存储"学习日语"、"喜欢动漫"
  - 组合 2（芷晴秋葉🍂 + 直连B）：存储"学习法语"、"喜欢电影"
  - 验证：组合 1 的记忆不会出现在组合 2 的对话中

**运行方式**：
```bash
# 使用 tsx 运行
npx tsx scripts/test-persona-isolation.ts

# 或使用 Bun 运行
bun run scripts/test-persona-isolation.ts

# 自定义环境变量
BASE_URL=http://localhost:3000 \
TEST_USER_EMAIL=admin@ai-companion.local \
TEST_USER_PASSWORD=admin123 \
npx tsx scripts/test-persona-isolation.ts
```

---

## 环境变量

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `BASE_URL` | `http://localhost:3000` | 测试环境的 URL |
| `TEST_USER_EMAIL` | `admin@ai-companion.local` | 测试用户邮箱 |
| `TEST_USER_PASSWORD` | `admin123` | 测试用户密码 |

---

## 前置条件

### 1. 安装依赖

```bash
# 安装 tsx（如果使用 Node.js）
npm install -g tsx

# 或安装 Bun（推荐）
curl -fsSL https://bun.sh/install | bash
```

### 2. 启动开发服务器

```bash
npm run dev
```

### 3. 确保测试数据存在

测试脚本需要以下数据：

**人设**：
- 小芮嫣
- 芷晴秋葉🍂

**角色**：
- 直连A-082698
- 直连B-082698

**用户**：
- admin@ai-companion.local（密码：admin123）

如果数据不存在，请先运行种子脚本：
```bash
npm run db:seed
```

---

## 测试流程

### 角色隔离测试流程

1. **登录**：使用测试账户登录
2. **创建会话 A**：人设=小芮嫣，角色=直连A-082698
3. **发送消息到会话 A**：
   - "我最喜欢的颜色是红色"
   - "我的宠物叫小白"
4. **等待记忆存储**：等待 3 秒让记忆系统处理
5. **创建会话 B**：人设=小芮嫣，角色=直连B-082698
6. **发送消息到会话 B**：
   - "我最喜欢的颜色是蓝色"
   - "我的宠物叫小黑"
7. **等待记忆存储**：等待 3 秒
8. **验证记忆隔离**：
   - 查询角色 A 的记忆，应该只包含"红色"和"小白"
   - 查询角色 B 的记忆，应该只包含"蓝色"和"小黑"
9. **验证对话上下文隔离**：
   - 向角色 A 询问"你还记得我最喜欢的颜色吗？"
   - AI 应该回答"红色"，不应该提到"蓝色"
   - 向角色 B 询问同样的问题
   - AI 应该回答"蓝色"，不应该提到"红色"

### 人设隔离测试流程

类似角色隔离测试，但测试的是不同人设之间的隔离。

---

## 测试结果

### 输出格式

测试脚本会输出详细的测试结果：

```
🚀 角色记忆隔离测试
============================================================
测试环境: http://localhost:3000
测试用户: admin@ai-companion.local

🔐 登录测试账户...
✅ 登录成功

📋 场景1：同用户 + 同人设 + 不同角色
============================================================
✓ 人设: 小芮嫣 (f9287933-a9e8-44c5-9c71-591e5449372e)
✓ 角色 A: 直连A-082698 (8ac62ee3-...)
✓ 角色 B: 直连B-082698 (89e6fae3-...)

📝 步骤 1: 与角色 A 对话
✓ 创建会话 A: 8836bb5f-...
  发送: "我最喜欢的颜色是红色"
  回复: "好的，我记住了你喜欢红色..."
  发送: "我的宠物叫小白"
  回复: "小白是个可爱的名字..."

⏳ 等待 3000ms 让记忆系统处理...

📝 步骤 2: 与角色 B 对话
✓ 创建会话 B: e49d2327-...
  发送: "我最喜欢的颜色是蓝色"
  回复: "蓝色是很好的选择..."
  发送: "我的宠物叫小黑"
  回复: "小黑听起来很酷..."

⏳ 等待 3000ms 让记忆系统处理...

🔍 步骤 3: 验证记忆隔离
✓ 角色 A 的记忆数量: 2
✓ 角色 B 的记忆数量: 2

🔍 步骤 4: 验证对话上下文隔离
  向角色 A 询问: "你还记得我最喜欢的颜色吗？"
  角色 A 回复: "当然记得，你最喜欢的颜色是红色..."
  向角色 B 询问: "你还记得我最喜欢的颜色吗？"
  角色 B 回复: "是的，你最喜欢的颜色是蓝色..."

============================================================
📊 测试结果汇总
============================================================

总测试数: 12
通过: 12
失败: 0
通过率: 100.0%

详细结果:

✅ 通过
  场景: 场景1：同用户 + 同人设 + 不同角色
  测试: 角色 A 记忆包含"红色"

✅ 通过
  场景: 场景1：同用户 + 同人设 + 不同角色
  测试: 角色 A 记忆包含"小白"

✅ 通过
  场景: 场景1：同用户 + 同人设 + 不同角色
  测试: 角色 A 记忆不包含"蓝色"（隔离验证）

...

📄 测试报告已保存: ./test-results/memory-isolation-1711234567890.json
```

### 测试报告

测试完成后，会在 `test-results/` 目录下生成 JSON 格式的测试报告：

```json
{
  "timestamp": "2026-03-30T12:34:56.789Z",
  "environment": "http://localhost:3000",
  "summary": {
    "total": 12,
    "passed": 12,
    "failed": 0,
    "passRate": "100.0%"
  },
  "results": [
    {
      "scenario": "场景1：同用户 + 同人设 + 不同角色",
      "test": "角色 A 记忆包含\"红色\"",
      "passed": true,
      "message": "✅ 通过",
      "details": {
        "memories": [...]
      }
    },
    ...
  ]
}
```

---

## 退出码

- `0`：所有测试通过
- `1`：有测试失败或执行出错

可以在 CI/CD 流程中使用：

```bash
# 在 CI 中运行测试
npx tsx scripts/test-memory-isolation.ts
if [ $? -ne 0 ]; then
  echo "记忆隔离测试失败"
  exit 1
fi
```

---

## 故障排查

### 问题 1：登录失败

**错误**：`登录失败: 401 Unauthorized`

**解决方案**：
1. 检查测试用户是否存在
2. 检查密码是否正确
3. 确保开发服务器正在运行

### 问题 2：未找到人设或角色

**错误**：`未找到人设: 小芮嫣`

**解决方案**：
1. 运行种子脚本：`npm run db:seed`
2. 或手动创建测试数据

### 问题 3：记忆未存储

**错误**：测试显示记忆数量为 0

**解决方案**：
1. 检查记忆系统是否正常工作
2. 增加等待时间（修改 `waitForMemoryStorage` 的参数）
3. 检查 Mem0 API 配置是否正确

### 问题 4：记忆泄露

**错误**：角色 A 的记忆出现在角色 B 的对话中

**解决方案**：
1. 检查 `match_memories` 函数是否正确过滤 `character_id`
2. 检查 `mem0-adapter.ts` 中的 `getContext` 方法
3. 检查数据库中的记忆是否正确关联 `character_id`

---

## 扩展测试

### 添加新的测试场景

在 `TEST_SCENARIOS` 对象中添加新场景：

```typescript
const TEST_SCENARIOS = {
  scenario4: {
    name: '场景4：无角色 vs 有角色',
    personaName: '小芮嫣',
    noCharacter: {
      facts: [
        { message: '我的生日是 3 月 15 日', expected: '3 月 15 日' }
      ]
    },
    withCharacter: {
      characterName: '直连A-082698',
      facts: [
        { message: '我的生日是 6 月 20 日', expected: '6 月 20 日' }
      ]
    }
  }
};
```

然后实现对应的测试函数：

```typescript
async function testScenario4(cookie: string) {
  // 实现测试逻辑
}
```

### 集成到 CI/CD

在 `package.json` 中添加测试脚本：

```json
{
  "scripts": {
    "test:isolation": "tsx scripts/test-memory-isolation.ts && tsx scripts/test-persona-isolation.ts"
  }
}
```

在 GitHub Actions 中运行：

```yaml
- name: Run memory isolation tests
  run: npm run test:isolation
```

---

## 参考文档

- [记忆隔离测试场景设计](../docs/memory-isolation-test-scenarios.md)
- [记忆系统架构](../docs/memory-system-architecture.md)
- [角色隔离实现](../docs/character-isolation-implementation.md)

---

## 维护建议

1. **定期运行测试**：每次修改记忆系统相关代码后都应该运行测试
2. **更新测试数据**：如果数据库结构变化，及时更新测试脚本
3. **监控测试结果**：在 CI/CD 中集成测试，确保每次提交都通过测试
4. **扩展测试覆盖**：根据实际使用场景添加新的测试用例
