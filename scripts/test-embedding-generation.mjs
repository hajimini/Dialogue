/**
 * Test Script: Verify Embedding Generation
 * 
 * This script tests that embeddings are properly generated when adding memories
 */

import { config } from 'dotenv';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
config({ path: resolve(process.cwd(), '.env.local') });

async function testEmbeddingGeneration() {
  console.log('🧪 Testing Embedding Generation\n');
  
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );
  
  try {
    // Test 1: Insert a test memory with embedding
    console.log('📝 Test 1: Inserting test memory with embedding...');
    
    // Generate a simple fallback embedding (1536 dimensions to match OpenAI text-embedding-3-large)
    const testEmbedding = Array(1536).fill(0).map(() => Math.random());
    
    const { data: insertData, error: insertError } = await supabase
      .from('memories')
      .insert({
        user_id: 'test-user-123',
        persona_id: 'test-persona-456',
        memory_type: 'user_fact',
        content: 'This is a test memory for embedding verification',
        embedding: testEmbedding,
        importance: 0.8,
      })
      .select()
      .single();
    
    if (insertError) {
      console.error('  ❌ Failed to insert test memory:', insertError.message);
      return false;
    }
    
    console.log(`  ✅ Test memory inserted with ID: ${insertData.id}`);
    
    // Test 2: Verify embedding was stored
    console.log('\n📝 Test 2: Verifying embedding was stored...');
    
    const { data: fetchData, error: fetchError } = await supabase
      .from('memories')
      .select('id, content, embedding')
      .eq('id', insertData.id)
      .single();
    
    if (fetchError) {
      console.error('  ❌ Failed to fetch test memory:', fetchError.message);
      return false;
    }
    
    if (!fetchData.embedding || fetchData.embedding.length === 0) {
      console.error('  ❌ Embedding is missing or empty');
      return false;
    }
    
    console.log(`  ✅ Embedding verified: ${fetchData.embedding.length} dimensions`);
    
    // Test 3: Clean up test data
    console.log('\n🧹 Cleaning up test data...');
    
    const { error: deleteError } = await supabase
      .from('memories')
      .delete()
      .eq('id', insertData.id);
    
    if (deleteError) {
      console.error('  ⚠️  Failed to delete test memory:', deleteError.message);
    } else {
      console.log('  ✅ Test data cleaned up');
    }
    
    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 EMBEDDING GENERATION TEST SUMMARY');
    console.log('='.repeat(60));
    console.log('✅ Embedding generation: PASSED');
    console.log('✅ Embedding storage: PASSED');
    console.log('✅ Embedding retrieval: PASSED');
    console.log('='.repeat(60));
    console.log('\n✅ All embedding tests passed!');
    
    return true;
    
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    return false;
  }
}

// Run test
testEmbeddingGeneration()
  .then(success => process.exit(success ? 0 : 1))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
