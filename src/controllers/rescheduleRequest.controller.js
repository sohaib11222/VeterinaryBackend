const asyncHandler = require('../middleware/asyncHandler');
const rescheduleRequestService = require('../services/rescheduleRequest.service');
const { sendSuccess } = require('../utils/response');

/**
 * Get appointments eligible for reschedule (pet owner)
 */
exports.getEligibleAppointments = asyncHandler(async (req, res) => {
  const result = await rescheduleRequestService.getEligibleAppointmentsForReschedule(req.userId);
  return sendSuccess(res, 'OK', result);
});

/**
 * Create reschedule request (pet owner)
 */
exports.create = asyncHandler(async (req, res) => {
  const data = {
    ...req.body,
    petOwnerId: req.userId
  };
  const result = await rescheduleRequestService.createRescheduleRequest(data);
  return sendSuccess(res, 'Reschedule request created successfully', result, 201);
});

/**
 * List reschedule requests (filtered by role)
 */
exports.list = asyncHandler(async (req, res) => {
  const result = await rescheduleRequestService.listRescheduleRequests(
    req.userId,
    req.userRole,
    req.query
  );
  return sendSuccess(res, 'OK', result);
});

/**
 * Get reschedule request by ID
 */
exports.getById = asyncHandler(async (req, res) => {
  const result = await rescheduleRequestService.getRescheduleRequestById(
    req.params.id,
    req.userId,
    req.userRole
  );
  return sendSuccess(res, 'OK', result);
});

/**
 * Approve reschedule request (veterinarian)
 */
exports.approve = asyncHandler(async (req, res) => {
  const result = await rescheduleRequestService.approveRescheduleRequest(
    req.params.id,
    req.userId,
    req.body
  );
  return sendSuccess(res, 'Reschedule request approved successfully', result);
});

/**
 * Reject reschedule request (veterinarian)
 */
exports.reject = asyncHandler(async (req, res) => {
  const reason = req.body?.reason || req.body?.rejectionReason;
  const result = await rescheduleRequestService.rejectRescheduleRequest(
    req.params.id,
    req.userId,
    reason
  );
  return sendSuccess(res, 'Reschedule request rejected', result);
});

/**
 * Pay reschedule fee (pet owner)
 */
exports.pay = asyncHandler(async (req, res) => {
  const { paymentMethod } = req.body;
  const result = await rescheduleRequestService.processReschedulePayment(
    req.params.id,
    req.userId,
    paymentMethod || 'STRIPE'
  );
  return sendSuccess(res, 'Reschedule fee paid successfully', result);
});
