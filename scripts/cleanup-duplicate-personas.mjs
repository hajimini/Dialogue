import { config } from 'dotenv';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';

config({ path: resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function cleanup() {
  console.log('🧹 清理重复的"小芮嫣 Cache"人设\n');

  // 查询所有"小芮嫣 Cache"人设
  const { data: duplicates, error: queryError } = await supabase
    .from('personas')
    .select('id, name, created_at')
    .eq('name', '小芮嫣 Cache')
    .order('created_at');

  if (queryError) {
    console.error('❌ 查询失败:', queryError);
    process.exit(1);
  }

  if (!duplicates || duplicates.length === 0) {
    console.log('✅ 没有找到需要清理的人设');
    return;
  }

  console.log(`找到 ${duplicates.length} 个"小芮嫣 Cache"人设：\n`);
  duplicates.forEach((p, i) => {
    console.log(`${i + 1}. ID: ${p.id}`);
    console.log(`   创建时间: ${p.created_at}\n`);
  });

  // 检查是否有关联的会话
  console.log('检查关联数据...\n');
  for (const persona of duplicates) {
    const { count, error } = await supabase
      .from('sessions')
      .select('*', { count: 'exact', head: true })
      .eq('persona_id', persona.id);

    if (error) {
      console.error(`❌ 检查会话失败 (${persona.id}):`, error);
    } else {
      console.log(`  ${persona.id}: ${count || 0} 个会话`);
    }
  }

  console.log('\n开始删除...\n');

  // 删除所有"小芮嫣 Cache"人设
  const idsToDelete = duplicates.map(p => p.id);

  const { error: deleteError } = await supabase
    .from('personas')
    .delete()
    .in('id', idsToDelete);

  if (deleteError) {
    console.error('❌ 删除失败:', deleteError);
    process.exit(1);
  }

  console.log(`✅ 成功删除 ${duplicates.length} 个重复人设\n`);

  // 验证删除结果
  const { data: remaining, error: verifyError } = await supabase
    .from('personas')
    .select('id, name')
    .eq('name', '小芮嫣 Cache');

  if (verifyError) {
    console.error('❌ 验证失败:', verifyError);
  } else if (remaining && remaining.length > 0) {
    console.log(`⚠️  还剩 ${remaining.length} 个"小芮嫣 Cache"人设`);
  } else {
    console.log('✅ 所有"小芮嫣 Cache"人设已清理完毕');
  }

  // 显示最终的人设列表
  console.log('\n当前人设列表：\n');
  const { data: allPersonas } = await supabase
    .from('personas')
    .select('id, name')
    .order('name');

  if (allPersonas) {
    const grouped = {};
    for (const p of allPersonas) {
      if (!grouped[p.name]) {
        grouped[p.name] = 0;
      }
      grouped[p.name]++;
    }

    for (const [name, count] of Object.entries(grouped)) {
      console.log(`  ${name}: ${count}个`);
    }
  }
}

cleanup().catch(error => {
  console.error('执行失败:', error);
  process.exit(1);
});
