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

async function checkMemories() {
  const { data: memories, count, error } = await supabase
    .from('memories')
    .select('id, persona_id', { count: 'exact' });

  if (error) throw error;

  console.log(`Total memories: ${count}`);
  console.log(`Fetched: ${memories?.length || 0}`);

  if (memories && memories.length > 0) {
    const personaCounts = {};
    for (const memory of memories) {
      personaCounts[memory.persona_id] = (personaCounts[memory.persona_id] || 0) + 1;
    }

    console.log('\nBy persona_id:');
    for (const [personaId, personaCount] of Object.entries(personaCounts)) {
      console.log(`${personaId}: ${personaCount}`);
    }
  }
}

checkMemories().catch((error) => {
  console.error(error);
  process.exit(1);
});
