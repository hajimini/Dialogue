# Auto Evaluator 修复说明

## 问题诊断

原始问题：`npm run test:auto-eval` 运行时，10/10 case 都报 `fetch failed`，最终 evaluated=0。

### 根因分析

1. **环境变量冲突**：Claude Code CLI 设置了 `ANTHROPIC_BASE_URL=http://127.0.0.1:15721`（本地代理），但该代理未运行
2. **API Key 冲突**：CLI 的临时 API key 覆盖了 .env.local 中配置的真实 key
3. **错误信息不足**：原始错误只显示 "fetch failed"，无法判断是网络、DNS、401 还是服务未启动

## 修复内容

### 1. 改进 `src/lib/ai/claude.ts` 错误处理

**变更**：
- 添加 try-catch 包裹 fetch 调用，区分网络错误和 API 错误
- 错误信息中包含完整的 URL、Model、HTTP 状态码和响应体前 200 字符
- 对 `generateDirectProviderText` 应用相同的改进

**效果**：
```
// 之前
fetch failed

// 之后
Network error calling Anthropic API. URL: http://127.0.0.1:15721/v1/messages, Model: claude-haiku-4-5. Original error: fetch failed
// 或
Anthropic API error: 401 Unauthorized. URL: https://openrouter.vip/v1/messages, Model: claude-haiku-4-5. Response: {"error":{"message":"无效的令牌"}}
```

### 2. 改进 `tests/auto-evaluator.ts` 环境加载

**变更**：
- `loadEnvFile` 强制覆盖 `ANTHROPIC_BASE_URL` 和 `ANTHROPIC_AUTH_TOKEN`
- 删除 CLI 设置的临时 `ANTHROPIC_API_KEY`，确保使用 .env.local 中的 token
- 添加 pre-flight 检查，启动时打印：
  - API Endpoint
  - Evaluator Model
  - API Key（脱敏显示）
  - Supabase URL 和 Key 状态

**效果**：
```
=== Auto Evaluator Pre-flight Checks ===
- API Endpoint: https://openrouter.vip/v1/messages
- Evaluator Model: claude-haiku-4-5
- API Key: <redacted>...<redacted>
- Supabase URL: https://kjdjwwmindowjdmxvnui.supabase.co
- Supabase Key: SET
- All prerequisites satisfied
```

### 3. 改进重试逻辑

**变更**：
- 原本只重试 429 (rate limit) 错误
- 现在也重试 502/503/504 (server errors) 和 Network error

**效果**：
- 对 OpenRouter 等不稳定服务的容错性更强
- 减少因临时网络抖动导致的评估失败

## 使用说明

### 前置条件

1. `.env.local` 中必须配置：
   ```env
   ANTHROPIC_AUTH_TOKEN=your_openrouter_key
   ANTHROPIC_BASE_URL=https://openrouter.vip
   ANTHROPIC_DEFAULT_HAIKU_MODEL=claude-haiku-4-5
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_key
   ```

2. Supabase 中必须有 seed 数据（personas 表）

3. `docs/test-results/` 中必须有至少一个 batch test 结果文件

### 运行

```bash
npm run test:auto-eval
```

### 预期输出

```
=== Auto Evaluator Pre-flight Checks ===
- API Endpoint: https://openrouter.vip/v1/messages
- Evaluator Model: claude-haiku-4-5
- API Key: <redacted>...<redacted>
- Supabase URL: https://kjdjwwmindowjdmxvnui.supabase.co
- Supabase Key: SET
- All prerequisites satisfied

[primary 1/10] OK C01 avg=4.20
[primary 2/10] OK C02 avg=3.80
...
[primary 10/10] OK C10 avg=4.40

Summary
- Primary result: docs\test-results\result-20260328-195500.json
- Primary evaluated: 10
- Primary low-score cases: 2
- Primary averages: role=4.10, natural=4.00, emotion=4.20, anti_ai=3.90, length=4.50
- Report file: docs\eval-reports\report-20260401-140509.md
```

### 常见错误及解决

#### 1. `Missing ANTHROPIC_API_KEY or ANTHROPIC_AUTH_TOKEN`
**原因**：.env.local 中未配置 API key  
**解决**：添加 `ANTHROPIC_AUTH_TOKEN=your_key`

#### 2. `401 Unauthorized - 无效的令牌`
**原因**：API key 无效或已过期  
**解决**：检查 OpenRouter 账户余额和 key 有效性

#### 3. `502 Bad Gateway`
**原因**：OpenRouter 服务临时不可用  
**解决**：等待几分钟后重试，或切换到其他 provider

#### 4. `Network error calling Anthropic API`
**原因**：网络连接问题或 DNS 解析失败  
**解决**：检查网络连接，确认可以访问 `https://openrouter.vip`

#### 5. `Evaluator did not return valid JSON`
**原因**：API 返回了非 JSON 响应（通常是 HTML 错误页）  
**解决**：检查 API endpoint 是否正确，或切换 provider

## 验收标准

- ✅ `npm run test:auto-eval` 不再只给出模糊的 `fetch failed`
- ✅ 若前置满足，应返回真实评估结果（evaluated > 0）
- ✅ 若前置不满足，应返回明确、可执行的阻断说明
- ✅ 错误信息包含 URL、Model、状态码、响应体等完整上下文
- ✅ 启动时打印 pre-flight 检查结果，明确依赖项状态

## 技术细节

### 环境变量优先级

1. Claude Code CLI 设置的环境变量（最高优先级，但会被 auto-evaluator 覆盖）
2. .env.local 中的配置（auto-evaluator 强制使用）
3. 代码中的默认值（最低优先级）

### 重试策略

- 初始间隔：2100ms（可通过 `AUTO_EVAL_MIN_INTERVAL_MS` 配置）
- 重试延迟：12000ms * attempt（可通过 `AUTO_EVAL_RETRY_DELAY_MS` 配置）
- 最大重试：4 次（可通过 `AUTO_EVAL_MAX_RETRIES` 配置）
- 可重试错误：429, 502, 503, 504, Network error

### 并发控制

- 默认并发度：1（可通过 `AUTO_EVAL_CONCURRENCY` 配置）
- 请求间隔：2100ms（避免触发 rate limit）
