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

async function setupEverything() {
  console.log('=== Full Setup ===\n');

  const { error: characterTableError } = await supabase
    .from('user_characters')
    .select('id')
    .limit(1);

  if (characterTableError && characterTableError.message.includes('does not exist')) {
    console.log('user_characters table is missing. Run the SQL migrations first.');
    return;
  }

  const { data: users, error: userError } = await supabase
    .from('profiles')
    .select('id, nickname')
    .limit(5);

  if (userError) throw userError;

  console.log(`Profiles found: ${(users ?? []).length}`);
  console.log('Setup prerequisites look ready.');
}

setupEverything().catch((error) => {
  console.error(error);
  process.exit(1);
});
