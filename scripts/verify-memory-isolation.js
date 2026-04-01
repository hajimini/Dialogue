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

async function verifyMemoryIsolation() {
  const { data: rows, error } = await supabase
    .from('memories')
    .select('id, user_id, persona_id, character_id')
    .limit(20);

  if (error) throw error;
  console.log(JSON.stringify(rows, null, 2));
}

verifyMemoryIsolation().catch((error) => {
  console.error(error);
  process.exit(1);
});
