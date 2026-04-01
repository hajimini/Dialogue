#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase configuration');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function updateEmbeddingDimension() {
  console.log('🔧 Updating embedding dimension from 1536 to 1024...\n');
  
  try {
    // Drop the existing index
    console.log('1. Dropping existing index...');
    const { error: dropError } = await supabase.rpc('exec_sql', {
      sql: 'DROP INDEX IF EXISTS idx_memories_embedding;'
    });
    
    if (dropError) {
      console.log('   Note: Index may not exist, continuing...');
    } else {
      console.log('   ✅ Index dropped');
    }
    
    // Alter the column
    console.log('2. Altering embedding column to 1024 dimensions...');
    const { error: alterError } = await supabase.rpc('exec_sql', {
      sql: 'ALTER TABLE memories ALTER COLUMN embedding TYPE VECTOR(1024);'
    });
    
    if (alterError) {
      console.error('   ❌ Error:', alterError.message);
      throw alterError;
    }
    console.log('   ✅ Column altered');
    
    // Recreate the index
    console.log('3. Recreating index with new dimension...');
    const { error: indexError } = await supabase.rpc('exec_sql', {
      sql: 'CREATE INDEX idx_memories_embedding ON memories USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);'
    });
    
    if (indexError) {
      console.error('   ❌ Error:', indexError.message);
      throw indexError;
    }
    console.log('   ✅ Index recreated');
    
    console.log('\n✅ Embedding dimension updated successfully!');
    console.log('   Old dimension: 1536 (OpenAI)');
    console.log('   New dimension: 1024 (NVIDIA NV-Embed-QA)');
    
  } catch (error) {
    console.error('\n❌ Failed to update embedding dimension:', error);
    console.log('\n💡 You may need to run the SQL manually in Supabase SQL Editor:');
    console.log('   See: scripts/update-embedding-dimension.sql');
    process.exit(1);
  }
}

updateEmbeddingDimension().catch(console.error);
