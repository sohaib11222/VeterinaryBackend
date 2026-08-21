const mongoose = require('mongoose');
const config = require('./env');

const connectDatabase = async () => {
  const queryTimeoutPlugin = require('../plugins/queryTimeout');
  mongoose.plugin(queryTimeoutPlugin);

  const options = {
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
    maxPoolSize: 10,
    minPoolSize: 2,
    connectTimeoutMS: 5000,
    heartbeatFrequencyMS: 10000,
    retryWrites: true,
    retryReads: true,
  };

  try {
    const conn = await mongoose.connect(config.MONGO_URI, options);
    mongoose.set('maxTimeMS', 10000);
    console.log(`✓ MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (primaryError) {
    console.warn(`⚠️ Primary MongoDB connection failed: ${primaryError.message}. Attempting local MongoDB...`);
    try {
      const localUri = 'mongodb://127.0.0.1:27017/veterinary_db';
      const conn = await mongoose.connect(localUri, options);
      mongoose.set('maxTimeMS', 10000);
      console.log(`✓ Local MongoDB Connected: ${conn.connection.host}`);
      return conn;
    } catch (localError) {
      console.error('✗ Both primary and local MongoDB connections failed:', localError.message);
      process.exit(1);
    }
  }
};

module.exports = connectDatabase;
