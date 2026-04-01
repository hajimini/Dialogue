/**
 * Check actual Supabase schema
 */

import { config } from 'dotenv';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';

config({ path: resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Try to get schema info by attempting an insert with minimal data
const { data, error } = await supabase
  .from('memories')
  .select('*')
  .limit(1);

console.log('Query result:', { data, error });

// Try inserting with a UUID
const testId = '123e4567-e89b-12d3-a456-426614174000';
const testEmbedding = Array(1536).fill(0).map(() => Math.random());

const { data: insertData, error: insertError } = await supabase
  .from('memories')
  .insert({
    user_id: testId,
    persona_id: testId,
    memory_type: 'user_fact',
    content: 'Test',
    embedding: testEmbedding,
    importance: 0.5,
  })
  .select()
  .single();

console.log('Insert result:', { insertData, insertError });

if (insertData) {
  // Clean up
  await supabase.from('memories').delete().eq('id', insertData.id);
  console.log('Cleaned up test data');
}
