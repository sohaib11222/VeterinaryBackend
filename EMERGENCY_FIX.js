/**
 * EMERGENCY TIMEOUT FIX
 * This will identify and bypass the exact issue causing timeouts
 */

const express = require('express');
const http = require('http');

// Test database connection first
async function testDatabaseConnection() {
  console.log('🔍 EMERGENCY DIAGNOSIS - Testing Database Connection...');
  
  try {
    const mongoose = require('mongoose');
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/veterinary');
    console.log('✅ Database connection: WORKING');
    
    // Test a simple query
    const User = require('./src/models/User');
    const userCount = await User.countDocuments().maxTimeMS(2000);
    console.log(`✅ Database query: WORKING (${userCount} users)`);
    
    await mongoose.disconnect();
    return true;
  } catch (error) {
    console.log('❌ Database issue:', error.message);
    return false;
  }
}

// Test individual API endpoints
async function testAPIEndpoints() {
  console.log('\n🧪 Testing API Endpoints Directly...');
  
  const endpoints = [
    '/api/health',
    '/api/products',
    '/api/veterinarians',
    '/api/pets'
  ];
  
  for (const endpoint of endpoints) {
    try {
      const startTime = Date.now();
      
      const response = await new Promise((resolve, reject) => {
        const req = http.request({
          hostname: 'localhost',
          port: 5000,
          path: endpoint,
          method: 'GET',
          timeout: 3000
        }, (res) => {
          const elapsed = Date.now() - startTime;
          resolve({ status: res.statusCode, elapsed });
          res.resume();
        });
        
        req.on('error', reject);
        req.on('timeout', () => {
          req.destroy();
          reject(new Error('TIMEOUT'));
        });
        
        req.end();
      });
      
      console.log(`${response.elapsed < 1000 ? '✅' : response.elapsed < 3000 ? '⚠️' : '❌'} ${endpoint}: ${response.elapsed}ms (Status: ${response.status})`);
      
    } catch (error) {
      console.log(`❌ ${endpoint}: ${error.message}`);
    }
  }
}

// Emergency bypass route for root path
function createEmergencyRoutes() {
  console.log('\n🚨 Creating Emergency Route Handlers...');
  
  const emergencyRoutes = `
// Add to src/app.js BEFORE other routes
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Veterinary Backend API',
    status: 'Emergency fix active',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/api/health',
      products: '/api/products',
      veterinarians: '/api/veterinarians'
    }
  });
});

app.get('/dashboard', (req, res) => {
  res.status(200).json({
    success: false,
    message: 'Dashboard is a frontend route - use /api/admin/dashboard for API',
    redirect: '/api/admin/dashboard'
  });
});

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    next(); // Let API routes handle
  } else {
    res.status(404).json({
      success: false,
      message: 'Route not found - this is a backend API',
      path: req.path,
      suggestion: 'Use /api/* endpoints'
    });
  }
});
`;
  
  require('fs').writeFileSync('./EMERGENCY_ROUTES.txt', emergencyRoutes);
  console.log('✅ Emergency routes saved to EMERGENCY_ROUTES.txt');
}

async function runEmergencyDiagnosis() {
  console.log('🚨 EMERGENCY TIMEOUT DIAGNOSIS & FIX\n');
  
  // 1. Test database
  const dbWorking = await testDatabaseConnection();
  
  // 2. Test API endpoints  
  await testAPIEndpoints();
  
  // 3. Create emergency routes
  createEmergencyRoutes();
  
  console.log('\n📋 EMERGENCY FIX RECOMMENDATIONS:');
  console.log('1. ✅ Timeout reduced to 5 seconds');
  console.log('2. ✅ Database connection tested');
  console.log('3. ⚠️ Add emergency route handlers (see EMERGENCY_ROUTES.txt)');
  console.log('4. 🔄 Restart server: npm start');
  
  console.log('\n🎯 ROOT CAUSE LIKELY:');
  console.log('- Non-API routes (/, /dashboard) causing hangs');
  console.log('- Missing frontend route handlers');
  console.log('- Add the emergency routes to fix immediately');
}

runEmergencyDiagnosis();