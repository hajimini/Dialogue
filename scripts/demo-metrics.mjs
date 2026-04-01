/**
 * Demo script for MemoryMetrics
 * 
 * Demonstrates the complete functionality of the performance monitoring system
 */

import { MemoryMetrics, memoryMetrics } from '../src/lib/memory/metrics.ts';

console.log('='.repeat(60));
console.log('MemoryMetrics Performance Monitoring Demo');
console.log('='.repeat(60));
console.log();

// Simulate memory operations with realistic timings
console.log('Simulating memory operations...\n');

// Simulate 20 add operations
console.log('1. Simulating 20 memory.add operations');
for (let i = 0; i < 20; i++) {
  const duration = 100 + Math.random() * 200; // 100-300ms
  memoryMetrics.record('memory.add.duration', duration);
}
console.log('   ✓ Recorded 20 add operations\n');

// Simulate 30 search operations (some slow)
console.log('2. Simulating 30 memory.search operations (including slow ones)');
for (let i = 0; i < 30; i++) {
  let duration;
  if (i % 10 === 0) {
    // Every 10th search is slow (>2 seconds)
    duration = 2000 + Math.random() * 1000; // 2000-3000ms
  } else {
    duration = 150 + Math.random() * 300; // 150-450ms
  }
  memoryMetrics.record('memory.search.duration', duration);
}
console.log('   ✓ Recorded 30 search operations\n');

// Simulate 15 update operations
console.log('3. Simulating 15 memory.update operations');
for (let i = 0; i < 15; i++) {
  const duration = 80 + Math.random() * 150; // 80-230ms
  memoryMetrics.record('memory.update.duration', duration);
}
console.log('   ✓ Recorded 15 update operations\n');

// Simulate 10 delete operations
console.log('4. Simulating 10 memory.delete operations');
for (let i = 0; i < 10; i++) {
  const duration = 50 + Math.random() * 100; // 50-150ms
  memoryMetrics.record('memory.delete.duration', duration);
}
console.log('   ✓ Recorded 10 delete operations\n');

// Simulate 5 getContext operations
console.log('5. Simulating 5 memory.getContext operations');
for (let i = 0; i < 5; i++) {
  const duration = 300 + Math.random() * 400; // 300-700ms
  memoryMetrics.record('memory.getContext.duration', duration);
}
console.log('   ✓ Recorded 5 getContext operations\n');

console.log('='.repeat(60));
console.log('Performance Statistics Summary');
console.log('='.repeat(60));
console.log();

// Get all stats
const allStats = memoryMetrics.getAllStats();

// Display stats for each operation type
for (const [name, stats] of Object.entries(allStats)) {
  console.log(`📊 ${name}`);
  console.log('   ├─ Operations: ' + stats.count);
  console.log('   ├─ Mean:       ' + stats.mean.toFixed(2) + 'ms');
  console.log('   ├─ Median:     ' + stats.median.toFixed(2) + 'ms');
  console.log('   ├─ P95:        ' + stats.p95.toFixed(2) + 'ms');
  console.log('   ├─ P99:        ' + stats.p99.toFixed(2) + 'ms');
  console.log('   ├─ Min:        ' + stats.min.toFixed(2) + 'ms');
  console.log('   └─ Max:        ' + stats.max.toFixed(2) + 'ms');
  console.log();
}

console.log('='.repeat(60));
console.log('Performance Analysis');
console.log('='.repeat(60));
console.log();

// Analyze performance
const searchStats = memoryMetrics.getStats('memory.search.duration');
if (searchStats) {
  console.log('🔍 Search Performance Analysis:');
  console.log('   • Average search time: ' + searchStats.mean.toFixed(2) + 'ms');
  
  if (searchStats.p95 > 1000) {
    console.log('   ⚠️  WARNING: P95 latency is high (' + searchStats.p95.toFixed(2) + 'ms)');
  } else {
    console.log('   ✓ P95 latency is acceptable (' + searchStats.p95.toFixed(2) + 'ms)');
  }
  
  if (searchStats.max > 2000) {
    console.log('   ⚠️  WARNING: Slow queries detected (max: ' + searchStats.max.toFixed(2) + 'ms)');
  }
  console.log();
}

const addStats = memoryMetrics.getStats('memory.add.duration');
if (addStats) {
  console.log('➕ Add Performance Analysis:');
  console.log('   • Average add time: ' + addStats.mean.toFixed(2) + 'ms');
  
  if (addStats.mean < 200) {
    console.log('   ✓ Add operations are fast');
  } else {
    console.log('   ⚠️  Add operations could be optimized');
  }
  console.log();
}

console.log('='.repeat(60));
console.log('Total Operations: ' + Object.values(allStats).reduce((sum, s) => sum + s.count, 0));
console.log('='.repeat(60));
console.log();

console.log('✓ Demo completed successfully!');
console.log();
console.log('Note: The slow query warnings you saw above are from the');
console.log('automatic monitoring system detecting operations >2 seconds.');
