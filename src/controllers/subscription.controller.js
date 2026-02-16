const asyncHandler = require('../middleware/asyncHandler');
const subscriptionService = require('../services/subscription.service');
const { sendSuccess } = require('../utils/response');

/**
 * Get current subscription (for authenticated veterinarian)
 */
exports.getMySubscription = asyncHandler(async (req, res) => {
  const result = await subscriptionService.getMySubscription(req.userId);
  return sendSuccess(res, 'OK', result);
});

/**
 * Purchase subscription plan (for authenticated veterinarian)
 */
exports.purchase = asyncHandler(async (req, res) => {
  const result = await subscriptionService.purchaseSubscription(req.userId, req.body?.planId);
  return sendSuccess(res, 'Subscription plan purchased successfully', result);
});

/**
 * Get subscription by veterinarian ID (admin or public)
 */
exports.getSubscriptionByVeterinarianId = asyncHandler(async (req, res) => {
  const result = await subscriptionService.getSubscriptionByVeterinarianId(req.params.veterinarianId);
  return sendSuccess(res, 'OK', result);
});

/**
 * List all subscriptions (admin only)
 */
exports.listSubscriptions = asyncHandler(async (req, res) => {
  const result = await subscriptionService.listSubscriptions(req.query);
  return sendSuccess(res, 'OK', result);
});

/**
 * Cancel subscription (veterinarian or admin)
 */
exports.cancelSubscription = asyncHandler(async (req, res) => {
  const subscriptionId = req.params.id;
  const result = await subscriptionService.cancelSubscription(subscriptionId, req.userId, req.userRole);
  return sendSuccess(res, 'Subscription cancelled successfully', result);
});

/**
 * Activate subscription (admin only)
 */
exports.activateSubscription = asyncHandler(async (req, res) => {
  const result = await subscriptionService.activateSubscription(req.params.id);
  return sendSuccess(res, 'Subscription activated successfully', result);
});
