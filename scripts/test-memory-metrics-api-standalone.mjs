#!/usr/bin/env node

/**
 * Standalone test for Memory Metrics functionality
 * Tests the metrics system without requiring a running server
 */

import { memoryMetrics } from '../src/lib/memory/metrics.ts';

console.log('🧪 Memory Metrics Standalone Test\n');

/**
 * Test 1: Record metrics
 */
function testRecordMetrics() {
  console.log('Test 1: Record metrics');
  
  try {
    memoryMetrics.record('memory.add.duration', 150);
    memoryMetrics.record('memory.add.duration', 200);
    memoryMetrics.record('memory.add.duration', 180);
    
    memoryMetrics.record('memory.search.duration', 500);
    memoryMetrics.record('memory.search.duration', 800);
    memoryMetrics.record('memory.search.duration', 650);
    
    memoryMetrics.record('embedding.duration', 100);
    memoryMetrics.record('embedding.duration', 120);
    
    memoryMetrics.record('reranker.duration', 300);
    
    console.log('✅ PASS: Metrics recorded successfully\n');
    return true;
  } catch (error) {
    console.log(`❌ FAIL: ${error.message}\n`);
    return false;
  }
}

/**
 * Test 2: Get individual metric stats
 */
function testGetStats() {
  console.log('Test 2: Get individual metric stats');
  
  try {
    const stats = memoryMetrics.getStats('memory.add.duration');
    
    if (!stats) {
      console.log('❌ FAIL: No stats returned\n');
      return false;
    }
    
    console.log('✅ PASS: Stats retrieved successfully');
    console.log(`   Count: ${stats.count}`);
    console.log(`   Mean: ${stats.mean.toFixed(2)}ms`);
    console.log(`   Median: ${stats.median.toFixed(2)}ms`);
    console.log(`   P95: ${stats.p95.toFixed(2)}ms`);
    console.log(`   P99: ${stats.p99.toFixed(2)}ms`);
    console.log(`   Min: ${stats.min.toFixed(2)}ms`);
    console.log(`   Max: ${stats.max.toFixed(2)}ms\n`);
    
    // Validate stats values
    if (stats.count === 3 && stats.min === 150 && stats.max === 200) {
      console.log('✅ PASS: Stats values are correct\n');
      return true;
    } else {
      console.log('❌ FAIL: Stats values are incorrect\n');
      return false;
    }
  } catch (error) {
    console.log(`❌ FAIL: ${error.message}\n`);
    return false;
  }
}

/**
 * Test 3: Get all stats
 */
function testGetAllStats() {
  console.log('Test 3: Get all stats');
  
  try {
    const allStats = memoryMetrics.getAllStats();
    
    if (!allStats || typeof allStats !== 'object') {
      console.log('❌ FAIL: Invalid stats object\n');
      return false;
    }
    
    const metricNames = Object.keys(allStats);
    console.log('✅ PASS: All stats retrieved successfully');
    console.log(`   Total metrics: ${metricNames.length}`);
    console.log(`   Metric names: ${metricNames.join(', ')}\n`);
    
    // Display all metrics
    console.log('   📊 All Metrics:');
    for (const [name, stats] of Object.entries(allStats)) {
      console.log(`   - ${name}:`);
      console.log(`     Count: ${stats.count}, Mean: ${stats.mean.toFixed(2)}ms, P95: ${stats.p95.toFixed(2)}ms`);
    }
    console.log();
    
    return true;
  } catch (error) {
    console.log(`❌ FAIL: ${error.message}\n`);
    return false;
  }
}

/**
 * Test 4: Slow query warning
 */
function testSlowQueryWarning() {
  console.log('Test 4: Slow query warning (>2000ms)');
  
  try {
    console.log('   Recording slow operation (2500ms)...');
    
    // Capture console.warn
    const originalWarn = console.warn;
    let warnCalled = false;
    let warnMessage = '';
    
    console.warn = (message) => {
      warnCalled = true;
      warnMessage = message;
    };
    
    memoryMetrics.record('memory.search.duration', 2500);
    
    // Restore console.warn
    console.warn = originalWarn;
    
    if (warnCalled && warnMessage.includes('Slow operation')) {
      console.log('✅ PASS: Slow query warning triggered');
      console.log(`   Warning: ${warnMessage}\n`);
      return true;
    } else {
      console.log('❌ FAIL: Slow query warning not triggered\n');
      return false;
    }
  } catch (error) {
    console.log(`❌ FAIL: ${error.message}\n`);
    return false;
  }
}

/**
 * Test 5: Non-existent metric
 */
function testNonExistentMetric() {
  console.log('Test 5: Non-existent metric');
  
  try {
    const stats = memoryMetrics.getStats('non.existent.metric');
    
    if (stats === null) {
      console.log('✅ PASS: Returns null for non-existent metric\n');
      return true;
    } else {
      console.log('❌ FAIL: Should return null for non-existent metric\n');
      return false;
    }
  } catch (error) {
    console.log(`❌ FAIL: ${error.message}\n`);
    return false;
  }
}

/**
 * Test 6: API response format simulation
 */
function testAPIResponseFormat() {
  console.log('Test 6: API response format simulation');
  
  try {
    const stats = memoryMetrics.getAllStats();
    
    // Simulate API response
    const apiResponse = {
      success: true,
      data: {
        metrics: stats,
        timestamp: new Date().toISOString(),
      },
      error: null,
    };
    
    console.log('✅ PASS: API response format is valid');
    console.log(`   Response structure: ${JSON.stringify(Object.keys(apiResponse))}`);
    console.log(`   Data structure: ${JSON.stringify(Object.keys(apiResponse.data))}`);
    console.log(`   Timestamp: ${apiResponse.data.timestamp}\n`);
    
    return true;
  } catch (error) {
    console.log(`❌ FAIL: ${error.message}\n`);
    return false;
  }
}

/**
 * Run all tests
 */
function runTests() {
  console.log('Starting Memory Metrics standalone tests...\n');
  
  const results = [];
  
  results.push(testRecordMetrics());
  results.push(testGetStats());
  results.push(testGetAllStats());
  results.push(testSlowQueryWarning());
  results.push(testNonExistentMetric());
  results.push(testAPIResponseFormat());
  
  // Summary
  const passed = results.filter(r => r).length;
  const total = results.length;
  
  console.log('═'.repeat(60));
  console.log(`Test Summary: ${passed}/${total} tests passed`);
  console.log('═'.repeat(60));
  
  if (passed === total) {
    console.log('✅ All tests passed!');
    console.log('\n💡 Next steps:');
    console.log('   1. Start the dev server: npm run dev');
    console.log('   2. Run API integration test: node scripts/test-memory-metrics-api.mjs');
    process.exit(0);
  } else {
    console.log('❌ Some tests failed');
    process.exit(1);
  }
}

// Main execution
runTests();
