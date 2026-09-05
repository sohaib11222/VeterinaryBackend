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

/**
 * Registration-only feed for LeoX24's MyPet Plus Leads module.
 * This intentionally excludes passwords, document URLs, medical records,
 * appointments, orders, and other private clinical information.
 */
exports.getCrmLeads = asyncHandler(async (req, res) => {
  const result = await crmService.getCrmLeads(req.query || {});
  return sendSuccess(res, 'OK', result);
});
