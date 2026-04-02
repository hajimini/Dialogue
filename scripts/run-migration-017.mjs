import { config } from 'dotenv';
import pg from 'pg';

const { Pool } = pg;

// 加载 .env.local
config({ path: '.env.local' });

async function runMigration() {
  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;

  if (!connectionString) {
    console.error('✗ 错误: 未找到 DATABASE_URL 或 POSTGRES_URL 环境变量');
    console.error('  请确保 .env.local 文件中配置了数据库连接字符串');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('开始执行迁移 017: 修复外键约束...\n');

    // 1. 修复 memories 表的 source_session_id 外键
    console.log('1. 修复 memories.source_session_id 外键...');
    await pool.query(`
      ALTER TABLE public.memories
      DROP CONSTRAINT IF EXISTS memories_source_session_id_fkey;
    `);
    await pool.query(`
      ALTER TABLE public.memories
      ADD CONSTRAINT memories_source_session_id_fkey
      FOREIGN KEY (source_session_id)
      REFERENCES public.sessions(id)
      ON DELETE CASCADE;
    `);
    console.log('   ✓ memories.source_session_id 已设置为 CASCADE\n');

    // 2. 修复 evaluation_logs 表的 session_id 外键
    console.log('2. 修复 evaluation_logs.session_id 外键...');
    await pool.query(`
      ALTER TABLE public.evaluation_logs
      DROP CONSTRAINT IF EXISTS evaluation_logs_session_id_fkey;
    `);
    await pool.query(`
      ALTER TABLE public.evaluation_logs
      ADD CONSTRAINT evaluation_logs_session_id_fkey
      FOREIGN KEY (session_id)
      REFERENCES public.sessions(id)
      ON DELETE CASCADE;
    `);
    console.log('   ✓ evaluation_logs.session_id 已设置为 CASCADE\n');

    // 3. 修复 evaluation_logs 表的 message_id 外键
    console.log('3. 修复 evaluation_logs.message_id 外键...');
    await pool.query(`
      ALTER TABLE public.evaluation_logs
      DROP CONSTRAINT IF EXISTS evaluation_logs_message_id_fkey;
    `);
    await pool.query(`
      ALTER TABLE public.evaluation_logs
      ADD CONSTRAINT evaluation_logs_message_id_fkey
      FOREIGN KEY (message_id)
      REFERENCES public.messages(id)
      ON DELETE CASCADE;
    `);
    console.log('   ✓ evaluation_logs.message_id 已设置为 CASCADE\n');

    console.log('✓ 迁移完成！');
    console.log('  删除会话时，会级联删除：');
    console.log('  - messages（消息记录）');
    console.log('  - memories（记忆数据）');
    console.log('  - evaluation_logs（评估日志）');
    console.log('  - 并清理相关缓存');

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('\n✗ 迁移失败:', error.message);
    console.error(error);
    await pool.end();
    process.exit(1);
  }
}

runMigration();
