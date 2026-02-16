const mongoose = require('mongoose');
const config = require('./env');

const connectDatabase = async () => {
  try {
    // Register global query timeout plugin
    const queryTimeoutPlugin = require('../plugins/queryTimeout');
    mongoose.plugin(queryTimeoutPlugin);
    
    // Optimize connection settings for better performance
    const conn = await mongoose.connect(config.MONGO_URI, {
      serverSelectionTimeoutMS: 10000, // Increased to 10s for slow connections
      socketTimeoutMS: 45000, // Close sockets after 45s of inactivity
      maxPoolSize: 10, // Maintain up to 10 socket connections
      minPoolSize: 2, // Maintain at least 2 socket connections
      connectTimeoutMS: 10000, // Connection timeout
      heartbeatFrequencyMS: 10000, // Heartbeat frequency
      retryWrites: true, // Retry writes on network errors
      retryReads: true, // Retry reads on network errors
    });
    
    // Set global query timeout
    mongoose.set('maxTimeMS', 10000); // 10 seconds default for all queries
    
    console.log(`✓ MongoDB Connected: ${conn.connection.host}`);
    console.log(`✓ Global query timeout (10s) enabled for all models`);
    console.log(`✓ Connection pool: ${conn.connection.maxPoolSize} max connections`);
    return conn;
  } catch (error) {
    console.error('✗ MongoDB connection error:', error.message);
    console.error('   Check: 1) MongoDB is running, 2) MONGO_URI is correct, 3) Network connectivity');
    process.exit(1);
  }
};

module.exports = connectDatabase;
