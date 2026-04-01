#!/usr/bin/env tsx
/**
 * 角色记忆隔离测试脚本
 *
 * 测试不同角色（Character）之间的记忆是否正确隔离
 * 确保角色 A 的记忆不会泄露到角色 B 的对话上下文中
 */

import { randomUUID } from 'crypto';

// 配置
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const TEST_USER_EMAIL = process.env.TEST_USER_EMAIL || 'admin@ai-companion.local';
const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD || 'admin123456';

// 测试数据
const TEST_SCENARIOS = {
  scenario1: {
    name: '场景1：同用户 + 同人设 + 不同角色',
    personaName: '小芮嫣',
    characterA: {
      name: '直连A-082698',
      facts: [
        { message: '我最喜欢的颜色是红色', expected: '红色' },
        { message: '我的宠物叫小白', expected: '小白' }
      ]
    },
    characterB: {
      name: '直连B-082698',
      facts: [
        { message: '我最喜欢的颜色是蓝色', expected: '蓝色' },
        { message: '我的宠物叫小黑', expected: '小黑' }
      ]
    }
  }
};

// 类型定义
type TestResult = {
  scenario: string;
  test: string;
  passed: boolean;
  message: string;
  details?: unknown;
};

// 测试结果收集
const results: TestResult[] = [];

// 辅助函数：登录并获取 cookie
async function login(): Promise<string> {
  console.log('🔐 登录测试账户...');

  const response = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: TEST_USER_EMAIL,
      password: TEST_USER_PASSWORD
    })
  });

  if (!response.ok) {
    throw new Error(`登录失败: ${response.status} ${response.statusText}`);
  }

  const cookies = response.headers.get('set-cookie');
  if (!cookies) {
    throw new Error('登录成功但未返回 cookie');
  }

  console.log('✅ 登录成功');
  return cookies;
}

// 辅助函数：获取人设列表
async function getPersonas(cookie: string): Promise<Array<{ id: string; name: string }>> {
  const response = await fetch(`${BASE_URL}/api/personas`, {
    headers: { Cookie: cookie }
  });

  if (!response.ok) {
    throw new Error(`获取人设列表失败: ${response.status}`);
  }

  const data = await response.json();
  const personas = data.data || [];

  // Ensure it's an array
  if (!Array.isArray(personas)) {
    console.error('Personas API returned non-array:', personas);
    return [];
  }

  return personas;
}

// 辅助函数：获取角色列表
async function getCharacters(cookie: string): Promise<Array<{ id: string; name: string }>> {
  const response = await fetch(`${BASE_URL}/api/characters`, {
    headers: { Cookie: cookie }
  });

  if (!response.ok) {
    throw new Error(`获取角色列表失败: ${response.status}`);
  }

  const data = await response.json();

  // API returns { success: true, data: { characters: [...] } }
  const characters = data.data?.characters || [];

  // Ensure it's an array
  if (!Array.isArray(characters)) {
    console.error('Characters API returned non-array:', characters);
    return [];
  }

  return characters;
}

// 辅助函数：创建新会话
async function createSession(
  cookie: string,
  personaId: string,
  characterId: string
): Promise<string> {
  const response = await fetch(`${BASE_URL}/api/personas/${personaId}/sessions`, {
    method: 'POST',
    headers: {
      Cookie: cookie,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      character_id: characterId
    })
  });

  if (!response.ok) {
    throw new Error(`创建会话失败: ${response.status}`);
  }

  const data = await response.json();
  return data.data.session_id;
}

// 辅助函数：发送消息
async function sendMessage(
  cookie: string,
  personaId: string,
  sessionId: string,
  message: string
): Promise<string> {
  const response = await fetch(`${BASE_URL}/api/chat`, {
    method: 'POST',
    headers: {
      Cookie: cookie,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      persona_id: personaId,
      session_id: sessionId,
      message
    })
  });

  if (!response.ok) {
    throw new Error(`发送消息失败: ${response.status}`);
  }

  const data = await response.json();
  return data.data.reply;
}

// 辅助函数：查询记忆
async function getMemories(
  cookie: string,
  personaId: string,
  characterId: string
): Promise<Array<{ id: string; content: string; memory_type: string }>> {
  const params = new URLSearchParams({
    persona_id: personaId,
    character_id: characterId
  });

  const response = await fetch(`${BASE_URL}/api/memories?${params}`, {
    headers: { Cookie: cookie }
  });

  if (!response.ok) {
    throw new Error(`查询记忆失败: ${response.status}`);
  }

  const data = await response.json();
  return data.data?.memories || [];
}

// 辅助函数：等待记忆存储
async function waitForMemoryStorage(ms: number = 3000): Promise<void> {
  console.log(`⏳ 等待 ${ms}ms 让记忆系统处理...`);
  await new Promise(resolve => setTimeout(resolve, ms));
}

// 测试场景 1：同用户 + 同人设 + 不同角色
async function testScenario1(cookie: string) {
  const scenario = TEST_SCENARIOS.scenario1;
  console.log(`\n📋 ${scenario.name}`);
  console.log('='.repeat(60));

  // 获取人设和角色
  const personas = await getPersonas(cookie);
  const characters = await getCharacters(cookie);

  console.log(`可用人设: ${personas.map(p => p.name).join(', ')}`);
  console.log(`可用角色: ${characters.map(c => c.name).join(', ')}`);

  const persona = personas.find(p => p.name === scenario.personaName);
  const characterA = characters.find(c => c.name === scenario.characterA.name);
  const characterB = characters.find(c => c.name === scenario.characterB.name);

  if (!persona) {
    throw new Error(`未找到人设: ${scenario.personaName}`);
  }
  if (!characterA) {
    throw new Error(`未找到角色: ${scenario.characterA.name}`);
  }
  if (!characterB) {
    throw new Error(`未找到角色: ${scenario.characterB.name}`);
  }

  console.log(`✓ 人设: ${persona.name} (${persona.id})`);
  console.log(`✓ 角色 A: ${characterA.name} (${characterA.id})`);
  console.log(`✓ 角色 B: ${characterB.name} (${characterB.id})`);

  // 步骤 1: 角色 A 对话
  console.log(`\n📝 步骤 1: 与角色 A 对话`);
  const sessionA = await createSession(cookie, persona.id, characterA.id);
  console.log(`✓ 创建会话 A: ${sessionA}`);

  for (const fact of scenario.characterA.facts) {
    console.log(`  发送: "${fact.message}"`);
    const reply = await sendMessage(cookie, persona.id, sessionA, fact.message);
    console.log(`  回复: "${reply.substring(0, 50)}..."`);
  }

  await waitForMemoryStorage();

  // 步骤 2: 角色 B 对话
  console.log(`\n📝 步骤 2: 与角色 B 对话`);
  const sessionB = await createSession(cookie, persona.id, characterB.id);
  console.log(`✓ 创建会话 B: ${sessionB}`);

  for (const fact of scenario.characterB.facts) {
    console.log(`  发送: "${fact.message}"`);
    const reply = await sendMessage(cookie, persona.id, sessionB, fact.message);
    console.log(`  回复: "${reply.substring(0, 50)}..."`);
  }

  await waitForMemoryStorage();

  // 步骤 3: 验证记忆隔离
  console.log(`\n🔍 步骤 3: 验证记忆隔离`);

  // 查询角色 A 的记忆
  const memoriesA = await getMemories(cookie, persona.id, characterA.id);
  console.log(`✓ 角色 A 的记忆数量: ${memoriesA.length}`);

  // 查询角色 B 的记忆
  const memoriesB = await getMemories(cookie, persona.id, characterB.id);
  console.log(`✓ 角色 B 的记忆数量: ${memoriesB.length}`);

  // 验证角色 A 的记忆只包含角色 A 的事实
  const memoryAContent = memoriesA.map(m => m.content).join(' ');
  const hasRedInA = memoryAContent.includes('红色') || memoryAContent.includes('红');
  const hasWhiteInA = memoryAContent.includes('小白');
  const hasBlueInA = memoryAContent.includes('蓝色') || memoryAContent.includes('蓝');
  const hasBlackInA = memoryAContent.includes('小黑');

  results.push({
    scenario: scenario.name,
    test: '角色 A 记忆包含"红色"',
    passed: hasRedInA,
    message: hasRedInA ? '✅ 通过' : '❌ 失败：未找到"红色"',
    details: { memories: memoriesA }
  });

  results.push({
    scenario: scenario.name,
    test: '角色 A 记忆包含"小白"',
    passed: hasWhiteInA,
    message: hasWhiteInA ? '✅ 通过' : '❌ 失败：未找到"小白"',
    details: { memories: memoriesA }
  });

  results.push({
    scenario: scenario.name,
    test: '角色 A 记忆不包含"蓝色"（隔离验证）',
    passed: !hasBlueInA,
    message: !hasBlueInA ? '✅ 通过' : '❌ 失败：发现"蓝色"泄露',
    details: { memories: memoriesA }
  });

  results.push({
    scenario: scenario.name,
    test: '角色 A 记忆不包含"小黑"（隔离验证）',
    passed: !hasBlackInA,
    message: !hasBlackInA ? '✅ 通过' : '❌ 失败：发现"小黑"泄露',
    details: { memories: memoriesA }
  });

  // 验证角色 B 的记忆只包含角色 B 的事实
  const memoryBContent = memoriesB.map(m => m.content).join(' ');
  const hasBlueInB = memoryBContent.includes('蓝色') || memoryBContent.includes('蓝');
  const hasBlackInB = memoryBContent.includes('小黑');
  const hasRedInB = memoryBContent.includes('红色') || memoryBContent.includes('红');
  const hasWhiteInB = memoryBContent.includes('小白');

  results.push({
    scenario: scenario.name,
    test: '角色 B 记忆包含"蓝色"',
    passed: hasBlueInB,
    message: hasBlueInB ? '✅ 通过' : '❌ 失败：未找到"蓝色"',
    details: { memories: memoriesB }
  });

  results.push({
    scenario: scenario.name,
    test: '角色 B 记忆包含"小黑"',
    passed: hasBlackInB,
    message: hasBlackInB ? '✅ 通过' : '❌ 失败：未找到"小黑"',
    details: { memories: memoriesB }
  });

  results.push({
    scenario: scenario.name,
    test: '角色 B 记忆不包含"红色"（隔离验证）',
    passed: !hasRedInB,
    message: !hasRedInB ? '✅ 通过' : '❌ 失败：发现"红色"泄露',
    details: { memories: memoriesB }
  });

  results.push({
    scenario: scenario.name,
    test: '角色 B 记忆不包含"小白"（隔离验证）',
    passed: !hasWhiteInB,
    message: !hasWhiteInB ? '✅ 通过' : '❌ 失败：发现"小白"泄露',
    details: { memories: memoriesB }
  });

  // 步骤 4: 验证对话上下文隔离
  console.log(`\n🔍 步骤 4: 验证对话上下文隔离`);

  // 向角色 A 询问颜色
  console.log(`  向角色 A 询问: "你还记得我最喜欢的颜色吗？"`);
  const replyA = await sendMessage(cookie, persona.id, sessionA, '你还记得我最喜欢的颜色吗？');
  console.log(`  角色 A 回复: "${replyA.substring(0, 100)}..."`);

  const contextHasRedInA = replyA.includes('红色') || replyA.includes('红') || replyA.includes('紅色') || replyA.includes('紅');
  const contextHasBlueInA = replyA.includes('蓝色') || replyA.includes('蓝') || replyA.includes('藍色') || replyA.includes('藍');

  results.push({
    scenario: scenario.name,
    test: '角色 A 对话上下文包含"红色"',
    passed: contextHasRedInA,
    message: contextHasRedInA ? '✅ 通过' : '❌ 失败：AI 未回忆起"红色"',
    details: { reply: replyA }
  });

  results.push({
    scenario: scenario.name,
    test: '角色 A 对话上下文不包含"蓝色"（隔离验证）',
    passed: !contextHasBlueInA,
    message: !contextHasBlueInA ? '✅ 通过' : '❌ 失败：AI 回复中出现"蓝色"泄露',
    details: { reply: replyA }
  });

  // 向角色 B 询问颜色
  console.log(`  向角色 B 询问: "你还记得我最喜欢的颜色吗？"`);
  const replyB = await sendMessage(cookie, persona.id, sessionB, '你还记得我最喜欢的颜色吗？');
  console.log(`  角色 B 回复: "${replyB.substring(0, 100)}..."`);

  const contextHasBlueInB = replyB.includes('蓝色') || replyB.includes('蓝') || replyB.includes('藍色') || replyB.includes('藍');
  const contextHasRedInB = replyB.includes('红色') || replyB.includes('红') || replyB.includes('紅色') || replyB.includes('紅');

  results.push({
    scenario: scenario.name,
    test: '角色 B 对话上下文包含"蓝色"',
    passed: contextHasBlueInB,
    message: contextHasBlueInB ? '✅ 通过' : '❌ 失败：AI 未回忆起"蓝色"',
    details: { reply: replyB }
  });

  results.push({
    scenario: scenario.name,
    test: '角色 B 对话上下文不包含"红色"（隔离验证）',
    passed: !contextHasRedInB,
    message: !contextHasRedInB ? '✅ 通过' : '❌ 失败：AI 回复中出现"红色"泄露',
    details: { reply: replyB }
  });
}

// 主函数
async function main() {
  console.log('🚀 角色记忆隔离测试');
  console.log('='.repeat(60));
  console.log(`测试环境: ${BASE_URL}`);
  console.log(`测试用户: ${TEST_USER_EMAIL}`);
  console.log('');

  try {
    // 登录
    const cookie = await login();

    // 运行测试场景
    await testScenario1(cookie);

    // 输出测试结果
    console.log('\n' + '='.repeat(60));
    console.log('📊 测试结果汇总');
    console.log('='.repeat(60));

    const passedTests = results.filter(r => r.passed).length;
    const totalTests = results.length;
    const passRate = ((passedTests / totalTests) * 100).toFixed(1);

    console.log(`\n总测试数: ${totalTests}`);
    console.log(`通过: ${passedTests}`);
    console.log(`失败: ${totalTests - passedTests}`);
    console.log(`通过率: ${passRate}%`);

    console.log('\n详细结果:');
    for (const result of results) {
      console.log(`\n${result.message}`);
      console.log(`  场景: ${result.scenario}`);
      console.log(`  测试: ${result.test}`);
      if (!result.passed && result.details) {
        console.log(`  详情: ${JSON.stringify(result.details, null, 2)}`);
      }
    }

    // 保存测试报告
    const report = {
      timestamp: new Date().toISOString(),
      environment: BASE_URL,
      summary: {
        total: totalTests,
        passed: passedTests,
        failed: totalTests - passedTests,
        passRate: `${passRate}%`
      },
      results
    };

    const reportPath = `./test-results/memory-isolation-${Date.now()}.json`;
    const fs = require('fs');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n📄 测试报告已保存: ${reportPath}`);

    // 退出码
    process.exit(passedTests === totalTests ? 0 : 1);

  } catch (error) {
    console.error('\n❌ 测试执行失败:', error);
    process.exit(1);
  }
}

// 运行测试
main();
