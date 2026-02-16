const asyncHandler = require('../middleware/asyncHandler');
const orderService = require('../services/order.service');
const { sendSuccess } = require('../utils/response');

/**
 * Create order
 */
exports.create = asyncHandler(async (req, res) => {
  const { items, shippingAddress, paymentMethod } = req.body;
  const result = await orderService.createOrder(
    req.userId,
    items,
    shippingAddress,
    paymentMethod
  );
  return sendSuccess(res, 'Order created successfully', result, 201);
});

/**
 * Get order by ID
 */
exports.getById = asyncHandler(async (req, res) => {
  const result = await orderService.getOrderById(
    req.params.id,
    req.userId,
    req.userRole
  );
  return sendSuccess(res, 'OK', result);
});

/**
 * List orders (auto-filtered by role)
 */
exports.list = asyncHandler(async (req, res) => {
  let result;
  if (req.userRole === 'PET_OWNER') {
    result = await orderService.getPetOwnerOrders(req.userId, req.query);
  } else if (req.userRole === 'PET_STORE' || req.userRole === 'PARAPHARMACY') {
    result = await orderService.getPetStoreOrders(req.userId, req.query);
  } else if (req.userRole === 'ADMIN') {
    result = await orderService.getAllOrders(req.query);
  } else {
    throw new Error('Unauthorized');
  }
  return sendSuccess(res, 'OK', result);
});

/**
 * Update order status
 */
exports.updateStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const result = await orderService.updateOrderStatus(
    req.params.id,
    status,
    req.userId,
    req.userRole
  );
  return sendSuccess(res, 'Order status updated successfully', result);
});

/**
 * Update shipping fee
 */
exports.updateShippingFee = asyncHandler(async (req, res) => {
  const { shippingFee } = req.body;
  const result = await orderService.updateShippingFee(
    req.params.id,
    shippingFee,
    req.userId,
    req.userRole
  );
  return sendSuccess(res, 'Shipping fee updated successfully. Pet owner can now pay for the order.', result);
});

/**
 * Pay for order
 */
exports.payForOrder = asyncHandler(async (req, res) => {
  const { paymentMethod } = req.body;
  const result = await orderService.payForOrder(
    req.params.id,
    req.userId,
    req.userRole,
    paymentMethod || 'DUMMY'
  );
  return sendSuccess(res, 'Payment processed successfully', result);
});

/**
 * Cancel order
 */
exports.cancel = asyncHandler(async (req, res) => {
  const result = await orderService.cancelOrder(
    req.params.id,
    req.userId,
    req.userRole
  );
  return sendSuccess(res, 'Order cancelled successfully', result);
});
