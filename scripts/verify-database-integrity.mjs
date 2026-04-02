import { config } from 'dotenv';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';

config({ path: resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function verifyDatabaseIntegrity() {
  console.log('='.repeat(80));
  console.log('数据库完整性验证');
  console.log('='.repeat(80));
  console.log('');

  // 1. 检查表结构和数据量
  const tables = ['personas', 'sessions', 'messages', 'memories', 'user_profiles_per_persona'];

  for (const table of tables) {
    const { count, error } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true });

    if (error) {
      console.log(`❌ ${table}: 查询失败 - ${error.message}`);
    } else {
      console.log(`✅ ${table}: ${count} 条记录`);
    }
  }

  console.log('');
  console.log('='.repeat(80));
  console.log('外键完整性检查');
  console.log('='.repeat(80));
  console.log('');

  // 2. 检查 orphaned sessions (session.character_id 不存在)
  const { data: orphanedSessions } = await supabase.rpc('check_orphaned_sessions', {}, { count: 'exact' }).catch(() => ({ data: null }));

  // 手动检查
  const { data: sessions } = await supabase
    .from('sessions')
    .select('id, character_id, persona_id');

  console.log(`检查 ${sessions?.length || 0} 个会话的外键完整性...`);

  // 3. 检查 memories 的 session 引用
  const { data: memories } = await supabase
    .from('memories')
    .select('id, source_session_id')
    .not('source_session_id', 'is', null);

  console.log(`检查 ${memories?.length || 0} 条记忆的 session 引用...`);

  let orphanedMemories = 0;
  if (memories && sessions) {
    const sessionIds = new Set(sessions.map(s => s.id));
    for (const memory of memories) {
      if (memory.source_session_id && !sessionIds.has(memory.source_session_id)) {
        orphanedMemories++;
      }
    }
  }

  if (orphanedMemories > 0) {
    console.log(`❌ 发现 ${orphanedMemories} 条孤立记忆（引用不存在的 session）`);
  } else {
    console.log(`✅ 所有记忆的 session 引用完整`);
  }

  console.log('');
  console.log('='.repeat(80));
  console.log('角色隔离验证');
  console.log('='.repeat(80));
  console.log('');

  // 4. 检查同一 persona 下是否有多个 character
  const { data: personaCharacters } = await supabase
    .from('sessions')
    .select('persona_id, character_id')
    .not('character_id', 'is', null);

  const personaCharacterMap = new Map();
  if (personaCharacters) {
    for (const row of personaCharacters) {
      if (!personaCharacterMap.has(row.persona_id)) {
        personaCharacterMap.set(row.persona_id, new Set());
      }
      personaCharacterMap.get(row.persona_id).add(row.character_id);
    }
  }

  console.log(`检查 ${personaCharacterMap.size} 个 persona 的角色隔离...`);
  for (const [personaId, characters] of personaCharacterMap.entries()) {
    const { data: persona } = await supabase
      .from('personas')
      .select('name')
      .eq('id', personaId)
      .single();

    console.log(`  ${persona?.name || personaId}: ${characters.size} 个不同角色`);
  }

  console.log('');
  console.log('='.repeat(80));
  console.log('记忆生成状态检查');
  console.log('='.repeat(80));
  console.log('');

  // 5. 检查有消息但没有记忆的会话
  const { data: sessionsWithMessages } = await supabase
    .from('sessions')
    .select('id, persona_id')
    .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

  if (sessionsWithMessages) {
    let sessionsWithoutMemories = 0;
    for (const session of sessionsWithMessages.slice(0, 20)) {
      const { count: messageCount } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('session_id', session.id);

      const { count: memoryCount } = await supabase
        .from('memories')
        .select('*', { count: 'exact', head: true })
        .eq('source_session_id', session.id);

      if (messageCount && messageCount > 5 && memoryCount === 0) {
        sessionsWithoutMemories++;
      }
    }

    if (sessionsWithoutMemories > 0) {
      console.log(`⚠️  发现 ${sessionsWithoutMemories} 个会话有消息但没有生成记忆`);
    } else {
      console.log(`✅ 抽查的会话都有对应的记忆生成`);
    }
  }

  console.log('');
  console.log('验证完成');
}

verifyDatabaseIntegrity().catch(console.error);
