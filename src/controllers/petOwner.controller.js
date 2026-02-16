const asyncHandler = require('../middleware/asyncHandler');
const petOwnerService = require('../services/petOwner.service');
const { sendSuccess } = require('../utils/response');

/**
 * Get pet owner dashboard
 */
exports.getDashboard = asyncHandler(async (req, res) => {
  const result = await petOwnerService.getPetOwnerDashboard(req.userId);
  return sendSuccess(res, 'OK', result);
});

/**
 * Get appointment history
 */
exports.getAppointmentHistory = asyncHandler(async (req, res) => {
  const result = await petOwnerService.getAppointmentHistory(req.userId, req.query);
  return sendSuccess(res, 'OK', result);
});

/**
 * Get payment history
 */
exports.getPaymentHistory = asyncHandler(async (req, res) => {
  const result = await petOwnerService.getPaymentHistory(req.userId, req.query);
  return sendSuccess(res, 'OK', result);
});
