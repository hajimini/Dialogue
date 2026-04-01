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

async function checkPersonas() {
  const { data: personas, error } = await supabase
    .from('personas')
    .select('id, name, is_active, created_at')
    .order('created_at', { ascending: false });

  if (error) throw error;

  console.log('All personas:');
  for (const [index, persona] of (personas ?? []).entries()) {
    console.log(
      `${index + 1}. ${persona.name} - ${persona.is_active ? 'active' : 'inactive'} - ID: ${persona.id}`,
    );
  }

  console.log('\nMemory count by persona:');
  for (const persona of personas ?? []) {
    const { count, error: memoryError } = await supabase
      .from('memories')
      .select('id', { count: 'exact', head: true })
      .eq('persona_id', persona.id);

    if (memoryError) throw memoryError;
    console.log(`${persona.name}: ${count || 0}`);
  }
}

checkPersonas().catch((error) => {
  console.error(error);
  process.exit(1);
});
