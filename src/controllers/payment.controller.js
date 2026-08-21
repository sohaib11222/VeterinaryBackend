const asyncHandler = require('../middleware/asyncHandler');
const paymentService = require('../services/payment.service');
const { sendSuccess } = require('../utils/response');

/**
 * Process appointment payment
 */
exports.processAppointmentPayment = asyncHandler(async (req, res) => {
  const { appointmentId, amount, paymentMethod } = req.body;
  const requestedPaymentMethod = String(paymentMethod || 'STRIPE').trim().toUpperCase();
  if (requestedPaymentMethod !== 'STRIPE') {
    const error = new Error('Only Stripe payments are supported for appointments');
    error.statusCode = 400;
    throw error;
  }
  const result = await paymentService.processAppointmentPayment(
    req.userId,
    appointmentId,
    amount,
    'STRIPE'
  );
  return sendSuccess(res, 'Payment processed successfully', result);
});

/**
 * Process subscription payment
 */
exports.processSubscriptionPayment = asyncHandler(async (req, res) => {
  const { subscriptionPlanId, amount, paymentMethod } = req.body;
  const result = await paymentService.processSubscriptionPayment(
    req.userId,
    subscriptionPlanId,
    amount,
    paymentMethod || 'DUMMY'
  );
  return sendSuccess(res, 'Subscription payment processed successfully', result);
});

/**
 * Process product payment (single product - legacy)
 */
exports.processProductPayment = asyncHandler(async (req, res) => {
  const { productId, amount, paymentMethod } = req.body;
  const result = await paymentService.processProductPayment(
    req.userId,
    productId,
    amount,
    paymentMethod || 'DUMMY'
  );
  return sendSuccess(res, 'Product payment processed successfully', result);
});

/**
 * Process order payment
 */
exports.processOrderPayment = asyncHandler(async (req, res) => {
  const { orderId, paymentMethod, amount } = req.body;
  const result = await paymentService.processOrderPayment(orderId, paymentMethod || 'DUMMY', amount);
  return sendSuccess(res, 'Order payment processed successfully', result);
});

/**
 * Get user transactions
 */
exports.getUserTransactions = asyncHandler(async (req, res) => {
  const result = await paymentService.getUserTransactions(req.userId, req.query);
  return sendSuccess(res, 'OK', result);
});

/**
 * Get transaction by ID
 */
exports.getTransactionById = asyncHandler(async (req, res) => {
  const result = await paymentService.getTransactionById(req.params.id, req.userId, req.userRole);
  return sendSuccess(res, 'OK', result);
});

/**
 * Refund transaction (admin only)
 */
exports.refundTransaction = asyncHandler(async (req, res) => {
  const result = await paymentService.refundTransaction(req.params.id);
  return sendSuccess(res, 'Transaction refunded successfully', result);
});
