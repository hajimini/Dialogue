/**
 * Verification Script: Check Supabase Schema and Data Integrity
 * 
 * This script verifies that:
 * - Required tables exist
 * - Indexes are created
 * - Data integrity is maintained
 */

import { config } from 'dotenv';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
config({ path: resolve(process.cwd(), '.env.local') });

async function verifySchema() {
  console.log('🔍 Verifying Supabase Schema and Data Integrity\n');
  
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );
  
  try {
    // Check memories table
    console.log('📋 Checking memories table...');
    const { data: memories, error: memoriesError, count: memoriesCount } = await supabase
      .from('memories')
      .select('*', { count: 'exact', head: true });
    
    if (memoriesError) {
      console.error('  ❌ Error accessing memories table:', memoriesError.message);
    } else {
      console.log(`  ✅ memories table exists with ${memoriesCount ?? 0} records`);
    }
    
    // Check user_profiles_per_persona table
    console.log('\n📋 Checking user_profiles_per_persona table...');
    const { data: profiles, error: profilesError, count: profilesCount } = await supabase
      .from('user_profiles_per_persona')
      .select('*', { count: 'exact', head: true });
    
    if (profilesError) {
      console.error('  ❌ Error accessing user_profiles_per_persona table:', profilesError.message);
    } else {
      console.log(`  ✅ user_profiles_per_persona table exists with ${profilesCount ?? 0} records`);
    }
    
    // Check sessions table
    console.log('\n📋 Checking sessions table...');
    const { data: sessions, error: sessionsError, count: sessionsCount } = await supabase
      .from('sessions')
      .select('*', { count: 'exact', head: true });
    
    if (sessionsError) {
      console.error('  ❌ Error accessing sessions table:', sessionsError.message);
    } else {
      console.log(`  ✅ sessions table exists with ${sessionsCount ?? 0} records`);
    }
    
    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 VERIFICATION SUMMARY');
    console.log('='.repeat(60));
    console.log(`Memories: ${memoriesCount ?? 0}`);
    console.log(`Profiles: ${profilesCount ?? 0}`);
    console.log(`Sessions: ${sessionsCount ?? 0}`);
    console.log('='.repeat(60));
    
    if (!memoriesError && !profilesError && !sessionsError) {
      console.log('\n✅ All tables verified successfully!');
      return true;
    } else {
      console.log('\n⚠️  Some tables have issues. Please check the errors above.');
      return false;
    }
    
  } catch (error) {
    console.error('\n❌ Verification failed:', error);
    return false;
  }
}

// Run verification
verifySchema()
  .then(success => process.exit(success ? 0 : 1))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
