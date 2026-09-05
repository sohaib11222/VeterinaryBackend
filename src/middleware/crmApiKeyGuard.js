const crypto = require('crypto');
const config = require('../config/env');
const { sendError } = require('../utils/response');

const getProvidedKey = (req) => {
  const bearer = String(req.headers.authorization || '');
  if (bearer.startsWith('Bearer ')) {
    return bearer.slice('Bearer '.length).trim();
  }

  return String(req.headers['x-crm-api-key'] || '').trim();
};

const keysMatch = (expected, provided) => {
  const expectedBuffer = Buffer.from(String(expected || ''), 'utf8');
  const providedBuffer = Buffer.from(String(provided || ''), 'utf8');

  return expectedBuffer.length > 0
    && expectedBuffer.length === providedBuffer.length
    && crypto.timingSafeEqual(expectedBuffer, providedBuffer);
};

/**
 * Restricts the CRM leads feed to LeoX24's server-side project connector.
 * It deliberately does not accept ordinary user JWTs, because this endpoint
 * contains registrations across all MyPet Plus roles.
 */
const crmApiKeyGuard = (req, res, next) => {
  const expectedKey = config.CRM_API_KEY;
  if (!expectedKey) {
    return sendError(res, 'CRM integration is not configured', 503);
  }

  if (!keysMatch(expectedKey, getProvidedKey(req))) {
    return sendError(res, 'Not authorized for CRM integration', 401);
  }

  return next();
};

module.exports = { crmApiKeyGuard };
