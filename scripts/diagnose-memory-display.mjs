import { config } from 'dotenv';
import pg from 'pg';

const { Pool } = pg;

config({ path: '.env.local' });

async function diagnose() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('\n=== 诊断记忆显示问题 ===\n');

    const sessionId = '45434024-fea4-4ecf-82e6-377505dfd453';

    // 1. 验证会话和记忆存在
    const session = await pool.query(`
      SELECT s.id, s.user_id, s.persona_id, s.character_id,
             COUNT(m.id) as memory_count
      FROM sessions s
      LEFT JOIN memories m ON m.source_session_id = s.id
      WHERE s.id = $1
      GROUP BY s.id
    `, [sessionId]);

    if (session.rows.length === 0) {
      console.log('❌ 会话不存在');
      return;
    }

    const sess = session.rows[0];
    console.log('✓ 会话存在:');
    console.log(`  ID: ${sess.id}`);
    console.log(`  用户: ${sess.user_id}`);
    console.log(`  人设: ${sess.persona_id}`);
    console.log(`  角色: ${sess.character_id}`);
    console.log(`  记忆数: ${sess.memory_count}`);

    // 2. 检查该角色的所有记忆
    const allMemories = await pool.query(`
      SELECT COUNT(*) as count
      FROM memories
      WHERE user_id = $1
        AND persona_id = $2
        AND character_id = $3
    `, [sess.user_id, sess.persona_id, sess.character_id]);

    console.log(`\n✓ 该角色总记忆数: ${allMemories.rows[0].count}`);

    // 3. 检查最近的消息
    const messages = await pool.query(`
      SELECT role, content, created_at
      FROM messages
      WHERE session_id = $1
      ORDER BY created_at DESC
      LIMIT 3
    `, [sessionId]);

    console.log(`\n✓ 最近3条消息:`);
    messages.rows.forEach((msg, idx) => {
      console.log(`  ${idx + 1}. [${msg.role}] ${msg.content.substring(0, 50)}...`);
    });

    // 4. 模拟API会返回什么
    console.log(`\n=== 模拟API响应 ===`);

    const apiMemories = await pool.query(`
      SELECT id, memory_type, content, updated_at
      FROM memories
      WHERE user_id = $1
        AND persona_id = $2
        AND character_id = $3
      ORDER BY updated_at DESC
      LIMIT 3
    `, [sess.user_id, sess.persona_id, sess.character_id]);

    console.log(`API应该返回 ${apiMemories.rows.length} 条记忆:`);
    apiMemories.rows.forEach((mem, idx) => {
      console.log(`  ${idx + 1}. [${mem.memory_type}] ${mem.content.substring(0, 60)}...`);
    });

    // 5. 检查用户画像
    const profile = await pool.query(`
      SELECT profile_data
      FROM user_profiles_per_persona
      WHERE user_id = $1
        AND persona_id = $2
        AND character_id = $3
    `, [sess.user_id, sess.persona_id, sess.character_id]);

    if (profile.rows.length > 0 && profile.rows[0].profile_data?.summary) {
      console.log(`\n✓ 用户画像摘要: ${profile.rows[0].profile_data.summary.substring(0, 80)}...`);
    }

    console.log(`\n=== 诊断结论 ===`);
    console.log(`数据库中有 ${allMemories.rows[0].count} 条记忆`);
    console.log(`API应该返回前 ${apiMemories.rows.length} 条记忆`);
    console.log(`\n如果前端显示0条记忆，请检查:`);
    console.log(`1. 打开浏览器开发者工具 (F12)`);
    console.log(`2. 切换到 Console 标签`);
    console.log(`3. 刷新聊天页面`);
    console.log(`4. 查找以 "[MemoryContext]" 开头的日志`);
    console.log(`5. 检查 Network 标签中的 memory-context API 请求`);
    console.log(`\n如果没有看到日志，说明API没有被调用`);
    console.log(`如果看到日志但返回0条，说明检索逻辑有问题`);

    await pool.end();
  } catch (error) {
    console.error('\n❌ 诊断失败:', error);
    await pool.end();
    process.exit(1);
  }
}

diagnose();
