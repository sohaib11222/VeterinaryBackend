const asyncHandler = require('../middleware/asyncHandler');
const subscriptionPlanService = require('../services/subscriptionPlan.service');
const { sendSuccess } = require('../utils/response');

/**
 * Create subscription plan
 */
exports.create = asyncHandler(async (req, res) => {
  const result = await subscriptionPlanService.createPlan(req.body);
  return sendSuccess(res, 'Subscription plan created successfully', result, 201);
});

/**
 * Get all subscription plans
 */
exports.list = asyncHandler(async (req, res) => {
  const result = await subscriptionPlanService.getAllPlans(req.query);
  return sendSuccess(res, 'OK', result);
});

/**
 * Get active subscription plans (public)
 */
exports.getActivePlans = asyncHandler(async (req, res) => {
  const planType = req.query?.planType;
  const result = planType
    ? await subscriptionPlanService.getActivePlansByType(planType)
    : await subscriptionPlanService.getActivePlans();
  return sendSuccess(res, 'OK', result);
});

/**
 * Get subscription plan by ID
 */
exports.getById = asyncHandler(async (req, res) => {
  const result = await subscriptionPlanService.getPlanById(req.params.id);
  return sendSuccess(res, 'OK', result);
});

/**
 * Update subscription plan
 */
exports.update = asyncHandler(async (req, res) => {
  const result = await subscriptionPlanService.updatePlan(req.params.id, req.body);
  return sendSuccess(res, 'Subscription plan updated successfully', result);
});

/**
 * Delete subscription plan
 */
exports.delete = asyncHandler(async (req, res) => {
  await subscriptionPlanService.deletePlan(req.params.id);
  return sendSuccess(res, 'Subscription plan deleted successfully');
});
