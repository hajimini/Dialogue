import 'dotenv/config';

console.log('Environment variables:');
console.log('ANTHROPIC_AUTH_TOKEN:', process.env.ANTHROPIC_AUTH_TOKEN?.substring(0, 10) + '...');
console.log('ANTHROPIC_BASE_URL:', process.env.ANTHROPIC_BASE_URL);
console.log('ANTHROPIC_MODEL:', process.env.ANTHROPIC_MODEL);

// Test API call
async function testApi() {
  const endpoint = `${process.env.ANTHROPIC_BASE_URL}/v1/messages`;

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_AUTH_TOKEN,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5',
        max_tokens: 100,
        temperature: 0.7,
        system: '你是一个友好的助手',
        messages: [
          {
            role: 'user',
            content: '你好，请用一句话介绍你自己',
          },
        ],
      }),
    });

    console.log('\nAPI Response Status:', response.status, response.statusText);

    if (!response.ok) {
      const text = await response.text();
      console.log('Error response:', text.substring(0, 500));
      return;
    }

    const json = await response.json();
    console.log('\nAPI Response:', JSON.stringify(json, null, 2));
  } catch (error) {
    console.error('\nAPI Error:', error.message);
  }
}

testApi();
