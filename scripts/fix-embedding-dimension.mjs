#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase configuration');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixEmbeddingDimension() {
  console.log('🔧 Fixing embedding dimension mismatch...\n');
  
  try {
    // Check current dimension
    console.log('1. Checking current schema...');
    const { data: currentSchema, error: schemaError } = await supabase
      .from('memories')
      .select('embedding')
      .limit(1);
    
    if (schemaError && !schemaError.message.includes('no rows')) {
      console.log(`   Current schema check: ${schemaError.message}`);
    }
    
    // The easiest fix is to drop and recreate the table with correct dimension
    console.log('2. Dropping existing index...');
    const dropIndexSQL = 'DROP INDEX IF EXISTS idx_memories_embedding;';
    
    // We need to use raw SQL, but Supabase client doesn't support it directly
    // So we'll use a workaround: create a SQL function
    
    console.log('3. Altering embedding column...');
    const alterSQL = 'ALTER TABLE memories ALTER COLUMN embedding TYPE VECTOR(1024);';
    
    console.log('4. Recreating index...');
    const createIndexSQL = `
      CREATE INDEX IF NOT EXISTS idx_memories_embedding ON memories 
      USING ivfflat (embedding vector_cosine_ops)
      WITH (lists = 100);
    `;
    
    console.log('\n⚠️  Manual SQL execution required:');
    console.log('\nPlease run the following SQL in Supabase SQL Editor:\n');
    console.log('```sql');
    console.log(dropIndexSQL);
    console.log(alterSQL);
    console.log(createIndexSQL);
    console.log('```');
    
    console.log('\nOr visit: ' + supabaseUrl.replace('https://', 'https://supabase.com/dashboard/project/') + '/sql');
    
  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
}

fixEmbeddingDimension().catch(console.error);
