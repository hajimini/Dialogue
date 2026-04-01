/**
 * Integration test script for Mem0Adapter
 * 
 * This script demonstrates the basic CRUD operations of the Mem0Adapter.
 * It requires valid environment variables to be set.
 * 
 * Usage: node scripts/test-mem0-adapter.mjs
 */

import { Mem0Adapter } from '../src/lib/memory/adapters/mem0-adapter.ts';
import { getMemoryGatewayConfig } from '../src/lib/memory/config.ts';

async function testMem0Adapter() {
  console.log('🧪 Testing Mem0Adapter...\n');

  try {
    // Get configuration
    console.log('📋 Loading configuration...');
    const config = getMemoryGatewayConfig();
    console.log('✓ Configuration loaded\n');

    // Initialize adapter
    console.log('🔧 Initializing Mem0Adapter...');
    const adapter = new Mem0Adapter(config.mem0);
    console.log('✓ Adapter initialized\n');

    // Test 1: Add a memory
    console.log('📝 Test 1: Adding a memory...');
    const addResult = await adapter.add({
      userId: 'test-user-1',
      personaId: 'test-persona-1',
      memoryType: 'user_fact',
      content: 'User loves drinking coffee in the morning',
      importance: 0.8,
      sourceSessionId: 'test-session-1',
    });
    console.log('✓ Memory added:', {
      id: addResult.id,
      content: addResult.content,
      importance: addResult.importance,
    });
    console.log();

    // Test 2: Search for memories
    console.log('🔍 Test 2: Searching for memories...');
    const searchResult = await adapter.search({
      userId: 'test-user-1',
      personaId: 'test-persona-1',
      query: 'coffee preferences',
      limit: 5,
    });
    console.log('✓ Search completed:', {
      totalCount: searchResult.totalCount,
      memoriesFound: searchResult.memories.length,
    });
    if (searchResult.memories.length > 0) {
      console.log('  First result:', searchResult.memories[0].content);
    }
    console.log();

    // Test 3: Update the memory
    console.log('✏️  Test 3: Updating memory...');
    const updateResult = await adapter.update({
      memoryId: addResult.id,
      content: 'User loves drinking espresso in the morning',
      importance: 0.9,
    });
    console.log('✓ Memory updated:', {
      id: updateResult.id,
      content: updateResult.content,
      importance: updateResult.importance,
    });
    console.log();

    // Test 4: Get memory context
    console.log('📚 Test 4: Getting memory context...');
    const contextResult = await adapter.getMemoryContext({
      userId: 'test-user-1',
      personaId: 'test-persona-1',
      persona: { id: 'test-persona-1' } as any,
      query: 'What does the user like?',
      limit: 5,
    });
    console.log('✓ Context retrieved:', {
      hasProfile: !!contextResult.userProfile,
      recentSummaries: contextResult.recentSummaries.length,
      relevantMemories: contextResult.relevantMemories.length,
    });
    console.log();

    // Test 5: Delete the memory
    console.log('🗑️  Test 5: Deleting memory...');
    await adapter.delete(addResult.id);
    console.log('✓ Memory deleted\n');

    console.log('✅ All tests passed!\n');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('\nError details:', error);
    process.exit(1);
  }
}

// Run tests
testMem0Adapter();
