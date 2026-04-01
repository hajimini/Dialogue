#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkUserData() {
  console.log('🔍 Checking user data in Supabase...\n');
  
  // Check user_profiles_per_persona table
  const { data: profiles, error: profileError } = await supabase
    .from('user_profiles_per_persona')
    .select('*')
    .limit(5);
  
  if (profileError) {
    console.error('❌ Error fetching profiles:', profileError.message);
  } else {
    console.log(`📊 user_profiles_per_persona: ${profiles?.length || 0} records`);
    if (profiles && profiles.length > 0) {
      console.log('Sample:', JSON.stringify(profiles[0], null, 2));
    }
  }
  
  // Check sessions table
  const { data: sessions, error: sessionError } = await supabase
    .from('sessions')
    .select('*')
    .limit(5);
  
  if (sessionError) {
    console.error('❌ Error fetching sessions:', sessionError.message);
  } else {
    console.log(`\n📊 sessions: ${sessions?.length || 0} records`);
    if (sessions && sessions.length > 0) {
      console.log('Sample:', JSON.stringify(sessions[0], null, 2));
    }
  }
  
  // Check memories table
  const { data: memories, error: memoryError } = await supabase
    .from('memories')
    .select('*')
    .limit(5);
  
  if (memoryError) {
    console.error('❌ Error fetching memories:', memoryError.message);
  } else {
    console.log(`\n📊 memories: ${memories?.length || 0} records`);
    if (memories && memories.length > 0) {
      console.log('Sample user_id:', memories[0].user_id);
      console.log('Sample persona_id:', memories[0].persona_id);
    }
  }
  
  // Check what user IDs exist
  const { data: distinctUsers, error: userError } = await supabase
    .from('memories')
    .select('user_id')
    .limit(100);
  
  if (!userError && distinctUsers) {
    const uniqueUsers = [...new Set(distinctUsers.map(m => m.user_id))];
    console.log(`\n👥 Unique user IDs in memories: ${uniqueUsers.length}`);
    uniqueUsers.forEach(uid => console.log(`   - ${uid}`));
  }
}

checkUserData().catch(console.error);
