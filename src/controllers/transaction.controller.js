const asyncHandler = require('../middleware/asyncHandler');
const transactionService = require('../services/transaction.service');
const { sendSuccess } = require('../utils/response');

/**
 * Create transaction
 */
exports.create = asyncHandler(async (req, res) => {
  const transactionData = {
    ...req.body,
    userId: req.body.userId || req.userId
  };
  const result = await transactionService.createTransaction(transactionData);
  return sendSuccess(res, 'Transaction created successfully', result, 201);
});

/**
 * Update transaction status
 */
exports.updateStatus = asyncHandler(async (req, res) => {
  const result = await transactionService.updateTransactionStatus(req.params.id, req.body.status);
  return sendSuccess(res, 'Transaction status updated successfully', result);
});

/**
 * Get transaction by ID
 */
exports.getById = asyncHandler(async (req, res) => {
  const result = await transactionService.getTransaction(req.params.id);
  return sendSuccess(res, 'OK', result);
});

/**
 * List transactions with filtering
 */
exports.list = asyncHandler(async (req, res) => {
  const filter = { ...req.query };
  
  // If not admin, only show user's own transactions
  if (req.userRole !== 'ADMIN') {
    filter.userId = req.userId;
  }
  
  const result = await transactionService.listTransactions(filter);
  return sendSuccess(res, 'OK', result);
});
