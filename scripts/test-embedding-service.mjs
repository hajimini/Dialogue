/**
 * Test script for EmbeddingService
 * 
 * This script tests the EmbeddingService implementation without requiring Jest.
 */

import { EmbeddingService } from '../src/lib/memory/services/embedding-service.ts';

// Test utilities
let testsPassed = 0;
let testsFailed = 0;

function assert(condition, message) {
  if (condition) {
    testsPassed++;
    console.log(`✓ ${message}`);
  } else {
    testsFailed++;
    console.error(`✗ ${message}`);
  }
}

function assertArrayLength(array, expectedLength, message) {
  assert(
    Array.isArray(array) && array.length === expectedLength,
    message
  );
}

function assertClose(actual, expected, tolerance, message) {
  assert(
    Math.abs(actual - expected) < tolerance,
    message
  );
}

// Test suite
async function runTests() {
  console.log('Testing EmbeddingService...\n');

  // Test 1: Fallback embedding for non-empty text
  console.log('Test 1: Generate fallback embedding for non-empty text');
  const config1 = {
    provider: 'openai',
    apiKey: '', // No API key to force fallback
    model: 'text-embedding-3-large',
  };
  const service1 = new EmbeddingService(config1);
  const embedding1 = await service1.embed('Hello world');
  assertArrayLength(embedding1, 1536, 'Embedding should have 1536 dimensions');
  assert(
    embedding1.some((v) => v !== 0),
    'Embedding should not be all zeros'
  );

  // Test 2: Zero vector for empty text
  console.log('\nTest 2: Return zero vector for empty text');
  const embedding2 = await service1.embed('');
  assertArrayLength(embedding2, 1536, 'Empty text embedding should have 1536 dimensions');
  assert(
    embedding2.every((v) => v === 0),
    'Empty text embedding should be all zeros'
  );

  // Test 3: Zero vector for whitespace-only text
  console.log('\nTest 3: Return zero vector for whitespace-only text');
  const embedding3 = await service1.embed('   \n\t  ');
  assertArrayLength(embedding3, 1536, 'Whitespace embedding should have 1536 dimensions');
  assert(
    embedding3.every((v) => v === 0),
    'Whitespace embedding should be all zeros'
  );

  // Test 4: Normalized vectors
  console.log('\nTest 4: Generate normalized vectors');
  const embedding4 = await service1.embed('This is a test');
  const magnitude = Math.sqrt(
    embedding4.reduce((sum, val) => sum + val * val, 0)
  );
  assertClose(magnitude, 1.0, 0.00001, 'Vector should be normalized (magnitude ≈ 1.0)');

  // Test 5: Deterministic embeddings
  console.log('\nTest 5: Generate deterministic embeddings');
  const text5 = 'Consistent text';
  const embedding5a = await service1.embed(text5);
  const embedding5b = await service1.embed(text5);
  assert(
    JSON.stringify(embedding5a) === JSON.stringify(embedding5b),
    'Same text should produce identical embeddings'
  );

  // Test 6: Different embeddings for different texts
  console.log('\nTest 6: Generate different embeddings for different texts');
  const embedding6a = await service1.embed('First text');
  const embedding6b = await service1.embed('Second text');
  assert(
    JSON.stringify(embedding6a) !== JSON.stringify(embedding6b),
    'Different texts should produce different embeddings'
  );

  // Test 7: Handle Chinese text
  console.log('\nTest 7: Handle Chinese text');
  const embedding7 = await service1.embed('你好世界');
  assertArrayLength(embedding7, 1536, 'Chinese text embedding should have 1536 dimensions');
  assert(
    embedding7.some((v) => v !== 0),
    'Chinese text embedding should not be all zeros'
  );

  // Test 8: Handle mixed Chinese and English text
  console.log('\nTest 8: Handle mixed Chinese and English text');
  const embedding8 = await service1.embed('Hello 你好 World 世界');
  assertArrayLength(embedding8, 1536, 'Mixed text embedding should have 1536 dimensions');
  assert(
    embedding8.some((v) => v !== 0),
    'Mixed text embedding should not be all zeros'
  );

  // Test 9: Handle text with punctuation
  console.log('\nTest 9: Handle text with punctuation');
  const embedding9 = await service1.embed('Hello, world! How are you?');
  assertArrayLength(embedding9, 1536, 'Punctuated text embedding should have 1536 dimensions');
  assert(
    embedding9.some((v) => v !== 0),
    'Punctuated text embedding should not be all zeros'
  );

  // Test 10: Handle long text
  console.log('\nTest 10: Handle long text');
  const longText = 'Lorem ipsum '.repeat(100);
  const embedding10 = await service1.embed(longText);
  assertArrayLength(embedding10, 1536, 'Long text embedding should have 1536 dimensions');

  // Test 11: Track metrics
  console.log('\nTest 11: Track metrics for embedding operations');
  const config11 = {
    provider: 'openai',
    apiKey: '',
    model: 'text-embedding-3-large',
  };
  const service11 = new EmbeddingService(config11);
  await service11.embed('Test 1');
  await service11.embed('Test 2');
  await service11.embed('Test 3');
  const metrics11 = service11.getMetrics();
  assert(metrics11.total === 3, 'Should track 3 operations');
  assert(metrics11.failed === 3, 'All operations should fail without API key');
  assert(metrics11.successful === 0, 'No operations should succeed without API key');

  // Test 12: Calculate average duration
  console.log('\nTest 12: Calculate average duration');
  const metrics12 = service11.getMetrics();
  assert(metrics12.avgDuration > 0, 'Average duration should be greater than 0');

  // Test 13: Track metrics by provider
  console.log('\nTest 13: Track metrics by provider');
  const metrics13 = service11.getMetrics();
  assert(
    metrics13.byProvider.openai !== undefined,
    'Should track metrics for openai provider'
  );
  assert(
    metrics13.byProvider.openai.count === 3,
    'Should track 3 operations for openai provider'
  );

  // Test 14: Accept openai provider
  console.log('\nTest 14: Accept openai provider');
  try {
    const config14 = {
      provider: 'openai',
      apiKey: 'test-key',
      model: 'text-embedding-3-large',
    };
    new EmbeddingService(config14);
    testsPassed++;
    console.log('✓ Should accept openai provider');
  } catch {
    testsFailed++;
    console.error('✗ Should accept openai provider');
  }

  // Test 15: Accept bge-m3 provider
  console.log('\nTest 15: Accept bge-m3 provider');
  try {
    const config15 = {
      provider: 'bge-m3',
      apiKey: 'test-key',
      model: 'BAAI/bge-m3',
    };
    new EmbeddingService(config15);
    testsPassed++;
    console.log('✓ Should accept bge-m3 provider');
  } catch {
    testsFailed++;
    console.error('✗ Should accept bge-m3 provider');
  }

  // Test 16: Fall back for bge-m3 (not yet implemented)
  console.log('\nTest 16: Fall back to hash-based embedding for bge-m3');
  const config16 = {
    provider: 'bge-m3',
    apiKey: 'test-key',
    model: 'BAAI/bge-m3',
  };
  const service16 = new EmbeddingService(config16);
  const embedding16 = await service16.embed('Test');
  assertArrayLength(embedding16, 1536, 'BGE-M3 fallback should return 1536 dimensions');

  // Test 17: Fall back on API error
  console.log('\nTest 17: Fall back to hash-based embedding on API error');
  const config17 = {
    provider: 'openai',
    apiKey: '',
    model: 'text-embedding-3-large',
  };
  const service17 = new EmbeddingService(config17);
  const embedding17 = await service17.embed('Test text');
  assertArrayLength(embedding17, 1536, 'Fallback should return 1536 dimensions');

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log(`Tests passed: ${testsPassed}`);
  console.log(`Tests failed: ${testsFailed}`);
  console.log('='.repeat(50));

  if (testsFailed > 0) {
    process.exit(1);
  }
}

// Run tests
runTests().catch((error) => {
  console.error('Test suite failed with error:', error);
  process.exit(1);
});
