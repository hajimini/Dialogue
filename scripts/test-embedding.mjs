#!/usr/bin/env node

/**
 * 测试 Embedding API 是否正常工作
 * 
 * 运行方式：
 * node scripts/test-embedding.mjs
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// 加载环境变量
config({ path: resolve(process.cwd(), '.env.local') });

const EMBEDDING_API_KEY = 
  process.env.HUGGINGFACE_API_KEY ||
  process.env.OPENROUTER_API_KEY ||
  process.env.ANTHROPIC_AUTH_TOKEN ||
  process.env.ANTHROPIC_API_KEY;

const EMBEDDING_PROVIDER = process.env.EMBEDDING_PROVIDER || "openrouter";

const EMBEDDING_BASE_URL = 
  EMBEDDING_PROVIDER === "huggingface"
    ? "https://router.huggingface.co"
    : (process.env.OPENROUTER_BASE_URL?.trim() ||
       process.env.ANTHROPIC_BASE_URL?.trim() ||
       "https://openrouter.ai");

const EMBEDDING_MODEL = 
  process.env.EMBEDDING_MODEL || 
  (EMBEDDING_PROVIDER === "huggingface" 
    ? "sentence-transformers/all-MiniLM-L6-v2"
    : "openai/text-embedding-3-small");

function getEmbeddingEndpoint() {
  if (EMBEDDING_PROVIDER === "huggingface") {
    return `https://router.huggingface.co/models/${EMBEDDING_MODEL}`;
  }
  
  const base = EMBEDDING_BASE_URL.replace(/\/$/, "");

  if (/\/api\/v1$/i.test(base)) {
    return `${base}/embeddings`;
  }

  if (/\/v1$/i.test(base)) {
    return `${base}/embeddings`;
  }

  if (/\/api$/i.test(base)) {
    return `${base}/v1/embeddings`;
  }

  return `${base}/api/v1/embeddings`;
}

async function testEmbedding() {
  console.log('🧪 测试 Embedding API\n');
  console.log('配置信息：');
  console.log(`  Provider: ${EMBEDDING_PROVIDER}`);
  console.log(`  API Key: ${EMBEDDING_API_KEY ? '✅ 已配置' : '❌ 未配置'}`);
  console.log(`  Base URL: ${EMBEDDING_BASE_URL}`);
  console.log(`  Endpoint: ${getEmbeddingEndpoint()}`);
  console.log(`  Model: ${EMBEDDING_MODEL}\n`);

  if (!EMBEDDING_API_KEY) {
    console.error('❌ 错误：未找到 API Key');
    console.log('\n请在 .env.local 中配置以下任一变量：');
    console.log('  - OPENROUTER_API_KEY');
    console.log('  - ANTHROPIC_AUTH_TOKEN');
    console.log('  - ANTHROPIC_API_KEY');
    process.exit(1);
  }

  const testTexts = [
    '我昨天去了动物园，看到了很多可爱的猫科动物',
    '上次我们聊过关于宠物的话题',
    '今天天气真好',
  ];

  console.log('测试文本：');
  testTexts.forEach((text, i) => {
    console.log(`  ${i + 1}. "${text}"`);
  });
  console.log('');

  try {
    console.log('📡 正在调用 Embedding API...\n');

    const embeddings = [];

    for (let i = 0; i < testTexts.length; i++) {
      const text = testTexts[i];
      console.log(`[${i + 1}/${testTexts.length}] 处理: "${text.substring(0, 30)}..."`);

      let embedding;

      if (EMBEDDING_PROVIDER === "huggingface") {
        // Hugging Face API
        const response = await fetch(getEmbeddingEndpoint(), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${EMBEDDING_API_KEY}`,
          },
          body: JSON.stringify({
            inputs: text,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`API 请求失败 (${response.status}): ${errorText}`);
        }

        const result = await response.json();
        embedding = Array.isArray(result) ? result[0] : result;

        if (!Array.isArray(embedding)) {
          throw new Error('API 返回的数据格式不正确');
        }

        // Hugging Face 模型可能返回不同维度，需要标准化到 1536
        const targetSize = 1536;
        if (embedding.length < targetSize) {
          embedding = [...embedding, ...new Array(targetSize - embedding.length).fill(0)];
        } else if (embedding.length > targetSize) {
          embedding = embedding.slice(0, targetSize);
        }
      } else {
        // OpenRouter API
        const response = await fetch(getEmbeddingEndpoint(), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${EMBEDDING_API_KEY}`,
          },
          body: JSON.stringify({
            model: EMBEDDING_MODEL,
            input: text,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`API 请求失败 (${response.status}): ${errorText}`);
        }

        const json = await response.json();
        embedding = json.data?.[0]?.embedding;

        if (!embedding || !Array.isArray(embedding)) {
          throw new Error('API 返回的数据格式不正确');
        }
      }

      embeddings.push(embedding);
      console.log(`  ✅ 成功 (向量维度: ${embedding.length})`);
    }

    console.log('\n✅ 所有测试通过！\n');

    // 计算相似度
    console.log('📊 语义相似度测试：\n');

    function cosineSimilarity(a, b) {
      let dot = 0;
      let magA = 0;
      let magB = 0;

      for (let i = 0; i < Math.min(a.length, b.length); i++) {
        dot += a[i] * b[i];
        magA += a[i] * a[i];
        magB += b[i] * b[i];
      }

      return dot / (Math.sqrt(magA) * Math.sqrt(magB));
    }

    const sim01 = cosineSimilarity(embeddings[0], embeddings[1]);
    const sim02 = cosineSimilarity(embeddings[0], embeddings[2]);
    const sim12 = cosineSimilarity(embeddings[1], embeddings[2]);

    console.log(`文本 1 vs 文本 2 (都关于动物/宠物): ${(sim01 * 100).toFixed(2)}%`);
    console.log(`文本 1 vs 文本 3 (不相关): ${(sim02 * 100).toFixed(2)}%`);
    console.log(`文本 2 vs 文本 3 (不相关): ${(sim12 * 100).toFixed(2)}%`);

    console.log('\n💡 解读：');
    if (sim01 > sim02 && sim01 > sim12) {
      console.log('✅ 语义检索正常！相关文本的相似度更高。');
    } else {
      console.log('⚠️  相似度结果不太理想，但 API 调用成功。');
    }

    console.log('\n🎉 Embedding 功能测试完成！');
    console.log('现在记忆系统可以进行真正的语义检索了。\n');

  } catch (error) {
    console.error('\n❌ 测试失败：', error.message);
    console.log('\n可能的原因：');
    console.log('  1. API Key 无效或已过期');
    console.log('  2. Base URL 配置错误');
    console.log('  3. 模型名称不正确');
    console.log('  4. 网络连接问题');
    console.log('  5. Hugging Face 模型正在加载（首次调用需要等待）');
    console.log('\n如果使用 Hugging Face：');
    console.log('  - 已注册账号：https://huggingface.co/');
    console.log('  - API Key 有效：https://huggingface.co/settings/tokens');
    console.log('  - 首次调用模型可能需要等待 20-30 秒');
    console.log('\n如果使用 OpenRouter：');
    console.log('  - 已注册账号：https://openrouter.ai/');
    console.log('  - API Key 有效');
    console.log('  - 账户有足够积分');
    process.exit(1);
  }
}

testEmbedding();
