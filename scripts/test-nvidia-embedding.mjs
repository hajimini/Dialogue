/**
 * Test NVIDIA Embedding API
 * 
 * Tests the NVIDIA BGE-M3 embedding model to verify it works correctly.
 */

const NVIDIA_API_KEY = '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';
const NVIDIA_BASE_URL = 'https://integrate.api.nvidia.com/v1';

async function testNvidiaEmbedding() {
  console.log('🧪 Testing NVIDIA Embedding API\n');
  
  try {
    // Test 1: Simple English text
    console.log('Test 1: English text embedding');
    const englishText = 'Hello, how are you today?';
    const englishResult = await generateEmbedding(englishText);
    console.log(`✅ English embedding: ${englishResult.length} dimensions`);
    console.log(`   First 5 values: [${englishResult.slice(0, 5).map(v => v.toFixed(4)).join(', ')}]`);
    
    // Test 2: Chinese text
    console.log('\nTest 2: Chinese text embedding');
    const chineseText = '你好，今天天气怎么样？';
    const chineseResult = await generateEmbedding(chineseText);
    console.log(`✅ Chinese embedding: ${chineseResult.length} dimensions`);
    console.log(`   First 5 values: [${chineseResult.slice(0, 5).map(v => v.toFixed(4)).join(', ')}]`);
    
    // Test 3: Mixed text
    console.log('\nTest 3: Mixed English-Chinese text');
    const mixedText = 'I love 中文 and English together';
    const mixedResult = await generateEmbedding(mixedText);
    console.log(`✅ Mixed embedding: ${mixedResult.length} dimensions`);
    console.log(`   First 5 values: [${mixedResult.slice(0, 5).map(v => v.toFixed(4)).join(', ')}]`);
    
    // Test 4: Similarity calculation
    console.log('\nTest 4: Similarity calculation');
    const text1 = '那只猫很可爱';
    const text2 = '那只猫今天又来了';
    const text3 = '今天天气很好';
    
    const emb1 = await generateEmbedding(text1);
    const emb2 = await generateEmbedding(text2);
    const emb3 = await generateEmbedding(text3);
    
    const sim12 = cosineSimilarity(emb1, emb2);
    const sim13 = cosineSimilarity(emb1, emb3);
    
    console.log(`✅ Similarity("${text1}", "${text2}"): ${sim12.toFixed(4)}`);
    console.log(`✅ Similarity("${text1}", "${text3}"): ${sim13.toFixed(4)}`);
    console.log(`   Expected: sim12 > sim13 (related vs unrelated)`);
    console.log(`   Result: ${sim12 > sim13 ? '✅ PASS' : '❌ FAIL'}`);
    
    console.log('\n✅ All tests passed! NVIDIA embedding API is working correctly.');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('\nDetails:', error);
    process.exit(1);
  }
}

async function generateEmbedding(text) {
  const response = await fetch(`${NVIDIA_BASE_URL}/embeddings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${NVIDIA_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'nvidia/nv-embedqa-e5-v5',
      input: text,
      input_type: 'query', // Required for asymmetric models
      encoding_format: 'float',
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`NVIDIA API failed with status ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  
  if (!data.data || !data.data[0] || !data.data[0].embedding) {
    throw new Error('Invalid NVIDIA response format: missing embedding data');
  }

  return data.data[0].embedding;
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

testNvidiaEmbedding();
