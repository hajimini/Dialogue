# 回归测试快速指南

## 🎯 目的

每次修改 Prompt 后，快速验证没有改坏现有功能。

## 🚀 使用方法

```bash
npm run test:regression
```

## 📋 测试内容

### 自动检查的内容

1. **硬性检查（立即失败）**
   - ❌ 回复太长
   - ❌ 包含禁用短语（"我理解你的感受"等）
   - ❌ 包含列表符号（1. 2. 3.）

2. **AI 评分（5个维度）**
   - 角色一致性
   - 自然度
   - 情绪准确性
   - 去AI味
   - 长度合适性

3. **回归检测**
   - 任何维度下降超过 0.3 分 → 警告

## 📊 结果判定

### ✅ PASS
- 所有硬性检查通过
- 无性能回归

### ⚠️ WARNING
- 硬性检查通过
- 但有维度分数下降超过 0.3

### ❌ FAIL
- 硬性检查失败
- 立即停止测试

## 🔧 工作流程

```bash
# 1. 修改 Prompt
vim src/lib/ai/prompt-templates.ts

# 2. 运行测试
npm run test:regression

# 3. 查看结果
# ✅ 通过 → 提交代码
# ❌ 失败 → 调整 Prompt 重试
```

## 📁 相关文件

- `tests/TEST_CASES.json` - 测试用例
- `tests/regression.ts` - 测试脚本
- `docs/eval-reports/BASELINE.json` - 基线分数

## 💡 提示

- 测试约需 1-2 分钟
- 使用 13 个核心测试用例
- 自动对比基线分数
- 失败时会显示具体原因

## 📖 详细文档

查看 `tests/README.md` 了解更多细节。
