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

async function quickSetup() {
  const { data: users, error } = await supabase
    .from('profiles')
    .select('id, nickname');

  if (error) throw error;
  if (!users || users.length === 0) {
    console.log('No users found');
    return;
  }

  const user = users[0];
  const testCharacters = [
    {
      name: '开朗的小明',
      personality: '性格开朗外向，喜欢交朋友。',
      bio: '测试角色 1',
    },
    {
      name: '内向的小红',
      personality: '性格安静，喜欢独处。',
      bio: '测试角色 2',
    },
    {
      name: '幽默的老王',
      personality: '幽默风趣，善于活跃气氛。',
      bio: '测试角色 3',
    },
  ];

  for (const character of testCharacters) {
    const { data, error: insertError } = await supabase
      .from('user_characters')
      .insert({
        owner_id: user.id,
        ...character,
      })
      .select()
      .single();

    if (insertError) throw insertError;
    console.log(`Created test character: ${data.name} (${data.id})`);
  }
}

quickSetup().catch((error) => {
  console.error(error);
  process.exit(1);
});
