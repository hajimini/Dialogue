import { config } from 'dotenv';

config({ path: '.env.local' });

async function testMemoryAPI() {
  const sessionId = '45434024-fea4-4ecf-82e6-377505dfd453';
  const baseUrl = 'http://localhost:3000';

  try {
    console.log('\n=== 测试记忆API ===\n');
    console.log(`会话ID: ${sessionId}`);
    console.log(`API地址: ${baseUrl}/api/sessions/${sessionId}/memory-context\n`);

    const response = await fetch(`${baseUrl}/api/sessions/${sessionId}/memory-context`, {
      headers: {
        'Cookie': process.env.TEST_COOKIE || ''
      }
    });

    console.log(`状态码: ${response.status}`);
    console.log(`状态文本: ${response.statusText}\n`);

    const json = await response.json();
    console.log('响应数据:');
    console.log(JSON.stringify(json, null, 2));

    if (json.success && json.data) {
      console.log(`\n记忆数量: ${json.data.memories?.length || 0}`);
      console.log(`用户画像: ${json.data.user_profile ? '有' : '无'}`);

      if (json.data.memories && json.data.memories.length > 0) {
        console.log('\n记忆列表:');
        json.data.memories.forEach((mem, idx) => {
          console.log(`  ${idx + 1}. [${mem.memory_type}] ${mem.content.substring(0, 50)}...`);
        });
      }
    }

  } catch (error) {
    console.error('\n测试失败:', error);
  }
}

testMemoryAPI();
