/**
 * Simple NVIDIA Integration Test
 * 
 * Tests NVIDIA embedding without complex module imports
 */

const NVIDIA_API_KEY = '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';
const NVIDIA_BASE_URL = 'https://integrate.api.nvidia.com/v1';
const NVIDIA_MODEL = 'nvidia/nv-embedqa-e5-v5';

console.log('🧪 Testing NVIDIA Embedding Integration\n');

async function generateEmbedding(text, inputType = 'query') {
  const response = await fetch(`${NVIDIA_BASE_URL}/embeddings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${NVIDIA_API_KEY}`,
    },
    body: JSON.stringify({
      model: NVIDIA_MODEL,
      input: text,
      input_type: inputType,
      encoding_format: 'float',
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`NVIDIA API failed with status ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  return data.data[0].embedding;
}

function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  
  return magA && magB ? dot / (Math.sqrt(magA) * Math.sqrt(magB)) : 0;
}

try {
  // Test C-category scenarios
  console.log('📝 C-Category Test Cases (Context Continuation)\n');
  
  // C01: 指代词 - "那只猫"
  console.log('C01: 指代词测试');
  const c01_prev = '我昨天在公园看到一只很可爱的橘猫';
  const c01_query = '那只猫今天又来了';
  const c01_irrelevant = '今天天气很好';
  
  const c01_prevEmb = await generateEmbedding(c01_prev, 'passage');
  const c01_queryEmb = await generateEmbedding(c01_query, 'query');
  const c01_irrelevantEmb = await generateEmbedding(c01_irrelevant, 'passage');
  
  const c01_sim_relevant = cosineSimilarity(c01_queryEmb, c01_prevEmb);
  const c01_sim_irrelevant = cosineSimilarity(c01_queryEmb, c01_irrelevantEmb);
  
  console.log(`   Previous: "${c01_prev}"`);
  console.log(`   Query: "${c01_query}"`);
  console.log(`   Similarity (relevant): ${c01_sim_relevant.toFixed(4)}`);
  console.log(`   Similarity (irrelevant): ${c01_sim_irrelevant.toFixed(4)}`);
  console.log(`   Result: ${c01_sim_relevant > c01_sim_irrelevant ? '✅ PASS' : '❌ FAIL'}\n`);
  
  // C09: 指代词 - "那个展"
  console.log('C09: 指代词测试');
  const c09_prev = '上周末我去看了一个很棒的艺术展览';
  const c09_query = '我今天去看了那个展';
  const c09_irrelevant = '我今天去看了电影';
  
  const c09_prevEmb = await generateEmbedding(c09_prev, 'passage');
  const c09_queryEmb = await generateEmbedding(c09_query, 'query');
  const c09_irrelevantEmb = await generateEmbedding(c09_irrelevant, 'passage');
  
  const c09_sim_relevant = cosineSimilarity(c09_queryEmb, c09_prevEmb);
  const c09_sim_irrelevant = cosineSimilarity(c09_queryEmb, c09_irrelevantEmb);
  
  console.log(`   Previous: "${c09_prev}"`);
  console.log(`   Query: "${c09_query}"`);
  console.log(`   Similarity (relevant): ${c09_sim_relevant.toFixed(4)}`);
  console.log(`   Similarity (irrelevant): ${c09_sim_irrelevant.toFixed(4)}`);
  console.log(`   Result: ${c09_sim_relevant > c09_sim_irrelevant ? '✅ PASS' : '❌ FAIL'}\n`);
  
  // Summary
  console.log('📊 Test Summary:');
  console.log(`   C01: ${c01_sim_relevant > c01_sim_irrelevant ? '✅' : '❌'}`);
  console.log(`   C09: ${c09_sim_relevant > c09_sim_irrelevant ? '✅' : '❌'}`);
  
  const passCount = [
    c01_sim_relevant > c01_sim_irrelevant,
    c09_sim_relevant > c09_sim_irrelevant,
  ].filter(Boolean).length;
  
  console.log(`\n   Pass rate: ${passCount}/2 (${(passCount / 2 * 100).toFixed(0)}%)`);
  
  if (passCount === 2) {
    console.log('\n✅ All tests passed! NVIDIA embedding is working well for Chinese context continuation.');
  } else {
    console.log('\n⚠️  Some tests failed. NVIDIA embedding may need tuning for Chinese context.');
  }
  
  console.log('\n💡 Note: Using input_type="passage" for context and input_type="query" for queries');
  console.log('   This asymmetric approach may improve retrieval quality.');
  
} catch (error) {
  console.error('\n❌ Test failed:', error.message);
  console.error(error.stack);
  process.exit(1);
}
