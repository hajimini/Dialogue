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

async function checkData() {
  const { data: memories, error: memoryError } = await supabase
    .from('memories')
    .select('id, user_id, persona_id, memory_type, retrieval_count, feedback_count_accurate, feedback_count_inaccurate')
    .limit(3);

  if (memoryError) throw memoryError;
  console.log('Memories:', JSON.stringify(memories, null, 2));

  const { data: personas, error: personaError } = await supabase
    .from('personas')
    .select('id, name, is_active')
    .eq('is_active', true);

  if (personaError) throw personaError;
  console.log('\nPersonas:', JSON.stringify(personas, null, 2));

  const { data: users, error: userError } = await supabase
    .from('profiles')
    .select('id, nickname')
    .limit(3);

  if (userError) throw userError;
  console.log('\nUsers:', JSON.stringify(users, null, 2));
}

checkData().catch((error) => {
  console.error(error);
  process.exit(1);
});
