const asyncHandler = require('../middleware/asyncHandler');
const crmService = require('../services/crm.service');
const { sendSuccess } = require('../utils/response');
const subscriptionPolicy = require('../services/subscriptionPolicy.service');

/**
 * Get comprehensive CRM data for external CRM system
 */
exports.getCrmData = asyncHandler(async (req, res) => {
  const role = String(req.userRole || '').toUpperCase();
  const filters = { ...(req.query || {}) };

  if (role === 'VETERINARIAN') {
    await subscriptionPolicy.enforceCrmAccess({ veterinarianId: req.userId });
    filters.veterinarianId = req.userId;
  }

  const result = await crmService.getCrmData(filters);
  return sendSuccess(res, 'OK', result);
});
