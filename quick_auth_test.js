/**
 * Quick Auth Test - Test if auth middleware timeout fix worked
 */

const http = require('http');

function testEndpoint(name, path, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    
    const req = http.request({
      hostname: 'localhost',
      port: 5000,
      path: path,
      method: 'GET',
      timeout: timeout
    }, (res) => {
      const elapsed = Date.now() - startTime;
      console.log(`${elapsed < 2000 ? '✅' : elapsed < 5000 ? '⚠️' : '❌'} ${name}: ${elapsed}ms - Status: ${res.statusCode}`);
      resolve({ elapsed, status: res.statusCode });
      res.resume(); // consume response data to free memory
    });

    req.on('error', (error) => {
      const elapsed = Date.now() - startTime;
      console.log(`❌ ${name}: ERROR - ${error.message} (${elapsed}ms)`);
      reject(error);
    });

    req.on('timeout', () => {
      req.destroy();
      const elapsed = Date.now() - startTime;
      console.log(`❌ ${name}: TIMEOUT (${elapsed}ms)`);
      reject(new Error('TIMEOUT'));
    });

    req.end();
  });
}

async function quickTest() {
  console.log('🚀 Quick Auth Timeout Fix Test\n');
  console.log('Testing critical endpoints that were timing out...\n');

  const tests = [
    { name: 'Health Check (Public)', path: '/api/health' },
    { name: 'List Products (Public)', path: '/api/products' },
    { name: 'List Pets (Auth Required)', path: '/api/pets' },
    { name: 'Pet Owner Dashboard (Auth Required)', path: '/api/pet-owners/dashboard' },
    { name: 'Admin Dashboard (Auth Required)', path: '/api/admin/dashboard' },
    { name: 'List Orders (Auth Required)', path: '/api/orders' },
    { name: 'List Notifications (Auth Required)', path: '/api/notifications' },
    { name: 'List Appointments (Auth Required)', path: '/api/appointments' }
  ];

  for (const test of tests) {
    try {
      await testEndpoint(test.name, test.path);
    } catch (error) {
      // Continue with next test
    }
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  console.log('\n📊 Results:');
  console.log('✅ < 2s = EXCELLENT');
  console.log('⚠️ 2-5s = ACCEPTABLE'); 
  console.log('❌ > 5s or TIMEOUT = NEEDS FIX');
  
  console.log('\nIf auth-required routes are now responding quickly (401/403 status is OK),');
  console.log('then the auth middleware timeout fix worked! 🎉');
}

quickTest();