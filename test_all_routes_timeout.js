/**
 * Comprehensive Route Timeout Testing Script
 * Tests ALL routes in the backend to identify timeout issues
 * Run: node test_all_routes_timeout.js
 * 
 * This script will:
 * 1. Test all GET endpoints (most likely to timeout)
 * 2. Measure response times
 * 3. Identify which ones timeout (>10 seconds)
 * 4. Generate a detailed report
 */

const http = require('http');

const BASE_URL = 'http://localhost:5000';
const TIMEOUT_MS = 12000; // 12 seconds timeout
const SLOW_THRESHOLD = 5000; // 5 seconds = slow

// Test token (you'll need to create a test user and get a token)
// For now, we'll test without auth first, then with auth
let TEST_TOKEN = process.env.TEST_TOKEN || '';

// Dummy IDs for testing (will be replaced with actual IDs if available)
const DUMMY_ID = '507f1f77bcf86cd799439011';

/**
 * Make HTTP request with timeout
 */
function makeRequest(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE_URL + path);
    const options = {
      hostname: url.hostname,
      port: url.port || 5000,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: TIMEOUT_MS
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const startTime = Date.now();
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        const elapsed = Date.now() - startTime;
        try {
          const json = JSON.parse(data);
          resolve({ 
            status: res.statusCode, 
            data: json,
            elapsed,
            success: res.statusCode >= 200 && res.statusCode < 300
          });
        } catch (e) {
          resolve({ 
            status: res.statusCode, 
            data: data.substring(0, 200),
            elapsed,
            success: res.statusCode >= 200 && res.statusCode < 300
          });
        }
      });
    });

    req.on('error', (error) => {
      const elapsed = Date.now() - startTime;
      reject({ error: error.message, elapsed });
    });

    req.on('timeout', () => {
      req.destroy();
      const elapsed = Date.now() - startTime;
      reject({ error: 'Request timeout', elapsed, timeout: true });
    });

    if (body) {
      req.write(JSON.stringify(body));
    }

    req.end();
  });
}

/**
 * Test endpoint
 */
async function testEndpoint(endpoint) {
  try {
    const result = await makeRequest(
      endpoint.method,
      endpoint.path,
      endpoint.body,
      endpoint.requiresAuth ? TEST_TOKEN : null
    );

    return {
      ...endpoint,
      status: result.status,
      elapsed: result.elapsed,
      success: result.success,
      timeout: false,
      error: null
    };
  } catch (error) {
    return {
      ...endpoint,
      status: null,
      elapsed: error.elapsed || TIMEOUT_MS,
      success: false,
      timeout: error.timeout || false,
      error: error.error || 'Unknown error'
    };
  }
}

/**
 * All endpoints to test
 */
const endpointsToTest = [
  // Health check
  { method: 'GET', path: '/api/health', requiresAuth: false, category: 'Health' },
  { method: 'GET', path: '/', requiresAuth: false, category: 'Health' },

  // Auth routes (public)
  { method: 'POST', path: '/api/auth/register', requiresAuth: false, category: 'Auth', body: {
    name: 'Test User',
    email: `test${Date.now()}@example.com`,
    phone: '+1234567890',
    password: 'password123',
    role: 'PET_OWNER'
  }},
  { method: 'POST', path: '/api/auth/login', requiresAuth: false, category: 'Auth', body: {
    email: 'test@example.com',
    password: 'password123'
  }},

  // Pet routes (GET endpoints)
  { method: 'GET', path: '/api/pets', requiresAuth: true, category: 'Pets' },
  { method: 'GET', path: `/api/pets/${DUMMY_ID}`, requiresAuth: true, category: 'Pets' },

  // Pet Owner routes
  { method: 'GET', path: '/api/pet-owners/dashboard', requiresAuth: true, category: 'Pet Owner' },
  { method: 'GET', path: '/api/pet-owners/appointments', requiresAuth: true, category: 'Pet Owner' },
  { method: 'GET', path: '/api/pet-owners/payments', requiresAuth: true, category: 'Pet Owner' },

  // Veterinarian routes
  { method: 'GET', path: '/api/veterinarians', requiresAuth: false, category: 'Veterinarians' },
  { method: 'GET', path: `/api/veterinarians/${DUMMY_ID}`, requiresAuth: false, category: 'Veterinarians' },
  { method: 'GET', path: '/api/veterinarians/dashboard', requiresAuth: true, category: 'Veterinarians' },
  { method: 'GET', path: '/api/veterinarians/reviews', requiresAuth: true, category: 'Veterinarians' },
  { method: 'GET', path: '/api/veterinarians/my-subscription', requiresAuth: true, category: 'Veterinarians' },

  // Appointment routes
  { method: 'GET', path: '/api/appointments', requiresAuth: true, category: 'Appointments' },
  { method: 'GET', path: `/api/appointments/${DUMMY_ID}`, requiresAuth: true, category: 'Appointments' },

  // Medical Records
  { method: 'GET', path: '/api/medical-records', requiresAuth: true, category: 'Medical Records' },
  { method: 'GET', path: `/api/medical-records/${DUMMY_ID}`, requiresAuth: true, category: 'Medical Records' },

  // Vaccinations
  { method: 'GET', path: '/api/vaccinations', requiresAuth: true, category: 'Vaccinations' },
  { method: 'GET', path: '/api/vaccinations/upcoming', requiresAuth: true, category: 'Vaccinations' },

  // Weight Records
  { method: 'GET', path: '/api/weight-records', requiresAuth: true, category: 'Weight Records' },
  { method: 'GET', path: `/api/weight-records/${DUMMY_ID}`, requiresAuth: true, category: 'Weight Records' },

  // Products
  { method: 'GET', path: '/api/products', requiresAuth: false, category: 'Products' },
  { method: 'GET', path: `/api/products/${DUMMY_ID}`, requiresAuth: false, category: 'Products' },

  // Pet Stores
  { method: 'GET', path: '/api/pet-stores', requiresAuth: false, category: 'Pet Stores' },
  { method: 'GET', path: `/api/pet-stores/${DUMMY_ID}`, requiresAuth: false, category: 'Pet Stores' },

  // Orders
  { method: 'GET', path: '/api/orders', requiresAuth: true, category: 'Orders' },
  { method: 'GET', path: `/api/orders/${DUMMY_ID}`, requiresAuth: true, category: 'Orders' },

  // Reviews
  { method: 'GET', path: '/api/reviews', requiresAuth: true, category: 'Reviews' },
  { method: 'GET', path: `/api/reviews/${DUMMY_ID}`, requiresAuth: true, category: 'Reviews' },
  { method: 'GET', path: `/api/reviews/veterinarian/${DUMMY_ID}`, requiresAuth: false, category: 'Reviews' },

  // Subscriptions
  { method: 'GET', path: '/api/subscriptions/my-subscription', requiresAuth: true, category: 'Subscriptions' },
  { method: 'GET', path: `/api/subscriptions/veterinarian/${DUMMY_ID}`, requiresAuth: false, category: 'Subscriptions' },

  // Subscription Plans
  { method: 'GET', path: '/api/subscription-plans', requiresAuth: false, category: 'Subscription Plans' },
  { method: 'GET', path: '/api/subscription-plans/active', requiresAuth: false, category: 'Subscription Plans' },
  { method: 'GET', path: `/api/subscription-plans/${DUMMY_ID}`, requiresAuth: false, category: 'Subscription Plans' },

  // Chat
  { method: 'GET', path: '/api/chat/conversations', requiresAuth: true, category: 'Chat' },
  { method: 'GET', path: `/api/chat/messages/${DUMMY_ID}`, requiresAuth: true, category: 'Chat' },
  { method: 'GET', path: '/api/chat/unread-count', requiresAuth: true, category: 'Chat' },

  // Video Sessions
  { method: 'GET', path: `/api/video/appointment/${DUMMY_ID}`, requiresAuth: true, category: 'Video' },

  // Notifications
  { method: 'GET', path: '/api/notifications', requiresAuth: true, category: 'Notifications' },
  { method: 'GET', path: '/api/notifications/unread-count', requiresAuth: true, category: 'Notifications' },

  // Admin routes
  { method: 'GET', path: '/api/admin/dashboard', requiresAuth: true, category: 'Admin' },
  { method: 'GET', path: '/api/admin/users', requiresAuth: true, category: 'Admin' },
  { method: 'GET', path: '/api/admin/appointments', requiresAuth: true, category: 'Admin' },
  { method: 'GET', path: '/api/admin/transactions', requiresAuth: true, category: 'Admin' },
  { method: 'GET', path: '/api/admin/reviews', requiresAuth: true, category: 'Admin' },
  { method: 'GET', path: '/api/admin/activity', requiresAuth: true, category: 'Admin' },

  // Specializations
  { method: 'GET', path: '/api/specializations', requiresAuth: false, category: 'Specializations' },

  // Availability
  { method: 'GET', path: '/api/availability', requiresAuth: true, category: 'Availability' },
  { method: 'GET', path: '/api/availability/slots', requiresAuth: false, category: 'Availability' },
  { method: 'GET', path: '/api/availability/check', requiresAuth: false, category: 'Availability' },

  // Weekly Schedule
  { method: 'GET', path: '/api/weekly-schedule', requiresAuth: true, category: 'Weekly Schedule' },
  { method: 'GET', path: '/api/weekly-schedule/slots', requiresAuth: false, category: 'Weekly Schedule' },

  // Balance
  { method: 'GET', path: '/api/balance', requiresAuth: true, category: 'Balance' },
  { method: 'GET', path: '/api/balance/withdraw/requests', requiresAuth: true, category: 'Balance' },

  // Payment
  { method: 'GET', path: '/api/payment/transactions', requiresAuth: true, category: 'Payment' },
  { method: 'GET', path: `/api/payment/transaction/${DUMMY_ID}`, requiresAuth: true, category: 'Payment' },

  // Transaction
  { method: 'GET', path: '/api/transaction', requiresAuth: true, category: 'Transaction' },
  { method: 'GET', path: `/api/transaction/${DUMMY_ID}`, requiresAuth: true, category: 'Transaction' },

  // Favorite
  { method: 'GET', path: `/api/favorite/${DUMMY_ID}`, requiresAuth: true, category: 'Favorite' },

  // Reschedule Request
  { method: 'GET', path: '/api/reschedule-request', requiresAuth: true, category: 'Reschedule' },
  { method: 'GET', path: '/api/reschedule-request/eligible-appointments', requiresAuth: true, category: 'Reschedule' },
  { method: 'GET', path: `/api/reschedule-request/${DUMMY_ID}`, requiresAuth: true, category: 'Reschedule' },

  // Insurance
  { method: 'GET', path: '/api/insurance', requiresAuth: false, category: 'Insurance' },
  { method: 'GET', path: `/api/insurance/${DUMMY_ID}`, requiresAuth: false, category: 'Insurance' },
  { method: 'GET', path: '/api/insurance/admin/all', requiresAuth: true, category: 'Insurance' },

  // Blog
  { method: 'GET', path: '/api/blog', requiresAuth: false, category: 'Blog' },
  { method: 'GET', path: `/api/blog/${DUMMY_ID}`, requiresAuth: false, category: 'Blog' },

  // Users
  { method: 'GET', path: '/api/users', requiresAuth: true, category: 'Users' },
  { method: 'GET', path: `/api/users/${DUMMY_ID}`, requiresAuth: true, category: 'Users' },
  { method: 'GET', path: '/api/users/veterinarians', requiresAuth: true, category: 'Users' },

  // Mapping
  { method: 'GET', path: '/api/mapping/route', requiresAuth: false, category: 'Mapping' },
  { method: 'GET', path: '/api/mapping/nearby', requiresAuth: false, category: 'Mapping' },
  { method: 'GET', path: `/api/mapping/clinic/${DUMMY_ID}`, requiresAuth: false, category: 'Mapping' },

  // CRM
  { method: 'GET', path: '/api/crm/data', requiresAuth: true, category: 'CRM' },

  // Announcements
  { method: 'GET', path: '/api/announcements', requiresAuth: true, category: 'Announcements' },
  { method: 'GET', path: `/api/announcements/${DUMMY_ID}`, requiresAuth: true, category: 'Announcements' },
  { method: 'GET', path: '/api/announcements/veterinarian', requiresAuth: true, category: 'Announcements' },
  { method: 'GET', path: '/api/announcements/unread-count', requiresAuth: true, category: 'Announcements' },
  { method: 'GET', path: `/api/announcements/${DUMMY_ID}/read-status`, requiresAuth: true, category: 'Announcements' }
];

/**
 * Main test function
 */
async function runTests() {
  console.log('🧪 Comprehensive Route Timeout Testing\n');
  console.log('='.repeat(80));
  console.log(`Testing ${endpointsToTest.length} endpoints...\n`);

  // First, try to get a token by registering/login
  console.log('🔐 Attempting to get test token...');
  try {
    const registerResult = await makeRequest('POST', '/api/auth/register', {
      name: 'Test User',
      email: `test${Date.now()}@example.com`,
      phone: '+1234567890',
      password: 'password123',
      role: 'PET_OWNER'
    });
    if (registerResult.success && registerResult.data.data && registerResult.data.data.token) {
      TEST_TOKEN = registerResult.data.data.token;
      console.log('✅ Got test token from registration\n');
    }
  } catch (error) {
    console.log('⚠️  Could not get token (will test public routes only)\n');
  }

  const results = {
    passed: [],
    failed: [],
    timeout: [],
    slow: [],
    errors: []
  };

  let testCount = 0;
  const totalTests = endpointsToTest.length;

  for (const endpoint of endpointsToTest) {
    testCount++;
    process.stdout.write(`\r[${testCount}/${totalTests}] Testing ${endpoint.method} ${endpoint.path}...`);

    const result = await testEndpoint(endpoint);

    if (result.timeout) {
      results.timeout.push(result);
      console.log(`\n❌ TIMEOUT: ${result.method} ${result.path} (${result.elapsed}ms)`);
    } else if (result.elapsed > SLOW_THRESHOLD) {
      results.slow.push(result);
      console.log(`\n⚠️  SLOW: ${result.method} ${result.path} (${result.elapsed}ms)`);
    } else if (result.success) {
      results.passed.push(result);
    } else if (result.error) {
      results.errors.push(result);
    } else {
      results.failed.push(result);
    }

    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log('\n\n' + '='.repeat(80));
  console.log('\n📊 TEST RESULTS SUMMARY\n');
  console.log(`✅ Passed: ${results.passed.length}`);
  console.log(`❌ Failed: ${results.failed.length}`);
  console.log(`⏱️  Timeout (>${TIMEOUT_MS}ms): ${results.timeout.length}`);
  console.log(`🐌 Slow (>${SLOW_THRESHOLD}ms): ${results.slow.length}`);
  console.log(`💥 Errors: ${results.errors.length}`);

  // Detailed timeout report
  if (results.timeout.length > 0) {
    console.log('\n' + '='.repeat(80));
    console.log('\n⏱️  TIMEOUT ENDPOINTS (>10 seconds):\n');
    results.timeout.forEach((endpoint, index) => {
      console.log(`${index + 1}. ${endpoint.method} ${endpoint.path}`);
      console.log(`   Category: ${endpoint.category}`);
      console.log(`   Elapsed: ${endpoint.elapsed}ms`);
      console.log(`   Error: ${endpoint.error || 'Timeout'}\n`);
    });
  }

  // Slow endpoints report
  if (results.slow.length > 0) {
    console.log('\n' + '='.repeat(80));
    console.log(`\n🐌 SLOW ENDPOINTS (>${SLOW_THRESHOLD}ms):\n`);
    results.slow
      .sort((a, b) => b.elapsed - a.elapsed)
      .forEach((endpoint, index) => {
        console.log(`${index + 1}. ${endpoint.method} ${endpoint.path} - ${endpoint.elapsed}ms`);
      });
  }

  // Failed endpoints
  if (results.failed.length > 0) {
    console.log('\n' + '='.repeat(80));
    console.log('\n❌ FAILED ENDPOINTS:\n');
    results.failed.forEach((endpoint, index) => {
      console.log(`${index + 1}. ${endpoint.method} ${endpoint.path} - Status: ${endpoint.status}`);
    });
  }

  // Save results to file
  const fs = require('fs');
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      total: totalTests,
      passed: results.passed.length,
      failed: results.failed.length,
      timeout: results.timeout.length,
      slow: results.slow.length,
      errors: results.errors.length
    },
    timeouts: results.timeout.map(e => ({
      method: e.method,
      path: e.path,
      category: e.category,
      elapsed: e.elapsed,
      error: e.error
    })),
    slow: results.slow.map(e => ({
      method: e.method,
      path: e.path,
      category: e.category,
      elapsed: e.elapsed
    })).sort((a, b) => b.elapsed - a.elapsed)
  };

  fs.writeFileSync('route_timeout_test_results.json', JSON.stringify(report, null, 2));
  console.log('\n\n💾 Detailed results saved to: route_timeout_test_results.json');

  // Recommendations
  console.log('\n' + '='.repeat(80));
  console.log('\n💡 RECOMMENDATIONS:\n');
  
  if (results.timeout.length > 0) {
    console.log(`1. Fix ${results.timeout.length} timeout endpoints (see list above)`);
    console.log('2. Check service files for these endpoints:');
    results.timeout.forEach(e => {
      const serviceName = e.path.split('/')[2].replace(/-/g, '');
      console.log(`   - src/services/${serviceName}.service.js`);
    });
    console.log('3. Ensure all queries have:');
    console.log('   - .maxTimeMS(2000-3000)');
    console.log('   - .lean() for read queries');
    console.log('   - .limit() for list queries');
    console.log('   - Proper indexes');
  }

  if (results.slow.length > 0) {
    console.log(`\n4. Optimize ${results.slow.length} slow endpoints`);
    console.log('   - Remove deep populate chains');
    console.log('   - Use separate queries with lookup maps');
    console.log('   - Add pagination limits');
  }

  console.log('\n✅ Testing complete!\n');
}

// Check if server is running
console.log('🔍 Checking if server is running...\n');
const healthCheck = http.request({
  hostname: 'localhost',
  port: 5000,
  path: '/api/health',
  method: 'GET',
  timeout: 5000
}, (res) => {
  if (res.statusCode === 200) {
    console.log('✅ Server is running\n');
    runTests().catch(error => {
      console.error('\n❌ Test execution error:', error);
      process.exit(1);
    });
  } else {
    console.log('❌ Server returned status:', res.statusCode);
    process.exit(1);
  }
});

healthCheck.on('error', (err) => {
  console.log('❌ Server is not running. Please start the server first.');
  console.log('   Error:', err.message);
  console.log('\n   Run: npm start');
  process.exit(1);
});

healthCheck.on('timeout', () => {
  healthCheck.destroy();
  console.log('❌ Server health check timed out. Is the server running?');
  process.exit(1);
});

healthCheck.end();
