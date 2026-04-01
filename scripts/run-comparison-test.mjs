#!/usr/bin/env node

/**
 * 对比测试脚本
 * 用于同时测试 Claude (默认模型) 和 GPT-5.4，并生成对比报告
 * 
 * 使用方法:
 * node scripts/run-comparison-test.mjs --persona [人设ID]
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';

const REPO_ROOT = process.cwd();
const TEST_CASES_PATH = join(REPO_ROOT, 'docs', 'COMPARISON_TEST_CASES.json');
const RESULTS_DIR = join(REPO_ROOT, 'docs', 'test-results');
const COMPARISONS_DIR = join(REPO_ROOT, 'docs', 'comparisons');

function parseArgs(argv) {
  let personaId = null;
  let baseUrl = 'http://localhost:3000';

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--persona' && argv[i + 1]) {
      personaId = argv[i + 1];
      i++;
    } else if (argv[i] === '--base-url' && argv[i + 1]) {
      baseUrl = argv[i + 1];
      i++;
    }
  }

  if (!personaId) {
    console.error('错误: 缺少 --persona 参数');
    console.error('使用方法: node scripts/run-comparison-test.mjs --persona [人设ID]');
    process.exit(1);
  }

  return { personaId, baseUrl };
}

function getTimestamp() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

function runBatchTest(personaId, modelProviderId, baseUrl) {
  console.log(`\n🧪 运行测试: ${modelProviderId || 'Claude (默认)'}`);
  console.log('='.repeat(60));

  const cmd = [
    'npx tsx tests/batch-tester.ts',
    `--persona ${personaId}`,
    '--category ALL',
    `--base-url ${baseUrl}`,
    modelProviderId ? `--model-provider ${modelProviderId}` : ''
  ].filter(Boolean).join(' ');

  try {
    execSync(cmd, { 
      stdio: 'inherit',
      env: {
        ...process.env,
        BATCH_TESTER_TEST_CASES_PATH: TEST_CASES_PATH
      }
    });
    
    // 获取最新的结果文件
    const files = readdirSync(RESULTS_DIR)
      .filter(f => f.startsWith('result-') && f.endsWith('.json'))
      .sort()
      .reverse();
    
    if (files.length === 0) {
      throw new Error('未找到测试结果文件');
    }

    const latestFile = join(RESULTS_DIR, files[0]);
    console.log(`✅ 测试完成: ${files[0]}`);
    return latestFile;
  } catch (error) {
    console.error(`❌ 测试失败: ${error.message}`);
    throw error;
  }
}

function loadTestResult(filePath) {
  const content = readFileSync(filePath, 'utf8');
  return JSON.parse(content);
}

function generateComparisonReport(claudeResult, gptResult) {
  const timestamp = getTimestamp();
  const reportPath = join(COMPARISONS_DIR, `comparison-${timestamp}.md`);

  let report = `# Claude vs GPT-5.4 对比测试报告\n\n`;
  report += `- 生成时间: ${new Date().toISOString()}\n`;
  report += `- Claude 结果: ${claudeResult.generated_at}\n`;
  report += `- GPT-5.4 结果: ${gptResult.generated_at}\n`;
  report += `- 测试用例数: ${claudeResult.total}\n\n`;

  report += `## 总体对比\n\n`;
  report += `| 指标 | Claude (默认) | GPT-5.4 |\n`;
  report += `| --- | ---: | ---: |\n`;
  report += `| 通过数 | ${claudeResult.passed}/${claudeResult.total} | ${gptResult.passed}/${gptResult.total} |\n`;
  report += `| 通过率 | ${claudeResult.pass_rate}% | ${gptResult.pass_rate}% |\n`;
  report += `| 失败数 | ${claudeResult.failed} | ${gptResult.failed} |\n\n`;

  report += `## 逐条对比\n\n`;

  for (let i = 0; i < claudeResult.results.length; i++) {
    const claudeCase = claudeResult.results[i];
    const gptCase = gptResult.results[i];

    if (claudeCase.id !== gptCase.id) {
      console.warn(`警告: 用例顺序不匹配 ${claudeCase.id} vs ${gptCase.id}`);
      continue;
    }

    report += `### ${claudeCase.id} [${claudeCase.category}] ${claudeCase.category_label}\n\n`;
    report += `用户输入："${claudeCase.input}"\n\n`;
    report += `期待：${claudeCase.expectation}\n\n`;

    if (claudeCase.prerequisite) {
      report += `前置条件：${claudeCase.prerequisite}\n\n`;
    }

    report += `| Claude (默认) | GPT-5.4 |\n`;
    report += `| --- | --- |\n`;
    report += `| ${claudeCase.reply.replace(/\n/g, '<br>')} | ${gptCase.reply.replace(/\n/g, '<br>')} |\n\n`;

    const claudeStatus = claudeCase.passed ? '✅ 通过' : '❌ 失败';
    const gptStatus = gptCase.passed ? '✅ 通过' : '❌ 失败';
    
    report += `硬性检查：${claudeStatus} / ${gptStatus}\n\n`;

    // 如果有失败的检查，显示详情
    if (!claudeCase.passed || !gptCase.passed) {
      report += `<details>\n<summary>检查详情</summary>\n\n`;
      
      if (!claudeCase.passed) {
        report += `**Claude 失败原因:**\n`;
        Object.entries(claudeCase.checks).forEach(([key, check]) => {
          if (!check.pass) {
            report += `- ${key}: ${JSON.stringify(check)}\n`;
          }
        });
        report += `\n`;
      }

      if (!gptCase.passed) {
        report += `**GPT-5.4 失败原因:**\n`;
        Object.entries(gptCase.checks).forEach(([key, check]) => {
          if (!check.pass) {
            report += `- ${key}: ${JSON.stringify(check)}\n`;
          }
        });
        report += `\n`;
      }

      report += `</details>\n\n`;
    }

    report += `---\n\n`;
  }

  report += `## 分析建议\n\n`;
  report += `请人工对比以上回复，关注以下维度：\n\n`;
  report += `1. **情绪回应**：哪个模型更能接住情绪？是否有温度？\n`;
  report += `2. **自然度**：哪个模型更像真人朋友？是否有 AI 味？\n`;
  report += `3. **长度适配**：哪个模型的回复长度更合适？\n`;
  report += `4. **生活感**：哪个模型的延伸更自然？是否刻意？\n`;
  report += `5. **角色一致性**：哪个模型更符合人设？\n\n`;

  writeFileSync(reportPath, report, 'utf8');
  console.log(`\n📊 对比报告已生成: ${reportPath}`);
  return reportPath;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  console.log('🚀 开始对比测试');
  console.log('='.repeat(60));
  console.log(`人设 ID: ${args.personaId}`);
  console.log(`API 地址: ${args.baseUrl}`);
  console.log(`测试用例: ${TEST_CASES_PATH}`);

  // 运行 Claude 测试
  const claudeResultPath = runBatchTest(args.personaId, null, args.baseUrl);
  
  // 运行 GPT-5.4 测试
  const gptResultPath = runBatchTest(args.personaId, 'direct-model-gpt54', args.baseUrl);

  // 加载结果
  const claudeResult = loadTestResult(claudeResultPath);
  const gptResult = loadTestResult(gptResultPath);

  // 生成对比报告
  const reportPath = generateComparisonReport(claudeResult, gptResult);

  console.log('\n✅ 对比测试完成！');
  console.log(`\nClaude: ${claudeResult.passed}/${claudeResult.total} 通过`);
  console.log(`GPT-5.4: ${gptResult.passed}/${gptResult.total} 通过`);
  console.log(`\n查看对比报告: ${reportPath}`);
}

main().catch(error => {
  console.error(`\n❌ 对比测试失败: ${error.message}`);
  process.exit(1);
});
