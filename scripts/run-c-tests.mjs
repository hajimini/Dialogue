#!/usr/bin/env node

/**
 * Task 22: C类测试验证脚本
 * 
 * 运行 C 类测试用例（中文指代词场景）并记录结果
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';

const PERSONA_ID = 'e92e08d8-a25e-4a56-a439-60d71b0e4e69'; // 小晚
const TEST_RESULTS_DIR = 'docs/test-results';

function runTest(testId) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Running test: ${testId}`);
  console.log('='.repeat(60));
  
  try {
    const output = execSync(
      `npm run test:batch -- --category C --persona ${PERSONA_ID}`,
      {
        encoding: 'utf8',
        stdio: 'inherit',
        cwd: process.cwd()
      }
    );
    
    return { success: true, output };
  } catch (error) {
    console.error(`Test ${testId} failed:`, error.message);
    return { success: false, error: error.message };
  }
}

function getLatestResultFile() {
  const files = readdirSync(TEST_RESULTS_DIR)
    .filter(f => f.startsWith('result-') && f.endsWith('.json'))
    .sort()
    .reverse();
  
  return files.length > 0 ? join(TEST_RESULTS_DIR, files[0]) : null;
}

function analyzeResults(resultFile) {
  if (!resultFile) {
    console.log('⚠️  No result file found');
    return null;
  }
  
  const data = JSON.parse(readFileSync(resultFile, 'utf8'));
  
  console.log('\n' + '='.repeat(60));
  console.log('C类测试结果分析');
  console.log('='.repeat(60));
  
  console.log(`\n📊 总体统计:`);
  console.log(`   总测试数: ${data.total}`);
  console.log(`   通过: ${data.passed}`);
  console.log(`   失败: ${data.failed}`);
  console.log(`   通过率: ${data.pass_rate}%`);
  
  const cTests = data.results.filter(r => r.category === 'C');
  const c01 = cTests.find(r => r.id === 'C01');
  const c09 = cTests.find(r => r.id === 'C09');
  
  console.log(`\n🎯 C类测试详情 (${cTests.length} 个测试):`);
  
  if (c01) {
    console.log(`\n   C01: "那只猫今天又来了"`);
    console.log(`   状态: ${c01.passed ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`   回复: "${c01.reply}"`);
    console.log(`   回复长度: ${c01.reply_length} 字符`);
    console.log(`   耗时: ${c01.duration_ms}ms`);
    
    if (!c01.passed) {
      console.log(`   失败原因:`);
      Object.entries(c01.checks).forEach(([check, result]) => {
        if (!result.pass) {
          console.log(`      - ${check}: ${JSON.stringify(result)}`);
        }
      });
    }
  }
  
  if (c09) {
    console.log(`\n   C09: "我今天去看了那个展"`);
    console.log(`   状态: ${c09.passed ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`   回复: "${c09.reply}"`);
    console.log(`   回复长度: ${c09.reply_length} 字符`);
    console.log(`   耗时: ${c09.duration_ms}ms`);
    
    if (!c09.passed) {
      console.log(`   失败原因:`);
      Object.entries(c09.checks).forEach(([check, result]) => {
        if (!result.pass) {
          console.log(`      - ${check}: ${JSON.stringify(result)}`);
        }
      });
    }
  }
  
  console.log(`\n📋 所有 C 类测试:`);
  cTests.forEach(test => {
    const status = test.passed ? '✅' : '❌';
    console.log(`   ${status} ${test.id}: ${test.input}`);
    if (!test.passed && test.error) {
      console.log(`      错误: ${test.error}`);
    }
  });
  
  // 检查是否有"哪个"反问
  console.log(`\n🔍 指代词处理检查:`);
  cTests.forEach(test => {
    const hasWhichQuestion = test.reply.includes('哪个') || test.reply.includes('哪只') || test.reply.includes('哪家');
    if (hasWhichQuestion) {
      console.log(`   ⚠️  ${test.id}: 检测到反问 - "${test.reply}"`);
    } else {
      console.log(`   ✅ ${test.id}: 未检测到反问`);
    }
  });
  
  // 检查通过率是否达标
  const cPassRate = (cTests.filter(t => t.passed).length / cTests.length) * 100;
  console.log(`\n🎯 C类测试通过率: ${cPassRate.toFixed(2)}%`);
  
  if (cPassRate >= 90) {
    console.log(`   ✅ 达到目标 (≥90%)`);
  } else {
    console.log(`   ❌ 未达到目标 (需要 ≥90%)`);
  }
  
  return {
    total: cTests.length,
    passed: cTests.filter(t => t.passed).length,
    failed: cTests.filter(t => !t.passed).length,
    passRate: cPassRate,
    c01: c01 ? { passed: c01.passed, reply: c01.reply } : null,
    c09: c09 ? { passed: c09.passed, reply: c09.reply } : null,
    resultFile
  };
}

function generateSummary(analysis) {
  const timestamp = new Date().toISOString();
  const summary = {
    task: 'Task 22: C类测试验证',
    timestamp,
    persona_id: PERSONA_ID,
    persona_name: '小晚',
    results: analysis,
    conclusion: analysis.passRate >= 90 ? 
      '✅ C类测试通过率达到90%以上，上下文衔接功能正常' :
      '❌ C类测试通过率未达到90%，需要进一步优化'
  };
  
  const summaryFile = `docs/test-results/task-22-c-tests-summary-${timestamp.replace(/[:.]/g, '-')}.json`;
  writeFileSync(summaryFile, JSON.stringify(summary, null, 2));
  
  console.log(`\n📄 测试总结已保存到: ${summaryFile}`);
  
  return summary;
}

async function main() {
  console.log('🚀 Task 22: C类测试验证');
  console.log(`   Persona: 小晚 (${PERSONA_ID})`);
  console.log(`   测试类别: C (记忆衔接)`);
  
  // 运行所有 C 类测试
  console.log('\n📝 运行所有 C 类测试用例...');
  const result = runTest('ALL-C');
  
  if (!result.success) {
    console.error('❌ 测试运行失败');
    process.exit(1);
  }
  
  // 等待一下让文件写入完成
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // 分析结果
  const latestResult = getLatestResultFile();
  const analysis = analyzeResults(latestResult);
  
  if (analysis) {
    // 生成总结
    const summary = generateSummary(analysis);
    
    // 输出最终结论
    console.log('\n' + '='.repeat(60));
    console.log('最终结论');
    console.log('='.repeat(60));
    console.log(summary.conclusion);
    console.log('='.repeat(60));
    
    // 如果通过率不达标，退出码为 1
    if (analysis.passRate < 90) {
      process.exit(1);
    }
  }
}

main().catch(error => {
  console.error('❌ 脚本执行失败:', error);
  process.exit(1);
});
