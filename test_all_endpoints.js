/**
 * Comprehensive endpoint testing script
 * Tests all endpoints and identifies timeout issues
 * Run: node test_all_endpoints.js
 */

const http = require('http');
const https = require('https');

const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';
const TIMEOUT = 10000; // 10 seconds per request
let authToken = null;
let testUserId = null;

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

// Test results
const results = {
  passed: [],
  failed: [],
  timeout: [],
  errors: []
};

/**
 * Make HTTP request with timeout
 */
function makeRequest(options, body = null) {
  return new Promise((resolve, reject) => {
    const protocol = options.protocol === 'https:' ? https : http;
    const startTime = Date.now();
    
    const req = protocol.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        const duration = Date.now() - startTime;
        try {
          const json = JSON.parse(data);
          resolve({ 
            status: res.statusCode, 
            data: json,
            duration,
            headers: res.headers
          });
        } catch (e) {
          resolve({ 
            status: res.statusCode, 
            data: data,
            duration,
            headers: res.headers
          });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.setTimeout(TIMEOUT, () => {
      req.destroy();
      reject(new Error(`Request timeout after ${TIMEOUT}ms`));
    });

    if (body) {
      req.write(JSON.stringify(body));
    }
    
    req.end();
  });
}

/**
 * Test a single endpoint
 */
async function testEndpoint(endpoint) {
  const url = new URL(BASE_URL + endpoint.path);
  const options = {
    protocol: url.protocol,
    hostname: url.hostname,
    port: url.port || (url.protocol === 'https:' ? 443 : 80),
    path: url.pathname + url.search,
    method: endpoint.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
  };

  if (endpoint.auth && authToken) {
    options.headers['Authorization'] = `Bearer ${authToken}`;
  }

  const testName = `${endpoint.method || 'GET'} ${endpoint.path}`;
  const startTime = Date.now();

  try {
    const result = await makeRequest(options, endpoint.body);
    const duration = Date.now() - startTime;
    
    // Check if it's a success response
    const isSuccess = result.status >= 200 && result.status < 300;
    const isClientError = result.status >= 400 && result.status < 500;
    const isServerError = result.status >= 500;
    
    // Check for timeout error in response
    const isTimeout = result.data && (
      (typeof result.data === 'string' && result.data.includes('timeout')) ||
      (result.data.message && result.data.message.includes('timeout'))
    );

    if (isTimeout || duration >= TIMEOUT) {
      results.timeout.push({
        endpoint: testName,
        status: result.status,
        duration,
        error: 'Timeout'
      });
      return { success: false, timeout: true, duration, status: result.status };
    }

    if (isSuccess) {
      results.passed.push({
        endpoint: testName,
        status: result.status,
        duration
      });
      return { success: true, duration, status: result.status };
    } else if (isClientError) {
      // Client errors (400-499) are expected for some endpoints without proper data
      results.passed.push({
        endpoint: testName,
        status: result.status,
        duration,
        note: 'Client error (expected)'
      });
      return { success: true, duration, status: result.status };
    } else {
      results.failed.push({
        endpoint: testName,
        status: result.status,
        duration,
        error: result.data
      });
      return { success: false, duration, status: result.status, error: result.data };
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    const isTimeout = error.message.includes('timeout') || duration >= TIMEOUT;
    
    if (isTimeout) {
      results.timeout.push({
        endpoint: testName,
        duration,
        error: error.message
      });
      return { success: false, timeout: true, duration, error: error.message };
    } else {
      results.errors.push({
        endpoint: testName,
        duration,
        error: error.message
      });
      return { success: false, duration, error: error.message };
    }
  }
}

/**
 * Test endpoints by category
 */
const testEndpoints = [
  // Health Check
  { name: 'Health Check', method: 'GET', path: '/api/health', auth: false },

  // Authentication (no auth needed)
  { name: 'Register Pet Owner', method: 'POST', path: '/api/auth/register', auth: false, body: {
    name: 'Test User',
    email: `test${Date.now()}@example.com`,
    phone: '+1234567890',
    password: 'password123',
    role: 'PET_OWNER'
  }},
  { name: 'Login', method: 'POST', path: '/api/auth/login', auth: false, body: {
    email: 'test@example.com',
    password: 'password123'
  }},

  // Specializations (public)
  { name: 'List Specializations', method: 'GET', path: '/api/specializations', auth: false },
  { name: 'Create Specialization', method: 'POST', path: '/api/specializations', auth: true, body: {
    name: 'Test Specialization',
    description: 'Test description'
  }},

  // Products (public)
  { name: 'List Products', method: 'GET', path: '/api/products', auth: false },
  { name: 'Get Product', method: 'GET', path: '/api/products/507f1f77bcf86cd799439011', auth: false },

  // Pet Owners (requires auth)
  { name: 'Get Pet Owner Dashboard', method: 'GET', path: '/api/pet-owners/dashboard', auth: true },
  { name: 'Get Appointment History', method: 'GET', path: '/api/pet-owners/appointments', auth: true },
  { name: 'Get Payment History', method: 'GET', path: '/api/pet-owners/payments', auth: true },

  // Medical Records (requires auth)
  { name: 'Get Medical Records', method: 'GET', path: '/api/medical-records', auth: true },
  { name: 'Get Medical Record', method: 'GET', path: '/api/medical-records/507f1f77bcf86cd799439011', auth: true },

  // Appointments (requires auth)
  { name: 'List Appointments', method: 'GET', path: '/api/appointments', auth: true },
  { name: 'Get Appointment', method: 'GET', path: '/api/appointments/507f1f77bcf86cd799439011', auth: true },

  // Veterinarians (public)
  { name: 'List Veterinarians', method: 'GET', path: '/api/veterinarians', auth: false },
  { name: 'Get Veterinarian', method: 'GET', path: '/api/veterinarians/507f1f77bcf86cd799439011', auth: false },
  { name: 'Get Veterinarian Dashboard', method: 'GET', path: '/api/veterinarians/dashboard', auth: true },

  // Pets (requires auth)
  { name: 'List Pets', method: 'GET', path: '/api/pets', auth: true },
  { name: 'Get Pet', method: 'GET', path: '/api/pets/507f1f77bcf86cd799439011', auth: true },

  // Reviews (public)
  { name: 'List Reviews', method: 'GET', path: '/api/reviews', auth: false },
  { name: 'Get Review', method: 'GET', path: '/api/reviews/507f1f77bcf86cd799439011', auth: false },

  // Notifications (requires auth)
  { name: 'Get Notifications', method: 'GET', path: '/api/notifications', auth: true },
  { name: 'Get Unread Count', method: 'GET', path: '/api/notifications/unread-count', auth: true },

  // Subscriptions (requires auth)
  { name: 'List Subscriptions', method: 'GET', path: '/api/subscriptions', auth: true },
  { name: 'List Subscription Plans', method: 'GET', path: '/api/subscription-plans', auth: false },

  // Transactions (requires auth)
  { name: 'List Transactions', method: 'GET', path: '/api/transaction', auth: true },
  { name: 'Get Transaction', method: 'GET', path: '/api/transaction/507f1f77bcf86cd799439011', auth: true },

  // Balance (requires auth)
  { name: 'Get Balance', method: 'GET', path: '/api/balance', auth: true },

  // Favorites (requires auth)
  { name: 'List Favorites', method: 'GET', path: '/api/favorite', auth: true },

  // Vaccinations (requires auth)
  { name: 'List Vaccinations', method: 'GET', path: '/api/vaccinations', auth: true },

  // Weight Records (requires auth)
  { name: 'List Weight Records', method: 'GET', path: '/api/weight-records', auth: true },

  // Orders (requires auth)
  { name: 'List Orders', method: 'GET', path: '/api/orders', auth: true },
  { name: 'Get Order', method: 'GET', path: '/api/orders/507f1f77bcf86cd799439011', auth: true },

  // Admin endpoints (requires auth + admin role)
  { name: 'Admin Dashboard', method: 'GET', path: '/api/admin/dashboard', auth: true },
  { name: 'List All Users', method: 'GET', path: '/api/admin/users', auth: true },
  { name: 'Approve Veterinarian', method: 'POST', path: '/api/auth/approve-veterinarian', auth: true, body: {
    userId: '507f1f77bcf86cd799439011'
  }},

  // Availability (requires auth)
  { name: 'Get Availability', method: 'GET', path: '/api/availability', auth: true },

  // Weekly Schedule (requires auth)
  { name: 'Get Weekly Schedule', method: 'GET', path: '/api/weekly-schedule', auth: true },

  // Blog (public)
  { name: 'List Blog Posts', method: 'GET', path: '/api/blog', auth: false },
  { name: 'Get Blog Post', method: 'GET', path: '/api/blog/507f1f77bcf86cd799439011', auth: false },

  // Announcements (public)
  { name: 'List Announcements', method: 'GET', path: '/api/announcements', auth: false },
];

/**
 * First, try to login to get auth token
 */
async function setupAuth() {
  console.log(`${colors.cyan}🔐 Setting up authentication...${colors.reset}`);
  
  // Try to register a test user first
  try {
    const url = new URL(BASE_URL + '/api/auth/register');
    const options = {
      protocol: url.protocol,
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    };

    const body = {
      name: 'Test User',
      email: `test${Date.now()}@example.com`,
      phone: '+1234567890',
      password: 'password123',
      role: 'PET_OWNER'
    };

    const result = await makeRequest(options, body);
    
    if (result.status === 201 && result.data && result.data.data && result.data.data.token) {
      authToken = result.data.data.token;
      testUserId = result.data.data.user?.id;
      console.log(`${colors.green}✅ Registered test user and got token${colors.reset}\n`);
      return true;
    }
  } catch (error) {
    // Registration might fail if user exists, try login
  }

  // Try to login with a test account
  try {
    const url = new URL(BASE_URL + '/api/auth/login');
    const options = {
      protocol: url.protocol,
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    };

    const body = {
      email: 'test@example.com',
      password: 'password123'
    };

    const result = await makeRequest(options, body);
    
    if (result.status === 200 && result.data && result.data.data && result.data.data.token) {
      authToken = result.data.data.token;
      testUserId = result.data.data.user?.id;
      console.log(`${colors.green}✅ Logged in and got token${colors.reset}\n`);
      return true;
    }
  } catch (error) {
    console.log(`${colors.yellow}⚠️  Could not authenticate. Some endpoints will fail.${colors.reset}\n`);
  }

  return false;
}

/**
 * Run all tests
 */
async function runTests() {
  console.log(`${colors.blue}🧪 Testing All API Endpoints${colors.reset}\n`);
  console.log(`${colors.cyan}Base URL: ${BASE_URL}${colors.reset}`);
  console.log(`${colors.cyan}Timeout: ${TIMEOUT}ms per request${colors.reset}\n`);
  console.log('='.repeat(80));

  // Setup authentication first
  await setupAuth();

  console.log(`\n${colors.blue}Testing ${testEndpoints.length} endpoints...${colors.reset}\n`);

  for (let i = 0; i < testEndpoints.length; i++) {
    const endpoint = testEndpoints[i];
    const progress = `[${i + 1}/${testEndpoints.length}]`;
    
    process.stdout.write(`${progress} Testing ${endpoint.name}... `);
    
    const result = await testEndpoint(endpoint);
    
    if (result.timeout) {
      console.log(`${colors.red}⏱️  TIMEOUT (${result.duration}ms)${colors.reset}`);
    } else if (result.success) {
      console.log(`${colors.green}✅ PASS (${result.duration}ms, ${result.status})${colors.reset}`);
    } else {
      console.log(`${colors.red}❌ FAIL (${result.duration}ms, ${result.status})${colors.reset}`);
      if (result.error) {
        const errorMsg = typeof result.error === 'string' ? result.error : JSON.stringify(result.error).substring(0, 100);
        console.log(`   ${colors.yellow}Error: ${errorMsg}${colors.reset}`);
      }
    }

    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  // Print summary
  console.log('\n' + '='.repeat(80));
  console.log(`\n${colors.blue}📊 Test Summary${colors.reset}\n`);
  
  console.log(`${colors.green}✅ Passed: ${results.passed.length}${colors.reset}`);
  console.log(`${colors.red}❌ Failed: ${results.failed.length}${colors.reset}`);
  console.log(`${colors.red}⏱️  Timeout: ${results.timeout.length}${colors.reset}`);
  console.log(`${colors.yellow}⚠️  Errors: ${results.errors.length}${colors.reset}`);

  // List timeout endpoints
  if (results.timeout.length > 0) {
    console.log(`\n${colors.red}⏱️  Endpoints with Timeout Issues:${colors.reset}`);
    results.timeout.forEach(item => {
      console.log(`   - ${item.endpoint} (${item.duration}ms)`);
    });
  }

  // List failed endpoints
  if (results.failed.length > 0) {
    console.log(`\n${colors.red}❌ Failed Endpoints:${colors.reset}`);
    results.failed.forEach(item => {
      console.log(`   - ${item.endpoint} (Status: ${item.status})`);
    });
  }

  // List error endpoints
  if (results.errors.length > 0) {
    console.log(`\n${colors.yellow}⚠️  Endpoints with Errors:${colors.reset}`);
    results.errors.forEach(item => {
      console.log(`   - ${item.endpoint}: ${item.error}`);
    });
  }

  // Save results to file
  const fs = require('fs');
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      total: testEndpoints.length,
      passed: results.passed.length,
      failed: results.failed.length,
      timeout: results.timeout.length,
      errors: results.errors.length
    },
    timeouts: results.timeout,
    failures: results.failed,
    errors: results.errors
  };

  fs.writeFileSync('test_results.json', JSON.stringify(report, null, 2));
  console.log(`\n${colors.cyan}📄 Detailed results saved to test_results.json${colors.reset}\n`);

  // Exit with appropriate code
  if (results.timeout.length > 0 || results.failed.length > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

// Check if server is running first
async function checkServer() {
  return new Promise((resolve, reject) => {
    const healthCheck = http.request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/health',
      method: 'GET',
      timeout: 5000
    }, (res) => {
      if (res.statusCode === 200) {
        console.log(`${colors.green}✅ Server is running${colors.reset}\n`);
        resolve(true);
      } else {
        console.log(`${colors.red}❌ Server returned status: ${res.statusCode}${colors.reset}`);
        reject(new Error(`Server returned ${res.statusCode}`));
      }
    });

    healthCheck.on('error', (err) => {
      reject(err);
    });

    healthCheck.on('timeout', () => {
      healthCheck.destroy();
      reject(new Error('Health check timed out'));
    });

    healthCheck.end();
  });
}

// Main execution
(async () => {
  try {
    console.log(`${colors.cyan}Checking if server is running...${colors.reset}`);
    await checkServer();
    await runTests();
  } catch (error) {
    console.log(`${colors.red}❌ Server is not running. Please start the server first.${colors.reset}`);
    console.log(`   Error: ${error.message}`);
    console.log(`\n${colors.yellow}To start the server, run:${colors.reset}`);
    console.log(`   ${colors.cyan}npm start${colors.reset}\n`);
    process.exit(1);
  }
})();
