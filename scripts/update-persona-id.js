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

async function updatePersonaId() {
  const fromPersonaId = process.argv[2];
  const toPersonaId = process.argv[3];

  if (!fromPersonaId || !toPersonaId) {
    throw new Error('Usage: node scripts/update-persona-id.js <fromPersonaId> <toPersonaId>');
  }

  const { data, error } = await supabase
    .from('memories')
    .update({ persona_id: toPersonaId })
    .eq('persona_id', fromPersonaId)
    .select('id');

  if (error) throw error;

  console.log(`Updated ${data.length} memories.`);
}

updatePersonaId().catch((error) => {
  console.error(error);
  process.exit(1);
});
