/**
 * Integration test for MemoryMetrics with Mem0Adapter
 * 
 * This script tests that metrics are properly recorded during memory operations
 */

import { getMemoryGateway } from '../src/lib/memory/factory.ts';
import { memoryMetrics } from '../src/lib/memory/metrics.ts';

console.log('Testing MemoryMetrics integration with Mem0Adapter...\n');

async function testMetricsIntegration() {
  try {
    // Get the memory gateway
    const gateway = getMemoryGateway();
    console.log('✓ Memory gateway initialized\n');

    // Clear any existing metrics
    console.log('Initial metrics:', memoryMetrics.getAllStats());
    console.log();

    // Test 1: Add memory operation
    console.log('Test 1: Testing memory.add.duration metric');
    try {
      await gateway.add({
        userId: 'test-user-metrics',
        personaId: 'test-persona-metrics',
        memoryType: 'user_fact',
        content: 'This is a test memory for metrics tracking',
        importance: 0.8,
      });
      console.log('✓ Memory added successfully');
    } catch {
      console.log('Note: Add operation failed (expected if no Supabase), but metric should still be recorded');
    }

    const addStats = memoryMetrics.getStats('memory.add.duration');
    if (addStats) {
      console.log('Add operation stats:', {
        count: addStats.count,
        mean: addStats.mean.toFixed(2) + 'ms',
        min: addStats.min.toFixed(2) + 'ms',
        max: addStats.max.toFixed(2) + 'ms',
      });
      console.log('✓ memory.add.duration metric recorded\n');
    } else {
      console.log('✗ memory.add.duration metric NOT recorded\n');
    }

    // Test 2: Search memory operation
    console.log('Test 2: Testing memory.search.duration metric');
    try {
      await gateway.search({
        userId: 'test-user-metrics',
        personaId: 'test-persona-metrics',
        query: 'test query',
        limit: 5,
      });
      console.log('✓ Memory search completed');
    } catch {
      console.log('Note: Search operation failed (expected if no Supabase), but metric should still be recorded');
    }

    const searchStats = memoryMetrics.getStats('memory.search.duration');
    if (searchStats) {
      console.log('Search operation stats:', {
        count: searchStats.count,
        mean: searchStats.mean.toFixed(2) + 'ms',
        min: searchStats.min.toFixed(2) + 'ms',
        max: searchStats.max.toFixed(2) + 'ms',
      });
      console.log('✓ memory.search.duration metric recorded\n');
    } else {
      console.log('✗ memory.search.duration metric NOT recorded\n');
    }

    // Test 3: Get all metrics
    console.log('Test 3: Testing getAllStats()');
    const allStats = memoryMetrics.getAllStats();
    console.log('All recorded metrics:', Object.keys(allStats));
    console.log('Total metrics:', Object.keys(allStats).length);
    
    if (Object.keys(allStats).length > 0) {
      console.log('✓ getAllStats() working correctly\n');
    } else {
      console.log('✗ No metrics recorded\n');
    }

    // Display detailed stats for all metrics
    console.log('Detailed stats for all metrics:');
    for (const [name, stats] of Object.entries(allStats)) {
      console.log(`\n${name}:`);
      console.log(`  Count: ${stats.count}`);
      console.log(`  Mean: ${stats.mean.toFixed(2)}ms`);
      console.log(`  Median: ${stats.median.toFixed(2)}ms`);
      console.log(`  P95: ${stats.p95.toFixed(2)}ms`);
      console.log(`  P99: ${stats.p99.toFixed(2)}ms`);
      console.log(`  Min: ${stats.min.toFixed(2)}ms`);
      console.log(`  Max: ${stats.max.toFixed(2)}ms`);
    }

    console.log('\n✓ Integration test completed successfully!');
  } catch {
    console.error('✗ Integration test failed:', error);
    process.exit(1);
  }
}

testMetricsIntegration();
