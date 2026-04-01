#!/usr/bin/env tsx
export {};
/**
 * 快速测试记忆隔离 - 简化版
 */

const BASE_URL = 'http://localhost:3000';
const TEST_USER_EMAIL = 'admin@ai-companion.local';
const TEST_USER_PASSWORD = 'admin123456';

async function login() {
  const response = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: TEST_USER_EMAIL, password: TEST_USER_PASSWORD })
  });
  const cookies = response.headers.get('set-cookie');
  if (!cookies) throw new Error('No cookies');
  return cookies;
}

async function getPersonas(cookie: string) {
  const response = await fetch(`${BASE_URL}/api/personas`, {
    headers: { Cookie: cookie }
  });
  const data = await response.json();
  return data.data || [];
}

async function getCharacters(cookie: string) {
  const response = await fetch(`${BASE_URL}/api/characters`, {
    headers: { Cookie: cookie }
  });
  const data = await response.json();
  return data.data?.characters || [];
}

async function createSession(cookie: string, personaId: string, characterId: string) {
  const response = await fetch(`${BASE_URL}/api/personas/${personaId}/sessions`, {
    method: 'POST',
    headers: { Cookie: cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ character_id: characterId })
  });
  const data = await response.json();
  return data.data.session_id;
}

async function sendMessage(cookie: string, personaId: string, sessionId: string, message: string) {
  const response = await fetch(`${BASE_URL}/api/chat`, {
    method: 'POST',
    headers: { Cookie: cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ persona_id: personaId, session_id: sessionId, message })
  });
  const data = await response.json();
  return data.data.reply;
}

async function main() {
  console.log('🚀 快速隔离测试\n');

  const cookie = await login();
  console.log('✅ 登录成功\n');

  const personas = await getPersonas(cookie);
  const characters = await getCharacters(cookie);

  const persona = personas.find((p: any) => p.name === '小芮嫣');
  const charA = characters.find((c: any) => c.name === '直连A-082698');
  const charB = characters.find((c: any) => c.name === '直连B-082698');

  console.log(`人设: ${persona.name}`);
  console.log(`角色 A: ${charA.name}`);
  console.log(`角色 B: ${charB.name}\n`);

  // 创建两个独立会话
  const sessionA = await createSession(cookie, persona.id, charA.id);
  const sessionB = await createSession(cookie, persona.id, charB.id);

  console.log(`会话 A: ${sessionA}`);
  console.log(`会话 B: ${sessionB}\n`);

  // 角色 A: 告诉它喜欢红色
  console.log('📝 角色 A 对话:');
  const reply1 = await sendMessage(cookie, persona.id, sessionA, '我最喜欢的颜色是红色');
  console.log(`  用户: 我最喜欢的颜色是红色`);
  console.log(`  AI: ${reply1.substring(0, 50)}...\n`);

  // 等待记忆存储
  await new Promise(resolve => setTimeout(resolve, 3000));

  // 角色 B: 告诉它喜欢蓝色
  console.log('📝 角色 B 对话:');
  const reply2 = await sendMessage(cookie, persona.id, sessionB, '我最喜欢的颜色是蓝色');
  console.log(`  用户: 我最喜欢的颜色是蓝色`);
  console.log(`  AI: ${reply2.substring(0, 50)}...\n`);

  // 等待记忆存储
  await new Promise(resolve => setTimeout(resolve, 3000));

  // 测试：询问角色 A
  console.log('🔍 测试角色 A:');
  const testReplyA = await sendMessage(cookie, persona.id, sessionA, '你还记得我最喜欢的颜色吗？');
  console.log(`  用户: 你还记得我最喜欢的颜色吗？`);
  console.log(`  AI: ${testReplyA}`);

  const hasRed = testReplyA.includes('红') || testReplyA.includes('紅');
  const hasBlue = testReplyA.includes('蓝') || testReplyA.includes('藍');

  console.log(`\n结果:`);
  console.log(`  包含"红色": ${hasRed ? '✅' : '❌'}`);
  console.log(`  包含"蓝色": ${hasBlue ? '❌ (泄露!)' : '✅'}`);

  if (!hasRed || hasBlue) {
    console.log('\n❌ 测试失败：记忆隔离有问题！');
    process.exit(1);
  } else {
    console.log('\n✅ 测试通过：记忆隔离正常！');
    process.exit(0);
  }
}

main().catch(err => {
  console.error('错误:', err);
  process.exit(1);
});
