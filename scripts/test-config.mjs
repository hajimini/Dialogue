/**
 * Manual test script for configuration module
 * 
 * Run with: node scripts/test-config.mjs
 */

import { 
  getMemoryGatewayConfig, 
  validateMemoryGatewayConfig, 
  getConfigSummary 
} from '../src/lib/memory/config.ts';

console.log('=== Memory Gateway Configuration Test ===\n');

// Test 1: Get configuration summary
console.log('Test 1: Configuration Summary');
console.log('---');
try {
  const summary = getConfigSummary();
  console.log(summary);
  console.log('✓ Configuration summary retrieved successfully\n');
} catch (error) {
  console.error('✗ Failed to get configuration summary:', error.message);
  console.log();
}

// Test 2: Validate configuration
console.log('Test 2: Configuration Validation');
console.log('---');
try {
  const validation = validateMemoryGatewayConfig();
  console.log('Valid:', validation.isValid);
  
  if (validation.errors.length > 0) {
    console.log('\nErrors:');
    validation.errors.forEach(err => console.log('  -', err));
  }
  
  if (validation.warnings.length > 0) {
    console.log('\nWarnings:');
    validation.warnings.forEach(warn => console.log('  -', warn));
  }
  
  console.log('\n✓ Configuration validation completed\n');
} catch (error) {
  console.error('✗ Failed to validate configuration:', error.message);
  console.log();
}

// Test 3: Get full configuration object
console.log('Test 3: Full Configuration Object');
console.log('---');
try {
  const config = getMemoryGatewayConfig();
  console.log('Provider:', config.provider);
  console.log('Embedding Provider:', config.mem0.embeddingConfig.provider);
  console.log('Embedding Model:', config.mem0.embeddingConfig.model);
  console.log('Reranker Provider:', config.mem0.rerankerConfig.provider);
  console.log('Retrieval Limit:', config.mem0.retrievalLimit);
  console.log('Supabase URL:', config.mem0.supabaseUrl);
  console.log('\n✓ Configuration object retrieved successfully\n');
} catch (error) {
  console.error('✗ Failed to get configuration:', error.message);
  console.log();
}

// Test 4: Test error handling with invalid provider
console.log('Test 4: Error Handling (Invalid Provider)');
console.log('---');
const originalProvider = process.env.MEMORY_PROVIDER;
try {
  process.env.MEMORY_PROVIDER = 'invalid-provider';
  getMemoryGatewayConfig();
  console.error('✗ Should have thrown an error for invalid provider\n');
} catch (error) {
  console.log('✓ Correctly caught error:', error.message);
  console.log();
} finally {
  // Restore original value
  if (originalProvider) {
    process.env.MEMORY_PROVIDER = originalProvider;
  } else {
    delete process.env.MEMORY_PROVIDER;
  }
}

// Test 5: Test error handling with invalid retrieval limit
console.log('Test 5: Error Handling (Invalid Retrieval Limit)');
console.log('---');
const originalLimit = process.env.MEMORY_RETRIEVAL_LIMIT;
try {
  process.env.MEMORY_RETRIEVAL_LIMIT = 'not-a-number';
  getMemoryGatewayConfig();
  console.error('✗ Should have thrown an error for invalid retrieval limit\n');
} catch (error) {
  console.log('✓ Correctly caught error:', error.message);
  console.log();
} finally {
  // Restore original value
  if (originalLimit) {
    process.env.MEMORY_RETRIEVAL_LIMIT = originalLimit;
  } else {
    delete process.env.MEMORY_RETRIEVAL_LIMIT;
  }
}

console.log('=== All Tests Completed ===');
