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

async function checkUsers() {
  const { data: users, error } = await supabase
    .from('profiles')
    .select('id, nickname, email, role');

  if (error) throw error;

  console.log('Users:\n');
  for (const user of users ?? []) {
    console.log(`${user.nickname || user.email}`);
    console.log(`  Email: ${user.email || 'N/A'}`);
    console.log(`  Role: ${user.role}`);
    console.log(`  ID: ${user.id}\n`);
  }
}

checkUsers().catch((error) => {
  console.error(error);
  process.exit(1);
});
