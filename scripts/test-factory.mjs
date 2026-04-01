/**
 * Manual test script for factory module
 * 
 * Run with: node scripts/test-factory.mjs
 */

import { getMemoryGateway, resetMemoryGateway } from '../src/lib/memory/factory.ts';

console.log('=== Memory Gateway Factory Test ===\n');

// Test 1: Default provider (mem0) - should throw "not yet implemented"
console.log('Test 1: Default Provider (mem0)');
console.log('---');
try {
  const gateway = getMemoryGateway();
  console.error('✗ Should have thrown an error (Mem0Adapter not yet implemented)\n');
} catch (error) {
  if (error.message.includes('Mem0Adapter is not yet implemented')) {
    console.log('✓ Correctly threw error:', error.message);
    console.log();
  } else {
    console.error('✗ Unexpected error:', error.message);
    console.log();
  }
}

// Test 2: Letta provider - should throw "not yet supported"
console.log('Test 2: Letta Provider (not yet supported)');
console.log('---');
const originalProvider = process.env.MEMORY_PROVIDER;
try {
  resetMemoryGateway();
  process.env.MEMORY_PROVIDER = 'letta';
  const gateway = getMemoryGateway();
  console.error('✗ Should have thrown an error (Letta not yet supported)\n');
} catch (error) {
  if (error.message.includes("Memory provider 'letta' is not yet supported")) {
    console.log('✓ Correctly threw error:', error.message);
    console.log();
  } else {
    console.error('✗ Unexpected error:', error.message);
    console.log();
  }
} finally {
  // Restore original value
  if (originalProvider) {
    process.env.MEMORY_PROVIDER = originalProvider;
  } else {
    delete process.env.MEMORY_PROVIDER;
  }
}

// Test 3: Singleton pattern - should return same instance
console.log('Test 3: Singleton Pattern');
console.log('---');
try {
  resetMemoryGateway();
  
  // First call
  let firstError = null;
  try {
    getMemoryGateway();
  } catch (e) {
    firstError = e;
  }
  
  // Second call (should use cached instance logic)
  let secondError = null;
  try {
    getMemoryGateway();
  } catch (e) {
    secondError = e;
  }
  
  if (firstError && secondError && 
      firstError.message === secondError.message &&
      firstError.message.includes('Mem0Adapter is not yet implemented')) {
    console.log('✓ Singleton pattern working (consistent error on multiple calls)');
    console.log();
  } else {
    console.error('✗ Singleton pattern may not be working correctly');
    console.log();
  }
} catch (error) {
  console.error('✗ Unexpected error:', error.message);
  console.log();
}

// Test 4: Reset singleton
console.log('Test 4: Reset Singleton');
console.log('---');
try {
  resetMemoryGateway();
  console.log('✓ Singleton reset successfully');
  
  // Verify reset by calling again
  try {
    getMemoryGateway();
    console.error('✗ Should have thrown an error after reset\n');
  } catch (error) {
    if (error.message.includes('Mem0Adapter is not yet implemented')) {
      console.log('✓ Factory still works after reset');
      console.log();
    } else {
      console.error('✗ Unexpected error after reset:', error.message);
      console.log();
    }
  }
} catch (error) {
  console.error('✗ Failed to reset singleton:', error.message);
  console.log();
}

// Test 5: Provider switching logic
console.log('Test 5: Provider Switching Logic');
console.log('---');
try {
  // Test mem0
  resetMemoryGateway();
  process.env.MEMORY_PROVIDER = 'mem0';
  try {
    getMemoryGateway();
  } catch (error) {
    if (error.message.includes('Mem0Adapter is not yet implemented')) {
      console.log('✓ mem0 provider: Correctly routes to Mem0Adapter (not yet implemented)');
    } else {
      console.error('✗ mem0 provider: Unexpected error:', error.message);
    }
  }
  
  // Test letta
  resetMemoryGateway();
  process.env.MEMORY_PROVIDER = 'letta';
  try {
    getMemoryGateway();
  } catch (error) {
    if (error.message.includes("Memory provider 'letta' is not yet supported")) {
      console.log('✓ letta provider: Correctly throws "not yet supported" error');
    } else {
      console.error('✗ letta provider: Unexpected error:', error.message);
    }
  }
  
  console.log();
} catch (error) {
  console.error('✗ Provider switching test failed:', error.message);
  console.log();
} finally {
  // Restore original value
  if (originalProvider) {
    process.env.MEMORY_PROVIDER = originalProvider;
  } else {
    delete process.env.MEMORY_PROVIDER;
  }
}

// Test 6: Error messages are clear and helpful
console.log('Test 6: Error Message Quality');
console.log('---');
try {
  resetMemoryGateway();
  process.env.MEMORY_PROVIDER = 'mem0';
  
  try {
    getMemoryGateway();
  } catch (error) {
    const hasTaskReference = error.message.includes('Task 8');
    const isDescriptive = error.message.includes('Mem0Adapter');
    
    if (hasTaskReference && isDescriptive) {
      console.log('✓ Error message is clear and references Task 8');
      console.log('  Message:', error.message);
    } else {
      console.error('✗ Error message could be more helpful');
      console.log('  Message:', error.message);
    }
  }
  
  resetMemoryGateway();
  process.env.MEMORY_PROVIDER = 'letta';
  
  try {
    getMemoryGateway();
  } catch (error) {
    const hasTaskReference = error.message.includes('Task 28');
    const isDescriptive = error.message.includes('letta');
    
    if (hasTaskReference && isDescriptive) {
      console.log('✓ Letta error message is clear and references Task 28');
      console.log('  Message:', error.message);
    } else {
      console.error('✗ Letta error message could be more helpful');
      console.log('  Message:', error.message);
    }
  }
  
  console.log();
} catch (error) {
  console.error('✗ Error message quality test failed:', error.message);
  console.log();
} finally {
  // Restore original value
  if (originalProvider) {
    process.env.MEMORY_PROVIDER = originalProvider;
  } else {
    delete process.env.MEMORY_PROVIDER;
  }
}

console.log('=== All Tests Completed ===');
