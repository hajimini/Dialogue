import { config } from 'dotenv';
import pg from 'pg';

const { Pool } = pg;

config({ path: '.env.local' });

async function debugMemoryIssue() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('\n=== 调试记忆显示问题 ===\n');

    // 1. 查找"芷晴秋葉🍂"人设
    console.log('1. 查找人设...');
    const personas = await pool.query(`
      SELECT id, name FROM personas WHERE name LIKE '%芷晴%' OR name LIKE '%秋葉%'
    `);

    if (personas.rows.length === 0) {
      console.log('❌ 未找到匹配的人设');
      return;
    }

    const persona = personas.rows[0];
    console.log(`✓ 找到人设: ${persona.name} (${persona.id})`);

    // 2. 查找"忠良"角色
    console.log('\n2. 查找角色...');
    const characters = await pool.query(`
      SELECT id, name, owner_id FROM user_characters WHERE name LIKE '%忠良%'
    `);

    if (characters.rows.length === 0) {
      console.log('❌ 未找到匹配的角色');
      return;
    }

    const character = characters.rows[0];
    console.log(`✓ 找到角色: ${character.name} (${character.id})`);
    console.log(`  所有者: ${character.owner_id}`);

    // 3. 查找该人设和角色的会话
    console.log('\n3. 查找会话...');
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
      WHERE s.persona_id = $1 AND s.character_id = $2
      GROUP BY s.id
      ORDER BY s.started_at DESC
      LIMIT 3
    `, [persona.id, character.id]);

    if (sessions.rows.length === 0) {
      console.log('❌ 未找到匹配的会话');
      return;
    }

    console.log(`✓ 找到 ${sessions.rows.length} 个会话`);

    for (const session of sessions.rows) {
      console.log(`\n--- 会话 ${session.id.substring(0, 8)} ---`);
      console.log(`  消息数: ${session.message_count}`);
      console.log(`  摘要: ${session.summary ? session.summary.substring(0, 50) + '...' : '(无)'}`);
      console.log(`  用户ID: ${session.user_id}`);
      console.log(`  人设ID: ${session.persona_id}`);
      console.log(`  角色ID: ${session.character_id}`);

      // 4. 检查该会话的记忆
      console.log('\n  检查记忆...');
      const memories = await pool.query(`
        SELECT
          id,
          user_id,
          persona_id,
          character_id,
          memory_type,
          content,
          source_session_id,
          created_at
        FROM memories
        WHERE source_session_id = $1
        ORDER BY created_at DESC
      `, [session.id]);

      console.log(`  ✓ 找到 ${memories.rows.length} 条记忆`);

      if (memories.rows.length > 0) {
        console.log('\n  记忆详情:');
        memories.rows.forEach((mem, idx) => {
          console.log(`    ${idx + 1}. [${mem.memory_type}] ${mem.content.substring(0, 40)}...`);
          console.log(`       用户ID: ${mem.user_id}`);
          console.log(`       人设ID: ${mem.persona_id}`);
          console.log(`       角色ID: ${mem.character_id}`);
          console.log(`       来源会话: ${mem.source_session_id}`);
        });

        // 5. 检查前端API会如何查询这些记忆
        console.log('\n  模拟前端API查询...');
        console.log(`  查询条件:`);
        console.log(`    user_id = ${session.user_id}`);
        console.log(`    persona_id = ${session.persona_id}`);
        console.log(`    character_id = ${session.character_id}`);

        // 模拟 getMemoryContext 的查询
        const apiMemories = await pool.query(`
          SELECT
            id,
            user_id,
            persona_id,
            character_id,
            memory_type,
            content
          FROM memories
          WHERE user_id = $1
            AND persona_id = $2
            AND character_id = $3
          ORDER BY updated_at DESC
          LIMIT 10
        `, [session.user_id, session.persona_id, session.character_id]);

        console.log(`  ✓ API查询结果: ${apiMemories.rows.length} 条记忆`);

        if (apiMemories.rows.length === 0) {
          console.log('\n  ❌ 问题找到了！API查询返回0条记忆');
          console.log('  可能原因:');
          console.log('    1. user_id 不匹配');
          console.log('    2. persona_id 不匹配');
          console.log('    3. character_id 不匹配');

          // 详细对比
          console.log('\n  详细对比:');
          console.log(`  会话的 user_id: ${session.user_id}`);
          console.log(`  记忆的 user_id: ${memories.rows[0].user_id}`);
          console.log(`  匹配: ${session.user_id === memories.rows[0].user_id ? '✓' : '✗'}`);

          console.log(`\n  会话的 persona_id: ${session.persona_id}`);
          console.log(`  记忆的 persona_id: ${memories.rows[0].persona_id}`);
          console.log(`  匹配: ${session.persona_id === memories.rows[0].persona_id ? '✓' : '✗'}`);

          console.log(`\n  会话的 character_id: ${session.character_id}`);
          console.log(`  记忆的 character_id: ${memories.rows[0].character_id}`);
          console.log(`  匹配: ${session.character_id === memories.rows[0].character_id ? '✓' : '✗'}`);
        } else {
          console.log('  ✓ API查询正常，记忆应该能显示');
        }
      }

      // 6. 检查用户画像
      console.log('\n  检查用户画像...');
      const profile = await pool.query(`
        SELECT
          id,
          user_id,
          persona_id,
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
        console.log(`  ✓ 找到用户画像`);
        console.log(`    关系阶段: ${profile.rows[0].relationship_stage}`);
        console.log(`    总消息数: ${profile.rows[0].total_messages}`);
        console.log(`    更新时间: ${profile.rows[0].updated_at}`);
      } else {
        console.log('  ✗ 未找到用户画像');
      }
    }

    await pool.end();
  } catch (error) {
    console.error('\n❌ 检查失败:', error);
    await pool.end();
    process.exit(1);
  }
}

debugMemoryIssue();
