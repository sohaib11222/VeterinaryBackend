const jwt = require('jsonwebtoken');
const config = require('../config/env');

/**
 * Generate JWT token
 */
const generateToken = (payload) => {
  return jwt.sign(payload, config.JWT_SECRET, {
    expiresIn: config.JWT_EXPIRES_IN
  });
};

/**
 * Generate refresh token
 */
const generateRefreshToken = (payload) => {
  return jwt.sign(payload, config.REFRESH_TOKEN_SECRET, {
    expiresIn: config.REFRESH_TOKEN_EXPIRES_IN
  });
};

/**
 * Verify JWT token
 */
const verifyToken = (token) => {
  return jwt.verify(token, config.JWT_SECRET);
};

/**
 * Verify refresh token
 */
const verifyRefreshToken = (token) => {
  return jwt.verify(token, config.REFRESH_TOKEN_SECRET);
};

module.exports = {
  generateToken,
  generateRefreshToken,
  verifyToken,
  verifyRefreshToken
};
