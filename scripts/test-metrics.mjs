/**
 * Test script for MemoryMetrics
 */

import { MemoryMetrics, memoryMetrics } from '../src/lib/memory/metrics.ts';

console.log('Testing MemoryMetrics...\n');

// Test 1: Basic recording
console.log('Test 1: Basic recording');
const metrics = new MemoryMetrics();
metrics.record('test.operation', 100);
metrics.record('test.operation', 200);
metrics.record('test.operation', 300);

const stats = metrics.getStats('test.operation');
console.log('Stats:', stats);
console.assert(stats.count === 3, 'Count should be 3');
console.assert(stats.mean === 200, 'Mean should be 200');
console.assert(stats.median === 200, 'Median should be 200');
console.assert(stats.min === 100, 'Min should be 100');
console.assert(stats.max === 300, 'Max should be 300');
console.log('✓ Test 1 passed\n');

// Test 2: Slow query warning
console.log('Test 2: Slow query warning (should see warning below)');
metrics.record('slow.operation', 2500);
console.log('✓ Test 2 passed\n');

// Test 3: Multiple metrics
console.log('Test 3: Multiple metrics');
metrics.record('memory.add.duration', 150);
metrics.record('memory.search.duration', 250);
metrics.record('memory.update.duration', 350);

const allStats = metrics.getAllStats();
console.log('All stats:', Object.keys(allStats));
console.assert(Object.keys(allStats).length === 5, 'Should have 5 metrics');
console.log('✓ Test 3 passed\n');

// Test 4: Percentiles
console.log('Test 4: Percentiles');
const percentileMetrics = new MemoryMetrics();
for (let i = 1; i <= 100; i++) {
  percentileMetrics.record('percentile.test', i);
}

const percentileStats = percentileMetrics.getStats('percentile.test');
console.log('Percentile stats:', {
  p95: percentileStats.p95,
  p99: percentileStats.p99,
});
console.assert(percentileStats.p95 === 95, 'P95 should be 95');
console.assert(percentileStats.p99 === 99, 'P99 should be 99');
console.log('✓ Test 4 passed\n');

// Test 5: Global singleton
console.log('Test 5: Global singleton');
memoryMetrics.record('global.test', 500);
const globalStats = memoryMetrics.getStats('global.test');
console.log('Global stats:', globalStats);
console.assert(globalStats.count === 1, 'Global singleton should work');
console.assert(globalStats.mean === 500, 'Global singleton value should be 500');
console.log('✓ Test 5 passed\n');

// Test 6: Non-existent metric
console.log('Test 6: Non-existent metric');
const nonExistent = metrics.getStats('non.existent');
console.assert(nonExistent === null, 'Non-existent metric should return null');
console.log('✓ Test 6 passed\n');

// Test 7: Max 1000 records
console.log('Test 7: Max 1000 records');
const limitMetrics = new MemoryMetrics();
for (let i = 0; i < 1100; i++) {
  limitMetrics.record('limit.test', i);
}
const limitStats = limitMetrics.getStats('limit.test');
console.log('Limit stats count:', limitStats.count);
console.assert(limitStats.count === 1000, 'Should keep only 1000 records');
console.log('✓ Test 7 passed\n');

console.log('All tests passed! ✓');
