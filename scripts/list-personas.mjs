#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase configuration');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function listPersonas() {
  console.log('📋 Fetching personas from Supabase...\n');
  
  const { data, error } = await supabase
    .from('personas')
    .select('id, name, avatar_url, occupation, city, is_active')
    .eq('is_active', true)
    .order('created_at', { ascending: true });
  
  if (error) {
    console.error('❌ Error fetching personas:', error.message);
    process.exit(1);
  }
  
  if (!data || data.length === 0) {
    console.log('⚠️  No active personas found in database');
    process.exit(0);
  }
  
  console.log(`✅ Found ${data.length} active persona(s):\n`);
  
  for (const persona of data) {
    console.log(`ID: ${persona.id}`);
    console.log(`Name: ${persona.name}`);
    console.log(`Occupation: ${persona.occupation || 'N/A'}`);
    console.log(`City: ${persona.city || 'N/A'}`);
    console.log('---');
  }
  
  console.log(`\n💡 To run C-category tests, use:`);
  console.log(`   npm run test:batch -- --category C --persona ${data[0].id}`);
}

listPersonas().catch(console.error);
