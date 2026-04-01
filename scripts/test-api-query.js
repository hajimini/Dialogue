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

async function testQuery() {
  const userId = process.argv[2];
  const personaId = process.argv[3];

  if (!userId || !personaId) {
    throw new Error('Usage: node scripts/test-api-query.js <userId> <personaId>');
  }

  const { data: memories, error } = await supabase
    .from('memories')
    .select('*')
    .eq('user_id', userId)
    .eq('persona_id', personaId);

  if (error) {
    throw error;
  }

  console.log(
    JSON.stringify(
      {
        count: memories?.length ?? 0,
        preview: memories?.slice(0, 3) ?? [],
      },
      null,
      2,
    ),
  );
}

testQuery().catch((error) => {
  console.error(error);
  process.exit(1);
});
