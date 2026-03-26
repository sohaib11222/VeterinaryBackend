const { StreamChat } = require('stream-chat');
const config = require('../config/env');

// Validate Stream credentials
if (!config.STREAM_API_KEY || !config.STREAM_API_SECRET) {
  console.warn('⚠️ Stream API credentials are missing!');
  console.warn('Please set STREAM_API_KEY and STREAM_API_SECRET in your .env file');
}

let streamClient;
if (config.STREAM_API_KEY && config.STREAM_API_SECRET) {
  try {
    streamClient = StreamChat.getInstance(
      config.STREAM_API_KEY,
      config.STREAM_API_SECRET
    );
    console.log('✅ Stream client initialized successfully');
    console.log(`✅ Stream API key in use: ${config.STREAM_API_KEY}`);
  } catch (error) {
    console.error('❌ Failed to initialize Stream client:', error);
  }
}

/**
 * Generate user token for Stream Video
 */
const generateUserToken = (userId, userName) => {
  if (!streamClient) {
    throw new Error('Stream API credentials are not configured');
  }
  
  try {
    const token = streamClient.createToken(userId);
    return token;
  } catch (error) {
    throw new Error(
      `Failed to generate Stream token (apiKey=${config.STREAM_API_KEY || 'missing'}): ${error.message}`
    );
  }
};

/**
 * Create a Stream call (frontend creates calls)
 */
const createCall = async (callId, metadata = {}) => {
  // Frontend creates calls - we just return null
  return null;
};

/**
 * End Stream call
 */
const endCall = async (callId) => {
  // Frontend handles call ending
};

module.exports = {
  generateUserToken,
  createCall,
  endCall
};
