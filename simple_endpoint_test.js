/**
 * Simple Endpoint Test - Tests endpoints individually to identify timeouts
 * Run: node simple_endpoint_test.js
 */

const http = require('http');
const fs = require('fs');

const BASE_URL = 'http://localhost:5000';
const TIMEOUT_MS = 10000; // 10 seconds

function makeRequest(method, path) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    
    const req = http.request({
      hostname: 'localhost',
      port: 5000,
      path: path,
      method: method,
      timeout: TIMEOUT_MS
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        const elapsed = Date.now() - startTime;
        resolve({ 
          status: res.statusCode, 
          elapsed,
          success: res.statusCode < 500
        });
      });
    });

    req.on('error', (error) => {
      const elapsed = Date.now() - startTime;
      reject({ error: error.message, elapsed });
    });

    req.on('timeout', () => {
      req.destroy();
      const elapsed = Date.now() - startTime;
      reject({ error: 'TIMEOUT', elapsed, timeout: true });
    });

    req.end();
  });
}

async function testEndpoint(name, method, path) {
  try {
    console.log(`Testing ${method} ${path}...`);
    const result = await makeRequest(method, path);
    
    if (result.elapsed > 5000) {
      console.log(`⚠️  SLOW: ${name} - ${result.elapsed}ms - Status: ${result.status}`);
      return { name, path, status: 'SLOW', elapsed: result.elapsed, httpStatus: result.status };
    } else {
      console.log(`✅ FAST: ${name} - ${result.elapsed}ms - Status: ${result.status}`);
      return { name, path, status: 'OK', elapsed: result.elapsed, httpStatus: result.status };
    }
  } catch (error) {
    if (error.timeout) {
      console.log(`❌ TIMEOUT: ${name} - ${error.elapsed}ms`);
      return { name, path, status: 'TIMEOUT', elapsed: error.elapsed, error: error.error };
    } else {
      console.log(`❌ ERROR: ${name} - ${error.error}`);
      return { name, path, status: 'ERROR', elapsed: error.elapsed || 0, error: error.error };
    }
  }
}

async function runTests() {
  console.log('🧪 Simple Endpoint Testing - Public Routes Only\n');
  
  const endpoints = [
    // Health and basic routes
    { name: 'Health Check', method: 'GET', path: '/api/health' },
    
    // Public routes (no auth required)
    { name: 'List Veterinarians', method: 'GET', path: '/api/veterinarians' },
    { name: 'List Products', method: 'GET', path: '/api/products' },
    { name: 'List Pet Stores', method: 'GET', path: '/api/pet-stores' },
    { name: 'List Active Subscription Plans', method: 'GET', path: '/api/subscription-plans/active' },
    { name: 'List All Subscription Plans', method: 'GET', path: '/api/subscription-plans' },
    { name: 'List Blog Posts', method: 'GET', path: '/api/blog' },
    { name: 'List Active Insurance Companies', method: 'GET', path: '/api/insurance' },
    { name: 'Get Available Slots', method: 'GET', path: '/api/availability/slots' },
    { name: 'Check Time Slot', method: 'GET', path: '/api/availability/check' },
    { name: 'Get Weekly Schedule Slots', method: 'GET', path: '/api/weekly-schedule/slots' },
    { name: 'Get Route Info', method: 'GET', path: '/api/mapping/route' },
    { name: 'Get Nearby Clinics', method: 'GET', path: '/api/mapping/nearby' },
    
    // Auth routes (should work without token)
    { name: 'Auth Register', method: 'POST', path: '/api/auth/register' },
    { name: 'Auth Login', method: 'POST', path: '/api/auth/login' },
    
    // Routes that might require auth but we can test response time
    { name: 'List Pets (Auth Required)', method: 'GET', path: '/api/pets' },
    { name: 'Pet Owner Dashboard (Auth Required)', method: 'GET', path: '/api/pet-owners/dashboard' },
    { name: 'Admin Dashboard (Auth Required)', method: 'GET', path: '/api/admin/dashboard' },
    { name: 'List Appointments (Auth Required)', method: 'GET', path: '/api/appointments' },
    { name: 'List Medical Records (Auth Required)', method: 'GET', path: '/api/medical-records' },
    { name: 'List Orders (Auth Required)', method: 'GET', path: '/api/orders' },
    { name: 'List Reviews (Auth Required)', method: 'GET', path: '/api/reviews' },
    { name: 'List Notifications (Auth Required)', method: 'GET', path: '/api/notifications' },
    { name: 'Get Unread Notifications Count (Auth Required)', method: 'GET', path: '/api/notifications/unread-count' },
    { name: 'List Vaccinations (Auth Required)', method: 'GET', path: '/api/vaccinations' },
    { name: 'Get Upcoming Vaccinations (Auth Required)', method: 'GET', path: '/api/vaccinations/upcoming' },
    { name: 'List Weight Records (Auth Required)', method: 'GET', path: '/api/weight-records' },
    { name: 'List Specializations (Auth Required)', method: 'GET', path: '/api/specializations' },
    { name: 'List Subscriptions (Auth Required)', method: 'GET', path: '/api/subscriptions' },
    { name: 'Get Chat Conversations (Auth Required)', method: 'GET', path: '/api/chat/conversations' },
    { name: 'Get Chat Unread Count (Auth Required)', method: 'GET', path: '/api/chat/unread-count' },
    { name: 'Get Balance (Auth Required)', method: 'GET', path: '/api/balance' },
    { name: 'List Transactions (Auth Required)', method: 'GET', path: '/api/transaction' },
    { name: 'Get Payment Transactions (Auth Required)', method: 'GET', path: '/api/payment/transactions' },
    { name: 'List Reschedule Requests (Auth Required)', method: 'GET', path: '/api/reschedule-request' },
    { name: 'List Admin Users (Auth Required)', method: 'GET', path: '/api/admin/users' },
    { name: 'List Admin Appointments (Auth Required)', method: 'GET', path: '/api/admin/appointments' },
    { name: 'List Admin Transactions (Auth Required)', method: 'GET', path: '/api/admin/transactions' },
    { name: 'List Admin Reviews (Auth Required)', method: 'GET', path: '/api/admin/reviews' }
  ];

  const results = {
    ok: [],
    slow: [],
    timeout: [],
    error: []
  };

  console.log(`Testing ${endpoints.length} endpoints...\n`);

  for (let i = 0; i < endpoints.length; i++) {
    const endpoint = endpoints[i];
    console.log(`[${i + 1}/${endpoints.length}]`, end='');
    
    const result = await testEndpoint(endpoint.name, endpoint.method, endpoint.path);
    
    switch (result.status) {
      case 'OK':
        results.ok.push(result);
        break;
      case 'SLOW':
        results.slow.push(result);
        break;
      case 'TIMEOUT':
        results.timeout.push(result);
        break;
      case 'ERROR':
        results.error.push(result);
        break;
    }
    
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log('\n' + '='.repeat(80));
  console.log('\n📊 RESULTS SUMMARY:');
  console.log(`✅ Fast (< 5s): ${results.ok.length}`);
  console.log(`⚠️  Slow (5-10s): ${results.slow.length}`);
  console.log(`❌ Timeout (> 10s): ${results.timeout.length}`);
  console.log(`💥 Error: ${results.error.length}`);

  if (results.timeout.length > 0) {
    console.log('\n' + '='.repeat(80));
    console.log('\n❌ TIMEOUT ENDPOINTS (> 10 seconds):');
    results.timeout.forEach((r, i) => {
      console.log(`${i + 1}. ${r.name}: ${r.path} (${r.elapsed}ms)`);
    });
  }

  if (results.slow.length > 0) {
    console.log('\n' + '='.repeat(80));
    console.log('\n⚠️  SLOW ENDPOINTS (5-10 seconds):');
    results.slow.sort((a, b) => b.elapsed - a.elapsed).forEach((r, i) => {
      console.log(`${i + 1}. ${r.name}: ${r.path} (${r.elapsed}ms) - Status: ${r.httpStatus}`);
    });
  }

  // Save detailed results
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      total: endpoints.length,
      fast: results.ok.length,
      slow: results.slow.length,
      timeout: results.timeout.length,
      error: results.error.length
    },
    details: {
      fast: results.ok,
      slow: results.slow,
      timeout: results.timeout,
      error: results.error
    }
  };

  fs.writeFileSync('simple_endpoint_test_results.json', JSON.stringify(report, null, 2));
  console.log('\n💾 Detailed results saved to: simple_endpoint_test_results.json');
  
  console.log('\n🚀 Next Steps:');
  if (results.timeout.length > 0) {
    console.log('1. Fix timeout endpoints by optimizing their service files');
    console.log('2. Check database indexes for these routes');
  }
  if (results.slow.length > 0) {
    console.log('3. Optimize slow endpoints (add .lean(), .maxTimeMS(), separate populates)');
  }
  console.log('4. Restart server and re-test after fixes');
}

runTests().catch(console.error);