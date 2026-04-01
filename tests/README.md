# 回归测试套件使用指南

## 概述

回归测试套件用于在每次修改 Prompt 后快速验证没有改坏现有功能。

## 快速开始

```bash
# 运行回归测试
npm run test:regression
```

## 工作原理

### 1. 测试用例（TEST_CASES.json）

包含所有测试场景，标记为 `regression: true` 的用例会被回归测试使用。

**用例结构：**
```json
{
  "id": "A01",
  "category": "日常闲聊",
  "input": "在吗",
  "expected": "像熟人一样接话，不要助手式问候",
  "regression": true,
  "hardChecks": {
    "maxLength": 20,
    "bannedPhrases": ["有什么我可以帮你", "需要帮助"],
    "mustNotContain": ["？？", "！！"]
  }
}
```

### 2. 基线数据（BASELINE.json）

存储优化前的评分数据，用于对比。

**基线结构：**
```json
{
  "version": "v1.0-baseline",
  "averageScores": {
    "role_adherence": 3.8,
    "naturalness": 3.2,
    ...
  },
  "testCases": {
    "A01": {
      "role_adherence": 4.0,
      "naturalness": 3.0,
      ...
    }
  }
}
```

### 3. 测试流程

```
加载测试用例 (regression: true)
    ↓
对每个用例：
    ↓
调用 API 获取回复
    ↓
硬性检查（长度、禁用词）
    ↓
AI 评分（5个维度）
    ↓
与基线对比
    ↓
检测回归（下降 > 0.3）
    ↓
输出结果
```

### 4. 硬性检查

**立即失败的情况：**
- 回复超过最大长度
- 包含禁用短语（如"我理解你的感受"）
- 包含禁止内容（如列表符号"1. 2. 3."）

**示例：**
```typescript
hardChecks: {
  maxLength: 20,              // 最多20字符
  bannedPhrases: [            // 禁用短语
    "有什么我可以帮你",
    "需要帮助"
  ],
  mustNotContain: ["？？"]    // 禁止内容
}
```

### 5. AI 评分

**5个维度（1-5分）：**
1. **role_adherence** - 角色一致性
2. **naturalness** - 自然度
3. **emotional_accuracy** - 情绪准确性
4. **anti_ai_score** - 去AI味
5. **length_appropriate** - 长度合适性

### 6. 回归检测

**触发回归的条件：**
- 任何维度分数下降超过 **0.3 分**

**示例：**
```
基线: naturalness = 3.5
当前: naturalness = 3.1
差值: -0.4 → 触发回归警告
```

## 输出示例

### 成功案例

```
🧪 开始回归测试
============================================================

加载了 13 个回归测试用例
基线版本: v1.0-baseline

测试用例 A01: 在吗
回复: 嗯
✅ 硬性检查通过

评分对比:
  role_adherence: 4.5 (基线: 4.0, +0.5)
  naturalness: 5.0 (基线: 3.0, +2.0)
  emotional_accuracy: 4.0 (基线: 3.5, +0.5)
  anti_ai_score: 5.0 (基线: 3.0, +2.0)
  length_appropriate: 5.0 (基线: 2.5, +2.5)

...

============================================================

📊 测试总结

总测试用例: 13
硬性检查失败: 0
回归失败: 0

平均分数:
  角色一致: 4.35
  自然度: 4.62
  情绪准确: 4.15
  去AI味: 4.77
  长度合适: 4.54

============================================================

✅ PASS: 所有测试通过
```

### 失败案例

```
测试用例 A01: 在吗
回复: 你好！有什么我可以帮你的吗？
❌ 硬性检查失败:
  - 回复过长：15 字符 > 20 字符
  - 包含禁用短语："有什么我可以帮你"

⚠️  硬性检查失败，停止测试

============================================================

📊 测试总结

总测试用例: 1
硬性检查失败: 1
回归失败: 0

============================================================

❌ FAIL: 硬性检查失败
```

## 使用场景

### 场景 1：修改 Prompt 后验证

```bash
# 1. 修改 prompt-templates.ts
# 2. 运行回归测试
npm run test:regression

# 3. 如果通过 → 提交代码
# 4. 如果失败 → 调整 Prompt 重试
```

### 场景 2：更新基线

当你确认新的 Prompt 效果更好时，更新基线：

```bash
# 1. 运行测试并记录新分数
npm run test:regression

# 2. 手动更新 docs/eval-reports/BASELINE.json
# 3. 提交新基线
```

### 场景 3：添加新测试用例

```json
// tests/TEST_CASES.json
{
  "id": "A06",
  "category": "日常闲聊",
  "input": "我路上看到一只猫",
  "expected": "轻松接话，允许带一点人设情绪",
  "regression": true,  // 标记为回归测试
  "hardChecks": {
    "maxLength": 30,
    "bannedPhrases": ["可爱的猫咪"],
    "mustNotContain": []
  }
}
```

## 配置选项

### 环境变量

```bash
# API 地址（默认 localhost:3001）
export API_BASE_URL=http://localhost:3001

# 测试用的人设 ID
export TEST_PERSONA_ID=test-persona

# 回归阈值（默认 0.3）
export REGRESSION_THRESHOLD=0.3
```

### 调整阈值

在 `tests/regression.ts` 中修改：

```typescript
const REGRESSION_THRESHOLD = 0.3; // 改为 0.5 更宽松
```

## 最佳实践

### 1. 每次改 Prompt 都跑测试

```bash
# 工作流程
vim src/lib/ai/prompt-templates.ts
npm run test:regression
git commit -m "优化 Prompt"
```

### 2. 保持测试用例精简

- 只标记核心用例为 `regression: true`
- 建议 10-30 个用例
- 覆盖主要场景即可

### 3. 定期更新基线

- 每次大版本优化后更新
- 记录版本号和日期
- 保留历史基线文件

### 4. 硬性检查要严格

- 长度限制要合理
- 禁用短语要明确
- 避免误报

## 故障排查

### 问题 1：API 连接失败

```
❌ 测试执行失败: API 请求失败: 500
```

**解决：**
```bash
# 确保开发服务器在运行
npm run dev

# 检查端口
curl http://localhost:3001/api/chat
```

### 问题 2：所有测试都失败

```
❌ FAIL: 硬性检查失败
```

**解决：**
- 检查 Prompt 是否有语法错误
- 查看具体的失败原因
- 调整硬性检查规则

### 问题 3：分数波动大

```
⚠️  WARNING: 检测到性能回归
```

**解决：**
- AI 评分有随机性，多跑几次
- 调整 temperature 参数
- 检查是否真的变差了

## 扩展

### 添加真实的 AI 评分

修改 `getAIScores` 函数，调用真实的评分 API：

```typescript
async function getAIScores(
  input: string,
  reply: string,
  expected: string
): Promise<ScoreMetrics> {
  const response = await fetch(`${API_BASE_URL}/api/admin/testing/quick`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ input, reply, expected }),
  });
  
  const data = await response.json();
  return data.scores;
}
```

### 生成测试报告

```typescript
// 保存测试结果到文件
import { writeFileSync } from 'fs';

writeFileSync(
  'test-results.json',
  JSON.stringify(results, null, 2)
);
```

## 相关文档

- [测试用例文档](../docs/TEST_CASES.md)
- [优化日志](../docs/OPTIMIZATION_LOG.md)
- [快速开始](../docs/QUICK_START.md)
