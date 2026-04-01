const path = require('node:path');
const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

async function setupCharacterSystem() {
  console.log('=== Character System Setup ===\n');

  const { data: users, error } = await supabase
    .from('profiles')
    .select('id, nickname');

  if (error) throw error;

  for (const user of users ?? []) {
    const { data: existingCharacters, error: existingError } = await supabase
      .from('user_characters')
      .select('id')
      .eq('owner_id', user.id)
      .limit(1);

    if (existingError) throw existingError;
    if ((existingCharacters ?? []).length > 0) continue;

    const { data: character, error: insertError } = await supabase
      .from('user_characters')
      .insert({
        owner_id: user.id,
        name: `${user.nickname} 的默认角色`,
        personality: '系统默认角色',
        bio: '用于承接历史数据',
      })
      .select()
      .single();

    if (insertError) throw insertError;
    console.log(`Created default character ${character.id} for ${user.nickname}`);
  }
}

setupCharacterSystem().catch((error) => {
  console.error(error);
  process.exit(1);
});
