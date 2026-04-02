import { config } from 'dotenv';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';

config({ path: resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

try {
  const { data, error } = await supabase
    .from('personas')
    .select('id, name, created_at')
    .order('name')
    .order('created_at');

  if (error) {
    console.error('查询失败:', error);
    process.exit(1);
  }

  console.log(`\n总共有 ${data.length} 个人设：\n`);

  // 按名字分组
  const grouped = {};
  for (const row of data) {
    if (!grouped[row.name]) {
      grouped[row.name] = [];
    }
    grouped[row.name].push(row);
  }

  // 显示每个名字的人设
  for (const [name, personas] of Object.entries(grouped)) {
    console.log(`${name} (${personas.length}个):`);
    for (const p of personas) {
      console.log(`  - ID: ${p.id}`);
      console.log(`    created_at: ${p.created_at}`);
    }
    console.log('');
  }

} catch (error) {
  console.error('执行失败:', error);
  process.exit(1);
}
