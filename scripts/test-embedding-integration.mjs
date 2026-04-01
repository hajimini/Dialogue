/**
 * Integration test for EmbeddingService with config module
 * 
 * This script tests that EmbeddingService integrates correctly with the config module.
 */

import { EmbeddingService } from '../src/lib/memory/services/embedding-service.ts';
import { getMemoryGatewayConfig } from '../src/lib/memory/config.ts';

async function runIntegrationTest() {
  console.log('Running EmbeddingService integration test...\n');

  try {
    // Test 1: Load config and create service
    console.log('Test 1: Load config and create EmbeddingService');
    const config = getMemoryGatewayConfig();
    const embeddingConfig = config.mem0.embeddingConfig;
    
    console.log(`  Provider: ${embeddingConfig.provider}`);
    console.log(`  Model: ${embeddingConfig.model}`);
    console.log(`  API Key configured: ${embeddingConfig.apiKey ? 'Yes' : 'No'}`);
    
    const service = new EmbeddingService(embeddingConfig);
    console.log('  ✓ EmbeddingService created successfully\n');

    // Test 2: Generate embedding
    console.log('Test 2: Generate embedding for sample text');
    const sampleText = 'This is a test of the embedding service';
    const embedding = await service.embed(sampleText);
    
    console.log(`  Text: "${sampleText}"`);
    console.log(`  Embedding dimensions: ${embedding.length}`);
    console.log(`  First 5 values: [${embedding.slice(0, 5).map(v => v.toFixed(4)).join(', ')}]`);
    
    if (embedding.length !== 1536) {
      throw new Error(`Expected 1536 dimensions, got ${embedding.length}`);
    }
    console.log('  ✓ Embedding generated successfully\n');

    // Test 3: Generate embedding for Chinese text
    console.log('Test 3: Generate embedding for Chinese text');
    const chineseText = '你好世界，这是一个测试';
    const chineseEmbedding = await service.embed(chineseText);
    
    console.log(`  Text: "${chineseText}"`);
    console.log(`  Embedding dimensions: ${chineseEmbedding.length}`);
    console.log(`  First 5 values: [${chineseEmbedding.slice(0, 5).map(v => v.toFixed(4)).join(', ')}]`);
    
    if (chineseEmbedding.length !== 1536) {
      throw new Error(`Expected 1536 dimensions, got ${chineseEmbedding.length}`);
    }
    console.log('  ✓ Chinese embedding generated successfully\n');

    // Test 4: Check metrics
    console.log('Test 4: Check performance metrics');
    const metrics = service.getMetrics();
    
    console.log(`  Total operations: ${metrics.total}`);
    console.log(`  Successful: ${metrics.successful}`);
    console.log(`  Failed: ${metrics.failed}`);
    console.log(`  Average duration: ${metrics.avgDuration.toFixed(2)}ms`);
    
    if (metrics.byProvider) {
      for (const [provider, stats] of Object.entries(metrics.byProvider)) {
        console.log(`  ${provider}: ${stats.count} operations, ${(stats.successRate * 100).toFixed(1)}% success rate`);
      }
    }
    console.log('  ✓ Metrics tracked successfully\n');

    // Test 5: Verify embeddings are normalized
    console.log('Test 5: Verify embeddings are normalized');
    const magnitude = Math.sqrt(
      embedding.reduce((sum, val) => sum + val * val, 0)
    );
    console.log(`  Magnitude: ${magnitude.toFixed(6)}`);
    
    if (Math.abs(magnitude - 1.0) > 0.0001) {
      throw new Error(`Expected normalized vector (magnitude ≈ 1.0), got ${magnitude}`);
    }
    console.log('  ✓ Embeddings are properly normalized\n');

    // Test 6: Verify deterministic behavior
    console.log('Test 6: Verify deterministic behavior');
    const text = 'Deterministic test';
    const embedding1 = await service.embed(text);
    const embedding2 = await service.embed(text);
    
    const areEqual = embedding1.every((val, idx) => val === embedding2[idx]);
    console.log(`  Same text produces identical embeddings: ${areEqual}`);
    
    if (!areEqual) {
      throw new Error('Embeddings should be deterministic');
    }
    console.log('  ✓ Embeddings are deterministic\n');

    console.log('='.repeat(50));
    console.log('All integration tests passed! ✓');
    console.log('='.repeat(50));

  } catch (error) {
    console.error('\n' + '='.repeat(50));
    console.error('Integration test failed:');
    console.error(error);
    console.error('='.repeat(50));
    process.exit(1);
  }
}

runIntegrationTest();
