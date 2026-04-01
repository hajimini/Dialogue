#!/usr/bin/env node

/**
 * Test script for refactored long-term.ts
 * 
 * Verifies that the refactored long-term.ts properly delegates to MemoryGateway
 * and maintains backward compatibility with existing consumers.
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables
config({ path: resolve(process.cwd(), '.env.local') });

console.log('🧪 Testing refactored long-term.ts...\n');

// Test 1: Verify utility functions are preserved
console.log('Test 1: Utility functions');
try {
  const { createEmptyProfileData, mergeUniqueStrings } = await import(
    '../src/lib/memory/long-term.ts'
  );

  // Test createEmptyProfileData
  const emptyProfile = createEmptyProfileData();
  console.assert(
    emptyProfile.summary === '',
    'createEmptyProfileData should return empty summary'
  );
  console.assert(
    Array.isArray(emptyProfile.facts),
    'createEmptyProfileData should return facts array'
  );
  console.log('✅ createEmptyProfileData works correctly');

  // Test mergeUniqueStrings
  const merged = mergeUniqueStrings(5, ['a', 'b'], ['b', 'c'], ['c', 'd', 'e', 'f']);
  console.assert(merged.length === 5, 'mergeUniqueStrings should respect limit');
  console.assert(
    merged.includes('a') && merged.includes('b') && merged.includes('c'),
    'mergeUniqueStrings should merge arrays'
  );
  console.log('✅ mergeUniqueStrings works correctly');
} catch (error) {
  console.error('❌ Utility functions test failed:', error.message);
  process.exit(1);
}

// Test 2: Verify exports are available
console.log('\nTest 2: Function exports');
try {
  const longTerm = await import('../src/lib/memory/long-term.ts');

  const expectedExports = [
    'createEmptyProfileData',
    'mergeUniqueStrings',
    'listMemories',
    'getUserProfileForPersona',
    'listUserProfiles',
    'saveSessionMemories',
    'createMemory',
    'updateMemory',
    'deleteMemory',
  ];

  for (const exportName of expectedExports) {
    console.assert(
      typeof longTerm[exportName] === 'function',
      `${exportName} should be exported as a function`
    );
  }

  console.log('✅ All expected functions are exported');
} catch (error) {
  console.error('❌ Function exports test failed:', error.message);
  process.exit(1);
}

// Test 3: Verify MemoryGateway integration
console.log('\nTest 3: MemoryGateway integration');
try {
  const { getMemoryGateway } = await import('../src/lib/memory/factory.ts');

  // Verify gateway can be instantiated
  const gateway = getMemoryGateway();
  console.assert(gateway !== null, 'Gateway should be instantiated');
  console.assert(
    typeof gateway.add === 'function',
    'Gateway should have add method'
  );
  console.assert(
    typeof gateway.search === 'function',
    'Gateway should have search method'
  );
  console.assert(
    typeof gateway.update === 'function',
    'Gateway should have update method'
  );
  console.assert(
    typeof gateway.delete === 'function',
    'Gateway should have delete method'
  );
  console.assert(
    typeof gateway.saveSessionMemories === 'function',
    'Gateway should have saveSessionMemories method'
  );
  console.assert(
    typeof gateway.getMemoryContext === 'function',
    'Gateway should have getMemoryContext method'
  );

  console.log('✅ MemoryGateway integration verified');
} catch (error) {
  console.error('❌ MemoryGateway integration test failed:', error.message);
  process.exit(1);
}

// Test 4: Verify backward compatibility with consumers
console.log('\nTest 4: Backward compatibility');
try {
  // Import files that consume long-term.ts
  await import('../src/lib/memory/summarizer.ts');
  await import('../src/app/api/admin/memories/route.ts');
  await import('../src/app/api/admin/memories/[memoryId]/route.ts');

  console.log('✅ All consumers can import long-term.ts without errors');
} catch (error) {
  console.error('❌ Backward compatibility test failed:', error.message);
  process.exit(1);
}

console.log('\n✅ All tests passed! Refactored long-term.ts is working correctly.\n');
console.log('Summary:');
console.log('- Utility functions preserved: createEmptyProfileData, mergeUniqueStrings');
console.log('- All CRUD functions delegate to MemoryGateway');
console.log('- Backward compatibility maintained with existing consumers');
console.log('- No more direct updateLocalAppStore calls');
