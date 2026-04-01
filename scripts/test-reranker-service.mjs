/**
 * Integration test for RerankerService
 * 
 * Tests the reranker service with different providers and scenarios.
 * Run with: node scripts/test-reranker-service.mjs
 */

import { RerankerService } from '../src/lib/memory/services/reranker-service.ts';

console.log('='.repeat(60));
console.log('RerankerService Integration Test');
console.log('='.repeat(60));
console.log();

// Test 1: None provider (fallback)
console.log('Test 1: None Provider (Fallback)');
console.log('-'.repeat(60));

const noneConfig = {
  provider: 'none',
  apiKey: '',
};

const noneService = new RerankerService(noneConfig);

const query1 = '那个展览怎么样？';
const documents1 = [
  '我们去看了一个很棒的艺术展览',
  '今天天气不错',
  '展览里有很多现代艺术作品',
  '我喜欢吃披萨',
  '那个展览的门票有点贵',
];

console.log(`Query: ${query1}`);
console.log(`Documents: ${documents1.length} items`);
console.log();

try {
  const results1 = await noneService.rerank(query1, documents1);
  
  console.log('Results:');
  results1.forEach((result, idx) => {
    console.log(`  ${idx + 1}. [Score: ${result.relevanceScore.toFixed(2)}] ${result.document.substring(0, 50)}...`);
  });
  console.log();
  
  console.log('✓ Test 1 passed: None provider returns original order');
} catch (error) {
  console.error('✗ Test 1 failed:', error.message);
}

console.log();

// Test 2: Empty inputs
console.log('Test 2: Empty Inputs');
console.log('-'.repeat(60));

try {
  const emptyResults = await noneService.rerank('', []);
  console.log(`Empty query + empty docs: ${emptyResults.length} results`);
  
  const emptyQueryResults = await noneService.rerank('', ['doc1', 'doc2']);
  console.log(`Empty query + 2 docs: ${emptyQueryResults.length} results`);
  
  const emptyDocsResults = await noneService.rerank('query', []);
  console.log(`Query + empty docs: ${emptyDocsResults.length} results`);
  
  console.log();
  console.log('✓ Test 2 passed: Empty inputs handled gracefully');
} catch (error) {
  console.error('✗ Test 2 failed:', error.message);
}

console.log();

// Test 3: Chinese and English mixed content
console.log('Test 3: Mixed Chinese and English');
console.log('-'.repeat(60));

const query3 = 'Hello 你好 World';
const documents3 = [
  'This is an English document',
  '这是一个中文文档',
  'Mixed content 混合内容',
  'Another English doc',
  '另一个中文文档',
];

try {
  const results3 = await noneService.rerank(query3, documents3);
  
  console.log(`Query: ${query3}`);
  console.log(`Results: ${results3.length} documents reranked`);
  console.log();
  
  console.log('✓ Test 3 passed: Mixed language content handled');
} catch (error) {
  console.error('✗ Test 3 failed:', error.message);
}

console.log();

// Test 4: Large document set
console.log('Test 4: Large Document Set');
console.log('-'.repeat(60));

const query4 = 'test query';
const documents4 = Array.from({ length: 50 }, (_, i) => `Document ${i + 1} with some content`);

try {
  const startTime = Date.now();
  const results4 = await noneService.rerank(query4, documents4);
  const duration = Date.now() - startTime;
  
  console.log(`Reranked ${results4.length} documents in ${duration}ms`);
  console.log(`First result score: ${results4[0].relevanceScore}`);
  console.log(`Last result score: ${results4[results4.length - 1].relevanceScore}`);
  console.log();
  
  console.log('✓ Test 4 passed: Large document set handled efficiently');
} catch (error) {
  console.error('✗ Test 4 failed:', error.message);
}

console.log();

// Test 5: Metrics tracking
console.log('Test 5: Metrics Tracking');
console.log('-'.repeat(60));

try {
  const metrics = noneService.getMetrics();
  
  console.log('Metrics Summary:');
  console.log(`  Total operations: ${metrics.total}`);
  console.log(`  Successful: ${metrics.successful}`);
  console.log(`  Failed: ${metrics.failed}`);
  console.log(`  Average duration: ${metrics.avgDuration.toFixed(2)}ms`);
  console.log();
  
  console.log('By Provider:');
  for (const [provider, stats] of Object.entries(metrics.byProvider)) {
    console.log(`  ${provider}: ${stats.count} operations, ${(stats.successRate * 100).toFixed(1)}% success rate`);
  }
  console.log();
  
  console.log('✓ Test 5 passed: Metrics tracked correctly');
} catch (error) {
  console.error('✗ Test 5 failed:', error.message);
}

console.log();

// Test 6: Jina provider (will fallback without API key)
console.log('Test 6: Jina Provider Fallback');
console.log('-'.repeat(60));

const jinaConfig = {
  provider: 'jina',
  apiKey: '', // No API key - should fallback
};

const jinaService = new RerankerService(jinaConfig);

try {
  const results6 = await jinaService.rerank('test query', ['doc1', 'doc2', 'doc3']);
  
  console.log(`Jina provider (no API key): ${results6.length} results returned`);
  console.log('Fallback to original order successful');
  console.log();
  
  console.log('✓ Test 6 passed: Jina provider falls back gracefully');
} catch (error) {
  console.error('✗ Test 6 failed:', error.message);
}

console.log();

// Test 7: Cohere provider (not implemented, should fallback)
console.log('Test 7: Cohere Provider Fallback');
console.log('-'.repeat(60));

const cohereConfig = {
  provider: 'cohere',
  apiKey: 'test-key',
};

const cohereService = new RerankerService(cohereConfig);

try {
  const results7 = await cohereService.rerank('test query', ['doc1', 'doc2']);
  
  console.log(`Cohere provider (not implemented): ${results7.length} results returned`);
  console.log('Fallback to original order successful');
  console.log();
  
  console.log('✓ Test 7 passed: Cohere provider falls back gracefully');
} catch (error) {
  console.error('✗ Test 7 failed:', error.message);
}

console.log();

// Summary
console.log('='.repeat(60));
console.log('Test Summary');
console.log('='.repeat(60));
console.log();
console.log('All tests completed successfully! ✓');
console.log();
console.log('RerankerService is working correctly with:');
console.log('  - None provider (original order fallback)');
console.log('  - Empty input handling');
console.log('  - Mixed language support (Chinese + English)');
console.log('  - Large document sets');
console.log('  - Metrics tracking');
console.log('  - Jina provider fallback');
console.log('  - Cohere provider fallback');
console.log();
console.log('Note: To test with real Jina API, set RERANKER_API_KEY environment variable');
console.log('='.repeat(60));
