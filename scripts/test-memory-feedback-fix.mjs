#!/usr/bin/env node

/**
 * 测试 memory_feedback 表的 user_id 字段类型修复
 * 验证可以使用字符串 user_id（如 "demo-local-user"）而不是 UUID
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 加载环境变量
config({ path: path.join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testMemoryFeedbackFix() {
  console.log('🧪 Testing memory_feedback table user_id type fix\n');

  try {
    // 1. 检查表结构
    console.log('1️⃣ Checking memory_feedback table schema...');
    const { data: columns, error: schemaError } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type')
      .eq('table_schema', 'public')
      .eq('table_name', 'memory_feedback')
      .eq('column_name', 'user_id');

    if (schemaError) {
      console.error('❌ Failed to check schema:', schemaError.message);
      return false;
    }

    if (!columns || columns.length === 0) {
      console.log('⚠️  memory_feedback table not found or user_id column missing');
      console.log('   Run the schema migration script first:');
      console.log('   psql $DATABASE_URL -f scripts/setup-memory-frontend-integration-schema.sql');
      return false;
    }

    const userIdColumn = columns[0];
    console.log(`   user_id column type: ${userIdColumn.data_type}`);

    if (userIdColumn.data_type !== 'text' && userIdColumn.data_type !== 'character varying') {
      console.log(`❌ user_id is still ${userIdColumn.data_type}, expected TEXT`);
      console.log('   Run the migration script to fix:');
      console.log('   psql $DATABASE_URL -f scripts/setup-memory-frontend-integration-schema.sql');
      return false;
    }

    console.log('✅ user_id column is TEXT type\n');

    // 2. 测试插入字符串 user_id
    console.log('2️⃣ Testing insert with string user_id...');
    
    // 首先创建一个测试记忆
    const testMemory = {
      user_id: 'demo-local-user',
      persona_id: 'test-persona',
      memory_type: 'user_fact',
      content: 'Test memory for feedback fix',
      importance: 0.5,
      embedding: Array(1536).fill(0),
    };

    const { data: memory, error: memoryError } = await supabase
      .from('memories')
      .insert(testMemory)
      .select()
      .single();

    if (memoryError) {
      console.error('❌ Failed to create test memory:', memoryError.message);
      return false;
    }

    console.log(`   Created test memory: ${memory.id}`);

    // 测试插入反馈
    const testFeedback = {
      user_id: 'demo-local-user',
      memory_id: memory.id,
      feedback_type: 'inaccurate',
      feedback_reason: 'Test feedback for fix validation',
    };

    const { data: feedback, error: feedbackError } = await supabase
      .from('memory_feedback')
      .insert(testFeedback)
      .select()
      .single();

    if (feedbackError) {
      console.error('❌ Failed to insert feedback:', feedbackError.message);
      
      // 清理测试记忆
      await supabase.from('memories').delete().eq('id', memory.id);
      
      return false;
    }

    console.log(`   Created feedback: ${feedback.id}`);
    console.log('✅ Successfully inserted feedback with string user_id\n');

    // 3. 清理测试数据
    console.log('3️⃣ Cleaning up test data...');
    
    const { error: deleteFeedbackError } = await supabase
      .from('memory_feedback')
      .delete()
      .eq('id', feedback.id);

    if (deleteFeedbackError) {
      console.error('⚠️  Failed to delete test feedback:', deleteFeedbackError.message);
    }

    const { error: deleteMemoryError } = await supabase
      .from('memories')
      .delete()
      .eq('id', memory.id);

    if (deleteMemoryError) {
      console.error('⚠️  Failed to delete test memory:', deleteMemoryError.message);
    }

    console.log('✅ Test data cleaned up\n');

    return true;
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    return false;
  }
}

// 运行测试
testMemoryFeedbackFix()
  .then((success) => {
    if (success) {
      console.log('✅ All tests passed! The fix is working correctly.');
      process.exit(0);
    } else {
      console.log('❌ Tests failed. Please check the errors above.');
      process.exit(1);
    }
  })
  .catch((error) => {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  });
