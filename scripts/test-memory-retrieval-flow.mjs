import { config } from 'dotenv';
import pg from 'pg';

const { Pool } = pg;

config({ path: '.env.local' });

async function testMemoryRetrievalFlow() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('\n=== 测试记忆检索流程 ===\n');

    const sessionId = '45434024-fea4-4ecf-82e6-377505dfd453';
    const session = await pool.query(`
      SELECT id, user_id, persona_id, character_id
      FROM sessions
      WHERE id = $1
    `, [sessionId]);

    const { user_id, persona_id, character_id } = session.rows[0];

    // 模拟 getMemoryContext 的查询逻辑
    console.log('1. 检查记忆总数:');
    const totalMemories = await pool.query(`
      SELECT COUNT(*) as count
      FROM memories
      WHERE user_id = $1
        AND persona_id = $2
        AND character_id = $3
    `, [user_id, persona_id, character_id]);
    console.log(`   总记忆数: ${totalMemories.rows[0].count}`);

    // 2. 模拟向量搜索（使用短查询）
    console.log('\n2. 模拟向量搜索（查询: "雜事..."）:');
    const query = '雜事...';

    // 检查是否有embedding为null的记忆
    const nullEmbeddings = await pool.query(`
      SELECT COUNT(*) as count
      FROM memories
      WHERE user_id = $1
        AND persona_id = $2
        AND character_id = $3
        AND embedding IS NULL
    `, [user_id, persona_id, character_id]);
    console.log(`   embedding为null的记忆数: ${nullEmbeddings.rows[0].count}`);

    // 3. 模拟fallback查询（空查询）
    console.log('\n3. 模拟fallback查询（按更新时间排序）:');
    const fallbackMemories = await pool.query(`
      SELECT id, memory_type, content, updated_at
      FROM memories
      WHERE user_id = $1
        AND persona_id = $2
        AND character_id = $3
      ORDER BY updated_at DESC
      LIMIT 10
    `, [user_id, persona_id, character_id]);
    console.log(`   fallback返回: ${fallbackMemories.rows.length} 条记忆`);

    if (fallbackMemories.rows.length > 0) {
      console.log('\n   前3条记忆:');
      fallbackMemories.rows.slice(0, 3).forEach((mem, idx) => {
        console.log(`   ${idx + 1}. [${mem.memory_type}] ${mem.content.substring(0, 40)}...`);
      });
    }

    // 4. 检查用户画像
    console.log('\n4. 检查用户画像:');
    const profile = await pool.query(`
      SELECT id, relationship_stage, total_messages, profile_data
      FROM user_profiles_per_persona
      WHERE user_id = $1
        AND persona_id = $2
        AND character_id = $3
    `, [user_id, persona_id, character_id]);

    if (profile.rows.length > 0) {
      console.log(`   ✓ 找到用户画像`);
      console.log(`   关系阶段: ${profile.rows[0].relationship_stage}`);
      console.log(`   总消息数: ${profile.rows[0].total_messages}`);
      const summary = profile.rows[0].profile_data?.summary;
      if (summary) {
        console.log(`   摘要: ${summary.substring(0, 60)}...`);
      }
    } else {
      console.log('   ✗ 未找到用户画像');
    }

    console.log('\n=== 结论 ===');
    console.log('数据库中有记忆，fallback查询能返回结果。');
    console.log('如果前端显示0条记忆，问题可能在:');
    console.log('  1. getMemoryContext的向量搜索返回0结果');
    console.log('  2. fallback逻辑没有被触发');
    console.log('  3. 前端缓存问题');
    console.log('  4. API响应被过滤掉了');

    await pool.end();
  } catch (error) {
    console.error('\n❌ 测试失败:', error);
    await pool.end();
    process.exit(1);
  }
}

testMemoryRetrievalFlow();
