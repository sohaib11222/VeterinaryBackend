const express = require('express');
const router = express.Router();
const subscriptionPlanController = require('../controllers/subscriptionPlan.controller');
const { authGuard, requireRole } = require('../middleware/authGuard');
const asyncHandler = require('../middleware/asyncHandler');

// Public routes
router.get('/active', asyncHandler(subscriptionPlanController.getActivePlans));
router.get('/', asyncHandler(subscriptionPlanController.list));
router.get('/:id', asyncHandler(subscriptionPlanController.getById));

// Admin routes
router.use(authGuard());
router.use(requireRole('ADMIN'));

/**
 * Create subscription plan
 */
router.post('/', asyncHandler(subscriptionPlanController.create));

/**
 * Update subscription plan
 */
router.put('/:id', asyncHandler(subscriptionPlanController.update));

/**
 * Delete subscription plan
 */
router.delete('/:id', asyncHandler(subscriptionPlanController.delete));

module.exports = router;
