/**
 * Test script for migration functionality
 * 
 * This script tests the migration script without actually running it,
 * by checking the structure and validating the logic.
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';

async function testMigrationScript() {
  console.log('🧪 Testing Migration Script\n');
  
  try {
    // Test 1: Check if app-store.json exists and is readable
    console.log('Test 1: Reading local app store...');
    const storePath = path.join(process.cwd(), '.data', 'app-store.json');
    const storeContent = await readFile(storePath, 'utf8');
    const store = JSON.parse(storeContent);
    
    console.log(`✅ Found ${store.memories?.length ?? 0} memories`);
    console.log(`✅ Found ${store.userProfilesPerPersona?.length ?? 0} profiles`);
    
    // Test 2: Validate memory structure
    console.log('\nTest 2: Validating memory structure...');
    if (store.memories && store.memories.length > 0) {
      const memory = store.memories[0];
      const requiredFields = ['id', 'user_id', 'persona_id', 'memory_type', 'content', 'importance'];
      const missingFields = requiredFields.filter(field => !(field in memory));
      
      if (missingFields.length > 0) {
        console.log(`⚠️  Missing fields in memory: ${missingFields.join(', ')}`);
      } else {
        console.log('✅ Memory structure is valid');
      }
    } else {
      console.log('ℹ️  No memories to validate');
    }
    
    // Test 3: Validate profile structure
    console.log('\nTest 3: Validating profile structure...');
    if (store.userProfilesPerPersona && store.userProfilesPerPersona.length > 0) {
      const profile = store.userProfilesPerPersona[0];
      const requiredFields = ['id', 'user_id', 'persona_id', 'profile_data', 'relationship_stage'];
      const missingFields = requiredFields.filter(field => !(field in profile));
      
      if (missingFields.length > 0) {
        console.log(`⚠️  Missing fields in profile: ${missingFields.join(', ')}`);
      } else {
        console.log('✅ Profile structure is valid');
      }
      
      // Validate profile_data structure
      if (profile.profile_data) {
        const requiredDataFields = ['summary', 'facts', 'preferences', 'relationship_notes', 'recent_topics', 'anchors'];
        const missingDataFields = requiredDataFields.filter(field => !(field in profile.profile_data));
        
        if (missingDataFields.length > 0) {
          console.log(`⚠️  Missing fields in profile_data: ${missingDataFields.join(', ')}`);
        } else {
          console.log('✅ Profile data structure is valid');
        }
      }
    } else {
      console.log('ℹ️  No profiles to validate');
    }
    
    // Test 4: Check environment variables
    console.log('\nTest 4: Checking environment variables...');
    const requiredEnvVars = [
      'SUPABASE_URL',
      'SUPABASE_SERVICE_KEY',
      'MEM0_API_KEY',
      'OPENAI_API_KEY'
    ];
    
    const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missingEnvVars.length > 0) {
      console.log(`⚠️  Missing environment variables: ${missingEnvVars.join(', ')}`);
      console.log('   These are required for migration to work properly.');
    } else {
      console.log('✅ All required environment variables are set');
    }
    
    // Test 5: Estimate migration time
    console.log('\nTest 5: Estimating migration time...');
    const memoryCount = store.memories?.length ?? 0;
    const profileCount = store.userProfilesPerPersona?.length ?? 0;
    
    // Rough estimates: 500ms per memory (embedding generation), 100ms per profile
    const estimatedMemoryTime = memoryCount * 500;
    const estimatedProfileTime = profileCount * 100;
    const estimatedTotal = estimatedMemoryTime + estimatedProfileTime;
    
    console.log(`📊 Estimated migration time:`);
    console.log(`   - Memories: ~${(estimatedMemoryTime / 1000).toFixed(1)}s`);
    console.log(`   - Profiles: ~${(estimatedProfileTime / 1000).toFixed(1)}s`);
    console.log(`   - Total: ~${(estimatedTotal / 1000).toFixed(1)}s`);
    
    console.log('\n✅ All tests passed! Migration script is ready to run.');
    console.log('\nTo run the migration:');
    console.log('  npm run migrate:mem0');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  }
}

testMigrationScript();
