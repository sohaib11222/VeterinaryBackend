const asyncHandler = require('../middleware/asyncHandler');
const veterinarianService = require('../services/veterinarian.service');
const { sendSuccess } = require('../utils/response');

/**
 * Upsert veterinarian profile
 */
exports.upsertProfile = asyncHandler(async (req, res) => {
  const result = await veterinarianService.upsertVeterinarianProfile(req.userId, req.body);
  return sendSuccess(res, 'Profile updated successfully', result);
});

/**
 * Get veterinarian profile (uses token for authenticated veterinarians)
 */
exports.getProfile = asyncHandler(async (req, res) => {
  const result = await veterinarianService.getVeterinarianProfile(req.userId);
  return sendSuccess(res, 'OK', result);
});

/**
 * Get veterinarian profile by user ID (public access)
 */
exports.getProfileById = asyncHandler(async (req, res) => {
  const result = await veterinarianService.getVeterinarianProfile(req.params.id);
  return sendSuccess(res, 'OK', result);
});

/**
 * List veterinarians with filtering
 */
exports.listVeterinarians = asyncHandler(async (req, res) => {
  const result = await veterinarianService.listVeterinarians(req.query);
  return sendSuccess(res, 'OK', result);
});

/**
 * Get veterinarian dashboard
 */
exports.getDashboard = asyncHandler(async (req, res) => {
  const result = await veterinarianService.getVeterinarianDashboard(req.userId);
  return sendSuccess(res, 'OK', result);
});

/**
 * Get veterinarian's reviews
 */
exports.getReviews = asyncHandler(async (req, res) => {
  const result = await veterinarianService.getVeterinarianReviews(req.userId, req.query);
  return sendSuccess(res, 'OK', result);
});

/**
 * Buy subscription plan
 */
exports.buySubscriptionPlan = asyncHandler(async (req, res) => {
  const result = await veterinarianService.buySubscriptionPlan(req.userId, req.body.planId);
  return sendSuccess(res, 'Subscription plan purchased successfully', result);
});

/**
 * Get current subscription
 */
exports.getMySubscription = asyncHandler(async (req, res) => {
  const result = await veterinarianService.getMySubscription(req.userId);
  return sendSuccess(res, 'OK', result);
});

exports.getInvoices = asyncHandler(async (req, res) => {
  const result = await veterinarianService.getVeterinarianInvoices(req.userId, req.query);
  return sendSuccess(res, 'OK', result);
});

exports.getInvoiceByTransactionId = asyncHandler(async (req, res) => {
  const result = await veterinarianService.getVeterinarianInvoiceByTransactionId(req.userId, req.params.transactionId);
  return sendSuccess(res, 'OK', result);
});
