import { config } from 'dotenv';
import pg from 'pg';

const { Pool } = pg;

config({ path: '.env.local' });

async function testMemoryContext() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('\n=== 测试记忆上下文查询 ===\n');

    // 1. 获取会话信息
    const sessionId = '45434024-fea4-4ecf-82e6-377505dfd453';
    const session = await pool.query(`
      SELECT id, user_id, persona_id, character_id
      FROM sessions
      WHERE id = $1
    `, [sessionId]);

    if (session.rows.length === 0) {
      console.log('❌ 会话未找到');
      return;
    }

    const { user_id, persona_id, character_id } = session.rows[0];
    console.log('会话信息:');
    console.log(`  user_id: ${user_id}`);
    console.log(`  persona_id: ${persona_id}`);
    console.log(`  character_id: ${character_id}`);

    // 2. 获取最近的消息
    const messages = await pool.query(`
      SELECT id, role, content, created_at
      FROM messages
      WHERE session_id = $1
      ORDER BY created_at DESC
      LIMIT 5
    `, [sessionId]);

    console.log(`\n最近 ${messages.rows.length} 条消息:`);
    messages.rows.forEach((msg, idx) => {
      console.log(`  ${idx + 1}. [${msg.role}] ${msg.content.substring(0, 40)}...`);
    });

    const latestUserMessage = messages.rows.find(m => m.role === 'user')?.content || '';
    console.log(`\n最新用户消息: ${latestUserMessage.substring(0, 100)}...`);

    // 3. 直接查询记忆（不使用向量搜索）
    console.log('\n直接查询记忆（按更新时间排序）:');
    const directMemories = await pool.query(`
      SELECT id, memory_type, content, updated_at
      FROM memories
      WHERE user_id = $1
        AND persona_id = $2
        AND character_id = $3
      ORDER BY updated_at DESC
      LIMIT 10
    `, [user_id, persona_id, character_id]);

    console.log(`  找到 ${directMemories.rows.length} 条记忆`);
    directMemories.rows.forEach((mem, idx) => {
      console.log(`  ${idx + 1}. [${mem.memory_type}] ${mem.content.substring(0, 40)}...`);
    });

    // 4. 检查记忆是否有embedding
    console.log('\n检查记忆embedding:');
    const embeddingCheck = await pool.query(`
      SELECT
        id,
        memory_type,
        embedding IS NOT NULL as has_embedding
      FROM memories
      WHERE user_id = $1
        AND persona_id = $2
        AND character_id = $3
      LIMIT 5
    `, [user_id, persona_id, character_id]);

    embeddingCheck.rows.forEach((mem, idx) => {
      console.log(`  ${idx + 1}. ${mem.memory_type}: embedding=${mem.has_embedding}`);
    });

    await pool.end();
  } catch (error) {
    console.error('\n❌ 测试失败:', error);
    await pool.end();
    process.exit(1);
  }
}

testMemoryContext();
