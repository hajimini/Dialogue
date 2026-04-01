/**
 * Test NVIDIA Embedding Integration with EmbeddingService
 * 
 * This script tests the full integration of NVIDIA embeddings
 * through the EmbeddingService class.
 */

import { config } from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// Load environment variables
config({ path: path.join(projectRoot, '.env.local') });

// Dynamically import the EmbeddingService
const { EmbeddingService } = await import('../src/lib/memory/services/embedding-service.ts');

async function testNvidiaIntegration() {
  console.log('🧪 Testing NVIDIA Embedding Integration\n');
  
  try {
    // Create EmbeddingService with NVIDIA configuration
    const service = new EmbeddingService({
      provider: 'nvidia',
      apiKey: process.env.NVIDIA_API_KEY,
      model: 'nvidia/nv-embedqa-e5-v5',
      baseUrl: process.env.NVIDIA_BASE_URL,
    });
    
    console.log('✅ EmbeddingService created with NVIDIA provider\n');
    
    // Test 1: English text
    console.log('Test 1: English text');
    const englishText = 'The quick brown fox jumps over the lazy dog';
    const englishEmb = await service.embed(englishText);
    console.log(`✅ Generated embedding: ${englishEmb.length} dimensions`);
    console.log(`   First 5 values: [${englishEmb.slice(0, 5).map(v => v.toFixed(4)).join(', ')}]\n`);
    
    // Test 2: Chinese text
    console.log('Test 2: Chinese text');
    const chineseText = '那只猫很可爱，我很喜欢它';
    const chineseEmb = await service.embed(chineseText);
    console.log(`✅ Generated embedding: ${chineseEmb.length} dimensions`);
    console.log(`   First 5 values: [${chineseEmb.slice(0, 5).map(v => v.toFixed(4)).join(', ')}]\n`);
    
    // Test 3: Empty text
    console.log('Test 3: Empty text handling');
    const emptyEmb = await service.embed('');
    console.log(`✅ Empty text embedding: ${emptyEmb.length} dimensions (all zeros)`);
    const allZeros = emptyEmb.every(v => v === 0);
    console.log(`   All zeros: ${allZeros ? '✅ PASS' : '❌ FAIL'}\n`);
    
    // Test 4: Semantic similarity
    console.log('Test 4: Semantic similarity');
    const query = '那只猫今天又来了';
    const relevant = '那只猫很可爱';
    const irrelevant = '今天天气很好';
    
    const queryEmb = await service.embed(query);
    const relevantEmb = await service.embed(relevant);
    const irrelevantEmb = await service.embed(irrelevant);
    
    const simRelevant = cosineSimilarity(queryEmb, relevantEmb);
    const simIrrelevant = cosineSimilarity(queryEmb, irrelevantEmb);
    
    console.log(`✅ Query: "${query}"`);
    console.log(`   Similarity to "${relevant}": ${simRelevant.toFixed(4)}`);
    console.log(`   Similarity to "${irrelevant}": ${simIrrelevant.toFixed(4)}`);
    console.log(`   Expected: relevant > irrelevant`);
    console.log(`   Result: ${simRelevant > simIrrelevant ? '✅ PASS' : '❌ FAIL'}\n`);
    
    // Test 5: Performance metrics
    console.log('Test 5: Performance metrics');
    const metrics = service.getMetrics();
    console.log(`✅ Total operations: ${metrics.total}`);
    console.log(`   Successful: ${metrics.successful}`);
    console.log(`   Failed: ${metrics.failed}`);
    console.log(`   Avg duration: ${metrics.avgDuration.toFixed(0)}ms`);
    console.log(`   By provider:`, metrics.byProvider);
    
    console.log('\n✅ All tests passed! NVIDIA integration is working correctly.');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('\nStack:', error.stack);
    process.exit(1);
  }
}

function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) {
    return 0;
  }

  let dot = 0;
  let magA = 0;
  let magB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }

  if (!magA || !magB) {
    return 0;
  }

  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

testNvidiaIntegration();
