const express = require('express');
const router = express.Router();
const orderController = require('../controllers/order.controller');
const { authGuard } = require('../middleware/authGuard');
const asyncHandler = require('../middleware/asyncHandler');

router.use(authGuard());

/**
 * Create order
 */
router.post('/', asyncHandler(orderController.create));

/**
 * List orders (auto-filtered by role)
 */
router.get('/', asyncHandler(orderController.list));

/**
 * Delivery performance report (must be before /:id)
 */
router.get('/delivery-performance', asyncHandler(orderController.deliveryPerformance));

/**
 * Get order by ID
 */
router.get('/:id', asyncHandler(orderController.getById));

/**
 * Update order status
 */
router.put('/:id/status', asyncHandler(orderController.updateStatus));

/**
 * Update shipping fee
 */
router.put('/:id/shipping', asyncHandler(orderController.updateShippingFee));

/**
 * Pay for order
 */
router.post('/:id/pay', asyncHandler(orderController.payForOrder));

/**
 * Cancel order
 */
router.post('/:id/cancel', asyncHandler(orderController.cancel));

module.exports = router;
