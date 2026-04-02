# API 调用问题修复报告

**问题时间**: 2026-04-02  
**修复时间**: 2026-04-02 15:06  
**状态**: ✅ 已修复

## 问题描述

重启电脑后，AI 对话功能无法正常工作，报错：
```
Network error calling Anthropic API. 
URL: http://127.0.0.1:15721/v1/messages
Model: claude-sonnet-4-5
Original error: fetch failed
```

## 根本原因

**Claude Code CLI 的全局配置覆盖了项目配置**

1. 项目的 `.env.local` 配置了正确的 API 端点：
   ```
   ANTHROPIC_BASE_URL=https://openrouter.vip
   ```

2. 但 Claude Code 的全局配置文件 `C:\Users\CF\.claude\settings.json` 设置了本地代理：
   ```json
   {
     "env": {
       "ANTHROPIC_AUTH_TOKEN": "PROXY_MANAGED",
       "ANTHROPIC_BASE_URL": "http://127.0.0.1:15721"
     }
   }
   ```

3. Claude Code 的 `cc-switch.exe` 进程（PID 9184）监听端口 15721，作为 API 代理
4. 重启电脑后，该进程未启动或配置失效，导致请求失败

## 解决方案

### 方案1：创建项目级 Claude Code 配置（已采用）

在项目根目录创建 `.claude/settings.json`，覆盖全局配置：

```json
{
  "env": {
    "ANTHROPIC_AUTH_TOKEN": "<redacted-openrouter-token>",
    "ANTHROPIC_BASE_URL": "https://openrouter.vip"
  }
}
```

**优点**：
- 项目独立配置，不影响其他项目
- 团队成员可以共享配置（如果需要）

### 方案2：修改全局配置（备选）

直接修改 `C:\Users\CF\.claude\settings.json`，移除代理配置。

**缺点**：
- 影响所有使用 Claude Code 的项目
- 可能影响其他依赖代理的功能

## 修复步骤

1. **停止旧的开发服务器**
   ```bash
   taskkill //F //PID 2688
   ```

2. **创建项目级配置**
   ```bash
   mkdir -p .claude
   # 创建 .claude/settings.json（内容见上）
   ```

3. **重启开发服务器**
   ```bash
   npm run dev
   ```

4. **验证修复**
   - 测试脚本验证 API 连接：✅ 成功
   - 浏览器测试聊天功能：✅ 成功
   - AI 正常回复："能啊，怎麼了"

## 验证结果

### API 连接测试
```
Environment variables:
ANTHROPIC_AUTH_TOKEN: <redacted>...
ANTHROPIC_BASE_URL: https://openrouter.vip
ANTHROPIC_MODEL: claude-sonnet-4-5-20250929

API Response Status: 200 OK
```

### 浏览器测试
- ✅ 用户消息发送成功
- ✅ AI 回复正常显示
- ✅ 记忆系统正常工作
- ✅ 会话列表更新正常

## 预防措施

1. **文档化配置优先级**
   - 项目级 `.claude/settings.json` > 全局 `~/.claude/settings.json` > `.env.local`

2. **添加配置检查脚本**
   ```bash
   node scripts/test-api-connection.mjs
   ```

3. **更新 README**
   - 说明如何配置 API 端点
   - 说明 Claude Code 代理的影响

## 相关文件

- `.claude/settings.json` - 项目级 Claude Code 配置（新增）
- `.env.local` - 环境变量配置
- `scripts/test-api-connection.mjs` - API 连接测试脚本（新增）
- `chat-working-successfully.png` - 修复后的截图

## 总结

问题的根源是 **配置优先级** 和 **进程依赖**。Claude Code 的全局配置会覆盖项目配置，且依赖本地代理进程。通过创建项目级配置文件，成功绕过了全局配置的影响，恢复了 API 调用功能。
