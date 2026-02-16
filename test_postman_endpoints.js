/**
 * Test script to verify Postman collection endpoints
 * Run: node test_postman_endpoints.js
 */

const collection = require('./POSTMAN_COLLECTION.json');
const http = require('http');

const BASE_URL = 'http://localhost:5000';

// Test endpoints
const testEndpoints = [
  { name: 'Health Check', method: 'GET', path: '/api/health', auth: false },
  { name: 'Register Pet Owner', method: 'POST', path: '/api/auth/register', auth: false, body: {
    name: 'Test User',
    email: `test${Date.now()}@example.com`,
    phone: '+1234567890',
    password: 'password123',
    role: 'PET_OWNER'
  }},
];

function makeRequest(options, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, data: json });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });

    req.on('error', reject);
    
    if (body) {
      req.write(JSON.stringify(body));
    }
    
    req.end();
  });
}

async function testEndpoint(endpoint) {
  const url = new URL(BASE_URL + endpoint.path);
  const options = {
    hostname: url.hostname,
    port: url.port || 5000,
    path: url.pathname + url.search,
    method: endpoint.method,
    headers: {
      'Content-Type': 'application/json'
    }
  };

  if (endpoint.auth) {
    options.headers['Authorization'] = 'Bearer ' + (process.env.TOKEN || '');
  }

  try {
    const result = await makeRequest(options, endpoint.body);
    const success = result.status >= 200 && result.status < 300;
    console.log(`${success ? '✅' : '❌'} ${endpoint.name}: ${result.status} - ${success ? 'PASS' : 'FAIL'}`);
    if (!success) {
      console.log('   Response:', JSON.stringify(result.data, null, 2).substring(0, 200));
    }
    return success;
  } catch (error) {
    console.log(`❌ ${endpoint.name}: ERROR - ${error.message}`);
    return false;
  }
}

async function runTests() {
  console.log('🧪 Testing Postman Collection Endpoints\n');
  console.log('='.repeat(50));
  
  let passed = 0;
  let failed = 0;

  for (const endpoint of testEndpoints) {
    const success = await testEndpoint(endpoint);
    if (success) passed++;
    else failed++;
    await new Promise(resolve => setTimeout(resolve, 500)); // Wait 500ms between requests
  }

  console.log('='.repeat(50));
  console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);
  
  if (failed === 0) {
    console.log('✅ All tests passed!');
  } else {
    console.log('⚠️  Some tests failed. Check server logs.');
  }
}

// Check if server is running
const healthCheck = http.request({
  hostname: 'localhost',
  port: 5000,
  path: '/api/health',
  method: 'GET'
}, (res) => {
  if (res.statusCode === 200) {
    console.log('✅ Server is running\n');
    runTests();
  } else {
    console.log('❌ Server returned status:', res.statusCode);
    process.exit(1);
  }
});

healthCheck.on('error', (err) => {
  console.log('❌ Server is not running. Please start the server first.');
  console.log('   Error:', err.message);
  process.exit(1);
});

healthCheck.end();
