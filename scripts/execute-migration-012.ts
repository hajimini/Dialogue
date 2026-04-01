import { createClient } from '@supabase/supabase-js';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

async function executeMigration() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  console.log('Starting migration 012...\n');

  const { data: sessionsWithNull } = await supabase
    .from('sessions')
    .select('user_id')
    .is('character_id', null);

  const uniqueUserIds = [...new Set(sessionsWithNull?.map((session) => session.user_id) || [])];
  console.log(`Found ${uniqueUserIds.length} users with NULL character_id sessions`);

  for (const userId of uniqueUserIds) {
    const { data: existing } = await supabase
      .from('user_characters')
      .select('id')
      .eq('owner_id', userId)
      .eq('name', '默认角色')
      .single();

    if (!existing) {
      const { data: newChar, error } = await supabase
        .from('user_characters')
        .insert({
          owner_id: userId,
          name: '默认角色',
          personality: '系统默认角色',
          is_active: true,
        })
        .select('id')
        .single();

      if (error) {
        console.error(`Error creating default character for user ${userId}:`, error);
      } else {
        console.log(`Created default character ${newChar.id} for user ${userId}`);
      }
    }
  }
}

executeMigration().catch((error) => {
  console.error(error);
  process.exit(1);
});
