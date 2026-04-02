import { config } from 'dotenv';
import pg from 'pg';

const { Pool } = pg;

config({ path: '.env.local' });

async function checkImportMemories() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    // 获取最近导入的会话
    const sessions = await pool.query(`
      SELECT
        s.id,
        s.user_id,
        s.persona_id,
        s.character_id,
        s.summary,
        s.started_at,
        COUNT(m.id) as message_count
      FROM sessions s
      LEFT JOIN messages m ON m.session_id = s.id
      WHERE s.started_at > NOW() - INTERVAL '1 hour'
      GROUP BY s.id
      ORDER BY s.started_at DESC
      LIMIT 5
    `);

    console.log('\n=== 最近的会话 ===');
    for (const session of sessions.rows) {
      console.log(`\n会话 ID: ${session.id}`);
      console.log(`消息数量: ${session.message_count}`);
      console.log(`摘要: ${session.summary || '(无)'}`);
      console.log(`角色 ID: ${session.character_id}`);

      // 检查该会话的记忆
      const memories = await pool.query(`
        SELECT
          id,
          memory_type,
          content,
          importance,
          character_id,
          source_session_id,
          created_at
        FROM memories
        WHERE source_session_id = $1
        ORDER BY created_at DESC
      `, [session.id]);

      console.log(`记忆数量: ${memories.rows.length}`);
      if (memories.rows.length > 0) {
        console.log('记忆列表:');
        memories.rows.forEach((mem, idx) => {
          console.log(`  ${idx + 1}. [${mem.memory_type}] ${mem.content.substring(0, 50)}...`);
          console.log(`     角色ID: ${mem.character_id}`);
        });
      }

      // 检查用户画像
      const profile = await pool.query(`
        SELECT
          id,
          character_id,
          profile_data,
          relationship_stage,
          total_messages,
          updated_at
        FROM user_profiles_per_persona
        WHERE user_id = $1
          AND persona_id = $2
          AND character_id = $3
      `, [session.user_id, session.persona_id, session.character_id]);

      if (profile.rows.length > 0) {
        console.log('用户画像已更新:');
        console.log(`  关系阶段: ${profile.rows[0].relationship_stage}`);
        console.log(`  总消息数: ${profile.rows[0].total_messages}`);
        console.log(`  更新时间: ${profile.rows[0].updated_at}`);
      } else {
        console.log('用户画像: 未找到');
      }
    }

    await pool.end();
  } catch (error) {
    console.error('检查失败:', error);
    await pool.end();
    process.exit(1);
  }
}

checkImportMemories();
