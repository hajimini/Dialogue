#!/usr/bin/env tsx
/**
 * 人设记忆隔离测试脚本
 *
 * 测试不同人设（Persona）之间的记忆是否正确隔离
 * 同时测试人设和角色组合的记忆隔离
 */

import { randomUUID } from 'crypto';

// 配置
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const TEST_USER_EMAIL = process.env.TEST_USER_EMAIL || 'admin@ai-companion.local';
const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD || 'admin123456';

// 测试数据
const TEST_SCENARIOS = {
  scenario2: {
    name: '场景2：同用户 + 不同人设 + 同角色',
    characterName: '直连A-082698',
    personaA: {
      name: '小芮嫣',
      facts: [
        { message: '我在台北工作', expected: '台北' },
        { message: '我是软件工程师', expected: '软件工程师' }
      ]
    },
    personaB: {
      name: '芷晴秋葉🍂',
      facts: [
        { message: '我在上海工作', expected: '上海' },
        { message: '我是插画师', expected: '插画师' }
      ]
    }
  },
  scenario3: {
    name: '场景3：同用户 + 不同人设 + 不同角色',
    combinations: [
      {
        personaName: '小芮嫣',
        characterName: '直连A-082698',
        facts: [
          { message: '我最近在学习日语', expected: '日语' },
          { message: '我喜欢看动漫', expected: '动漫' }
        ]
      },
      {
        personaName: '芷晴秋葉🍂',
        characterName: '直连B-082698',
        facts: [
          { message: '我最近在学习法语', expected: '法语' },
          { message: '我喜欢看电影', expected: '电影' }
        ]
      }
    ]
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
  characterId?: string
): Promise<Array<{ id: string; content: string; memory_type: string }>> {
  const params = new URLSearchParams({ persona_id: personaId });
  if (characterId) {
    params.append('character_id', characterId);
  }

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

// 测试场景 2：同用户 + 不同人设 + 同角色
async function testScenario2(cookie: string) {
  const scenario = TEST_SCENARIOS.scenario2;
  console.log(`\n📋 ${scenario.name}`);
  console.log('='.repeat(60));

  // 获取人设和角色
  const personas = await getPersonas(cookie);
  const characters = await getCharacters(cookie);

  const personaA = personas.find(p => p.name === scenario.personaA.name);
  const personaB = personas.find(p => p.name === scenario.personaB.name);
  const character = characters.find(c => c.name === scenario.characterName);

  if (!personaA || !personaB) {
    throw new Error(`未找到人设: ${scenario.personaA.name} 或 ${scenario.personaB.name}`);
  }
  if (!character) {
    throw new Error(`未找到角色: ${scenario.characterName}`);
  }

  console.log(`✓ 人设 A: ${personaA.name} (${personaA.id})`);
  console.log(`✓ 人设 B: ${personaB.name} (${personaB.id})`);
  console.log(`✓ 角色: ${character.name} (${character.id})`);

  // 步骤 1: 人设 A 对话
  console.log(`\n📝 步骤 1: 与人设 A 对话`);
  const sessionA = await createSession(cookie, personaA.id, character.id);
  console.log(`✓ 创建会话 A: ${sessionA}`);

  for (const fact of scenario.personaA.facts) {
    console.log(`  发送: "${fact.message}"`);
    const reply = await sendMessage(cookie, personaA.id, sessionA, fact.message);
    console.log(`  回复: "${reply.substring(0, 50)}..."`);
  }

  await waitForMemoryStorage();

  // 步骤 2: 人设 B 对话
  console.log(`\n📝 步骤 2: 与人设 B 对话`);
  const sessionB = await createSession(cookie, personaB.id, character.id);
  console.log(`✓ 创建会话 B: ${sessionB}`);

  for (const fact of scenario.personaB.facts) {
    console.log(`  发送: "${fact.message}"`);
    const reply = await sendMessage(cookie, personaB.id, sessionB, fact.message);
    console.log(`  回复: "${reply.substring(0, 50)}..."`);
  }

  await waitForMemoryStorage();

  // 步骤 3: 验证记忆隔离
  console.log(`\n🔍 步骤 3: 验证记忆隔离`);

  // 查询人设 A 的记忆
  const memoriesA = await getMemories(cookie, personaA.id, character.id);
  console.log(`✓ 人设 A 的记忆数量: ${memoriesA.length}`);

  // 查询人设 B 的记忆
  const memoriesB = await getMemories(cookie, personaB.id, character.id);
  console.log(`✓ 人设 B 的记忆数量: ${memoriesB.length}`);

  // 验证人设 A 的记忆
  const memoryAContent = memoriesA.map(m => m.content).join(' ');
  const hasTaipeiInA = memoryAContent.includes('台北');
  const hasEngineerInA = memoryAContent.includes('软件工程师') || memoryAContent.includes('工程师');
  const hasShanghaiInA = memoryAContent.includes('上海');
  const hasArtistInA = memoryAContent.includes('插画师');

  results.push({
    scenario: scenario.name,
    test: '人设 A 记忆包含"台北"',
    passed: hasTaipeiInA,
    message: hasTaipeiInA ? '✅ 通过' : '❌ 失败：未找到"台北"',
    details: { memories: memoriesA }
  });

  results.push({
    scenario: scenario.name,
    test: '人设 A 记忆包含"软件工程师"',
    passed: hasEngineerInA,
    message: hasEngineerInA ? '✅ 通过' : '❌ 失败：未找到"软件工程师"',
    details: { memories: memoriesA }
  });

  results.push({
    scenario: scenario.name,
    test: '人设 A 记忆不包含"上海"（隔离验证）',
    passed: !hasShanghaiInA,
    message: !hasShanghaiInA ? '✅ 通过' : '❌ 失败：发现"上海"泄露',
    details: { memories: memoriesA }
  });

  results.push({
    scenario: scenario.name,
    test: '人设 A 记忆不包含"插画师"（隔离验证）',
    passed: !hasArtistInA,
    message: !hasArtistInA ? '✅ 通过' : '❌ 失败：发现"插画师"泄露',
    details: { memories: memoriesA }
  });

  // 验证人设 B 的记忆
  const memoryBContent = memoriesB.map(m => m.content).join(' ');
  const hasShanghaiInB = memoryBContent.includes('上海');
  const hasArtistInB = memoryBContent.includes('插画师');
  const hasTaipeiInB = memoryBContent.includes('台北');
  const hasEngineerInB = memoryBContent.includes('软件工程师') || memoryBContent.includes('工程师');

  results.push({
    scenario: scenario.name,
    test: '人设 B 记忆包含"上海"',
    passed: hasShanghaiInB,
    message: hasShanghaiInB ? '✅ 通过' : '❌ 失败：未找到"上海"',
    details: { memories: memoriesB }
  });

  results.push({
    scenario: scenario.name,
    test: '人设 B 记忆包含"插画师"',
    passed: hasArtistInB,
    message: hasArtistInB ? '✅ 通过' : '❌ 失败：未找到"插画师"',
    details: { memories: memoriesB }
  });

  results.push({
    scenario: scenario.name,
    test: '人设 B 记忆不包含"台北"（隔离验证）',
    passed: !hasTaipeiInB,
    message: !hasTaipeiInB ? '✅ 通过' : '❌ 失败：发现"台北"泄露',
    details: { memories: memoriesB }
  });

  results.push({
    scenario: scenario.name,
    test: '人设 B 记忆不包含"软件工程师"（隔离验证）',
    passed: !hasEngineerInB,
    message: !hasEngineerInB ? '✅ 通过' : '❌ 失败：发现"软件工程师"泄露',
    details: { memories: memoriesB }
  });
}

// 测试场景 3：同用户 + 不同人设 + 不同角色
async function testScenario3(cookie: string) {
  const scenario = TEST_SCENARIOS.scenario3;
  console.log(`\n📋 ${scenario.name}`);
  console.log('='.repeat(60));

  // 获取人设和角色
  const personas = await getPersonas(cookie);
  const characters = await getCharacters(cookie);

  const combinations = scenario.combinations.map(combo => {
    const persona = personas.find(p => p.name === combo.personaName);
    const character = characters.find(c => c.name === combo.characterName);

    if (!persona || !character) {
      throw new Error(`未找到人设或角色: ${combo.personaName} / ${combo.characterName}`);
    }

    return {
      persona,
      character,
      facts: combo.facts
    };
  });

  console.log(`✓ 组合 1: ${combinations[0].persona.name} + ${combinations[0].character.name}`);
  console.log(`✓ 组合 2: ${combinations[1].persona.name} + ${combinations[1].character.name}`);

  // 步骤 1: 组合 1 对话
  console.log(`\n📝 步骤 1: 与组合 1 对话`);
  const session1 = await createSession(cookie, combinations[0].persona.id, combinations[0].character.id);
  console.log(`✓ 创建会话 1: ${session1}`);

  for (const fact of combinations[0].facts) {
    console.log(`  发送: "${fact.message}"`);
    const reply = await sendMessage(cookie, combinations[0].persona.id, session1, fact.message);
    console.log(`  回复: "${reply.substring(0, 50)}..."`);
  }

  await waitForMemoryStorage();

  // 步骤 2: 组合 2 对话
  console.log(`\n📝 步骤 2: 与组合 2 对话`);
  const session2 = await createSession(cookie, combinations[1].persona.id, combinations[1].character.id);
  console.log(`✓ 创建会话 2: ${session2}`);

  for (const fact of combinations[1].facts) {
    console.log(`  发送: "${fact.message}"`);
    const reply = await sendMessage(cookie, combinations[1].persona.id, session2, fact.message);
    console.log(`  回复: "${reply.substring(0, 50)}..."`);
  }

  await waitForMemoryStorage();

  // 步骤 3: 验证记忆隔离
  console.log(`\n🔍 步骤 3: 验证记忆隔离`);

  // 查询组合 1 的记忆
  const memories1 = await getMemories(cookie, combinations[0].persona.id, combinations[0].character.id);
  console.log(`✓ 组合 1 的记忆数量: ${memories1.length}`);

  // 查询组合 2 的记忆
  const memories2 = await getMemories(cookie, combinations[1].persona.id, combinations[1].character.id);
  console.log(`✓ 组合 2 的记忆数量: ${memories2.length}`);

  // 验证组合 1 的记忆
  const memory1Content = memories1.map(m => m.content).join(' ');
  const hasJapaneseIn1 = memory1Content.includes('日语');
  const hasAnimeIn1 = memory1Content.includes('动漫');
  const hasFrenchIn1 = memory1Content.includes('法语');
  const hasMovieIn1 = memory1Content.includes('电影');

  results.push({
    scenario: scenario.name,
    test: '组合 1 记忆包含"日语"',
    passed: hasJapaneseIn1,
    message: hasJapaneseIn1 ? '✅ 通过' : '❌ 失败：未找到"日语"',
    details: { memories: memories1 }
  });

  results.push({
    scenario: scenario.name,
    test: '组合 1 记忆包含"动漫"',
    passed: hasAnimeIn1,
    message: hasAnimeIn1 ? '✅ 通过' : '❌ 失败：未找到"动漫"',
    details: { memories: memories1 }
  });

  results.push({
    scenario: scenario.name,
    test: '组合 1 记忆不包含"法语"（隔离验证）',
    passed: !hasFrenchIn1,
    message: !hasFrenchIn1 ? '✅ 通过' : '❌ 失败：发现"法语"泄露',
    details: { memories: memories1 }
  });

  results.push({
    scenario: scenario.name,
    test: '组合 1 记忆不包含"电影"（隔离验证）',
    passed: !hasMovieIn1,
    message: !hasMovieIn1 ? '✅ 通过' : '❌ 失败：发现"电影"泄露',
    details: { memories: memories1 }
  });

  // 验证组合 2 的记忆
  const memory2Content = memories2.map(m => m.content).join(' ');
  const hasFrenchIn2 = memory2Content.includes('法语');
  const hasMovieIn2 = memory2Content.includes('电影');
  const hasJapaneseIn2 = memory2Content.includes('日语');
  const hasAnimeIn2 = memory2Content.includes('动漫');

  results.push({
    scenario: scenario.name,
    test: '组合 2 记忆包含"法语"',
    passed: hasFrenchIn2,
    message: hasFrenchIn2 ? '✅ 通过' : '❌ 失败：未找到"法语"',
    details: { memories: memories2 }
  });

  results.push({
    scenario: scenario.name,
    test: '组合 2 记忆包含"电影"',
    passed: hasMovieIn2,
    message: hasMovieIn2 ? '✅ 通过' : '❌ 失败：未找到"电影"',
    details: { memories: memories2 }
  });

  results.push({
    scenario: scenario.name,
    test: '组合 2 记忆不包含"日语"（隔离验证）',
    passed: !hasJapaneseIn2,
    message: !hasJapaneseIn2 ? '✅ 通过' : '❌ 失败：发现"日语"泄露',
    details: { memories: memories2 }
  });

  results.push({
    scenario: scenario.name,
    test: '组合 2 记忆不包含"动漫"（隔离验证）',
    passed: !hasAnimeIn2,
    message: !hasAnimeIn2 ? '✅ 通过' : '❌ 失败：发现"动漫"泄露',
    details: { memories: memories2 }
  });
}

// 主函数
async function main() {
  console.log('🚀 人设记忆隔离测试');
  console.log('='.repeat(60));
  console.log(`测试环境: ${BASE_URL}`);
  console.log(`测试用户: ${TEST_USER_EMAIL}`);
  console.log('');

  try {
    // 登录
    const cookie = await login();

    // 运行测试场景
    await testScenario2(cookie);
    await testScenario3(cookie);

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

    const reportPath = `./test-results/persona-isolation-${Date.now()}.json`;
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
