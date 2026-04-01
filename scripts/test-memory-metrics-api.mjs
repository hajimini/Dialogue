#!/usr/bin/env node

/**
 * Test script for Memory Metrics API
 * 
 * Tests:
 * 1. Unauthorized access (no auth)
 * 2. Forbidden access (non-admin user)
 * 3. Successful access (admin user)
 * 4. Response format validation
 */

import { memoryMetrics } from '../src/lib/memory/metrics.ts';

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
const ADMIN_EMAIL = process.env.DEMO_ADMIN_EMAIL || 'admin@ai-companion.local';
const ADMIN_PASSWORD = process.env.DEMO_ADMIN_PASSWORD || 'admin123456';
const USER_EMAIL = process.env.DEMO_USER_EMAIL || 'demo@ai-companion.local';
const USER_PASSWORD = process.env.DEMO_USER_PASSWORD || 'demo123456';

console.log('🧪 Memory Metrics API Test\n');

/**
 * Helper: Login and get session cookie
 */
async function login(email, password) {
  const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    throw new Error(`Login failed: ${response.status}`);
  }

  const cookies = response.headers.get('set-cookie');
  if (!cookies) {
    throw new Error('No session cookie received');
  }

  return cookies;
}

/**
 * Helper: Call memory metrics API
 */
async function getMemoryMetrics(sessionCookie = null) {
  const headers = {};
  if (sessionCookie) {
    headers['Cookie'] = sessionCookie;
  }

  const response = await fetch(`${API_BASE_URL}/api/admin/memory-metrics`, {
    method: 'GET',
    headers,
  });

  return {
    status: response.status,
    data: await response.json(),
  };
}

/**
 * Test 1: Unauthorized access (no auth)
 */
async function testUnauthorizedAccess() {
  console.log('Test 1: Unauthorized access (no auth)');
  
  const result = await getMemoryMetrics();
  
  if (result.status === 401) {
    console.log('✅ PASS: Returns 401 for unauthenticated request');
    console.log(`   Response: ${JSON.stringify(result.data)}\n`);
    return true;
  } else {
    console.log(`❌ FAIL: Expected 401, got ${result.status}\n`);
    return false;
  }
}

/**
 * Test 2: Forbidden access (non-admin user)
 */
async function testForbiddenAccess() {
  console.log('Test 2: Forbidden access (non-admin user)');
  
  try {
    const userCookie = await login(USER_EMAIL, USER_PASSWORD);
    const result = await getMemoryMetrics(userCookie);
    
    if (result.status === 403) {
      console.log('✅ PASS: Returns 403 for non-admin user');
      console.log(`   Response: ${JSON.stringify(result.data)}\n`);
      return true;
    } else {
      console.log(`❌ FAIL: Expected 403, got ${result.status}\n`);
      return false;
    }
  } catch (error) {
    console.log(`❌ FAIL: ${error.message}\n`);
    return false;
  }
}

/**
 * Test 3: Successful access (admin user)
 */
async function testSuccessfulAccess() {
  console.log('Test 3: Successful access (admin user)');
  
  try {
    // First, add some test metrics
    console.log('   Adding test metrics...');
    memoryMetrics.record('memory.add.duration', 150);
    memoryMetrics.record('memory.add.duration', 200);
    memoryMetrics.record('memory.search.duration', 500);
    memoryMetrics.record('memory.search.duration', 800);
    memoryMetrics.record('embedding.duration', 100);
    
    // Login as admin
    const adminCookie = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
    const result = await getMemoryMetrics(adminCookie);
    
    if (result.status === 200) {
      console.log('✅ PASS: Returns 200 for admin user');
      
      // Validate response format
      const { success, data, error } = result.data;
      
      if (success === true && error === null && data) {
        console.log('✅ PASS: Response format is correct');
        
        if (data.metrics && data.timestamp) {
          console.log('✅ PASS: Response contains metrics and timestamp');
          console.log(`   Timestamp: ${data.timestamp}`);
          console.log(`   Metrics keys: ${Object.keys(data.metrics).join(', ')}`);
          
          // Display metrics details
          console.log('\n   📊 Metrics Details:');
          for (const [name, stats] of Object.entries(data.metrics)) {
            console.log(`   - ${name}:`);
            console.log(`     Count: ${stats.count}`);
            console.log(`     Mean: ${stats.mean.toFixed(2)}ms`);
            console.log(`     Median: ${stats.median.toFixed(2)}ms`);
            console.log(`     P95: ${stats.p95.toFixed(2)}ms`);
            console.log(`     P99: ${stats.p99.toFixed(2)}ms`);
            console.log(`     Min: ${stats.min.toFixed(2)}ms`);
            console.log(`     Max: ${stats.max.toFixed(2)}ms`);
          }
          
          console.log();
          return true;
        } else {
          console.log('❌ FAIL: Response missing metrics or timestamp\n');
          return false;
        }
      } else {
        console.log('❌ FAIL: Response format is incorrect');
        console.log(`   Response: ${JSON.stringify(result.data)}\n`);
        return false;
      }
    } else {
      console.log(`❌ FAIL: Expected 200, got ${result.status}`);
      console.log(`   Response: ${JSON.stringify(result.data)}\n`);
      return false;
    }
  } catch (error) {
    console.log(`❌ FAIL: ${error.message}\n`);
    return false;
  }
}

/**
 * Test 4: Empty metrics (no data recorded)
 */
async function testEmptyMetrics() {
  console.log('Test 4: Empty metrics response');
  
  try {
    // Create a fresh metrics instance would be ideal, but we'll work with existing
    const adminCookie = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
    const result = await getMemoryMetrics(adminCookie);
    
    if (result.status === 200 && result.data.success) {
      console.log('✅ PASS: API handles empty/existing metrics gracefully');
      console.log(`   Metrics count: ${Object.keys(result.data.data.metrics).length}\n`);
      return true;
    } else {
      console.log(`❌ FAIL: Unexpected response\n`);
      return false;
    }
  } catch (error) {
    console.log(`❌ FAIL: ${error.message}\n`);
    return false;
  }
}

/**
 * Run all tests
 */
async function runTests() {
  console.log('Starting Memory Metrics API tests...\n');
  console.log(`API Base URL: ${API_BASE_URL}\n`);
  
  const results = [];
  
  results.push(await testUnauthorizedAccess());
  results.push(await testForbiddenAccess());
  results.push(await testSuccessfulAccess());
  results.push(await testEmptyMetrics());
  
  // Summary
  const passed = results.filter(r => r).length;
  const total = results.length;
  
  console.log('═'.repeat(60));
  console.log(`Test Summary: ${passed}/${total} tests passed`);
  console.log('═'.repeat(60));
  
  if (passed === total) {
    console.log('✅ All tests passed!');
    process.exit(0);
  } else {
    console.log('❌ Some tests failed');
    process.exit(1);
  }
}

// Check if server is running
async function checkServer() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/health`, {
      method: 'GET',
    });
    return response.ok;
  } catch {
    return false;
  }
}

// Main execution
(async () => {
  console.log('Checking if server is running...');
  const serverRunning = await checkServer();
  
  if (!serverRunning) {
    console.log('⚠️  Warning: Server might not be running at', API_BASE_URL);
    console.log('   Please start the development server with: npm run dev');
    console.log('   Or set API_BASE_URL environment variable\n');
  }
  
  await runTests();
})();
