const express = require('express');
const router = express.Router();
const subscriptionController = require('../controllers/subscription.controller');
const { authGuard } = require('../middleware/authGuard');
const asyncHandler = require('../middleware/asyncHandler');

/**
 * @route   GET /api/subscription/my-subscription
 * @desc    Get current subscription (veterinarian)
 * @access  Private (VETERINARIAN)
 */
router.get(
  '/my-subscription',
  authGuard(['VETERINARIAN']),
  asyncHandler(subscriptionController.getMySubscription)
);

/**
 * @route   POST /api/subscriptions/purchase
 * @desc    Purchase subscription plan (veterinarian)
 * @access  Private (VETERINARIAN)
 */
router.post(
  '/purchase',
  authGuard(['VETERINARIAN']),
  asyncHandler(subscriptionController.purchase)
);

/**
 * @route   GET /api/subscription/veterinarian/:veterinarianId
 * @desc    Get subscription by veterinarian ID
 * @access  Public
 */
router.get(
  '/veterinarian/:veterinarianId',
  asyncHandler(subscriptionController.getSubscriptionByVeterinarianId)
);

/**
 * @route   GET /api/subscription
 * @desc    List all subscriptions (admin)
 * @access  Private (ADMIN)
 */
router.get(
  '/',
  authGuard(['ADMIN']),
  asyncHandler(subscriptionController.listSubscriptions)
);

/**
 * @route   PUT /api/subscription/:id/cancel
 * @desc    Cancel subscription
 * @access  Private (VETERINARIAN, ADMIN)
 */
router.put(
  '/:id/cancel',
  authGuard(['VETERINARIAN', 'ADMIN']),
  asyncHandler(subscriptionController.cancelSubscription)
);

/**
 * @route   PUT /api/subscription/:id/activate
 * @desc    Activate subscription (admin)
 * @access  Private (ADMIN)
 */
router.put(
  '/:id/activate',
  authGuard(['ADMIN']),
  asyncHandler(subscriptionController.activateSubscription)
);

module.exports = router;
