const asyncHandler = require('../middleware/asyncHandler');
const balanceService = require('../services/balance.service');
const { sendSuccess } = require('../utils/response');

/**
 * Get user balance
 */
exports.getBalance = asyncHandler(async (req, res) => {
  const userId = req.userId;
  const result = await balanceService.getUserBalance(userId);
  return sendSuccess(res, 'OK', result);
});

/**
 * Top up user balance (Admin only)
 */
exports.topUp = asyncHandler(async (req, res) => {
  const { userId, amount } = req.body;
  const adminId = req.userId;
  const result = await balanceService.topUpBalance(userId, amount, adminId);
  return sendSuccess(res, 'Balance topped up successfully', result);
});

/**
 * Request withdrawal
 */
exports.requestWithdrawal = asyncHandler(async (req, res) => {
  const userId = req.userId;
  const { amount, paymentMethod, paymentDetails } = req.body;
  const result = await balanceService.requestWithdrawal(userId, amount, {
    paymentMethod,
    details: paymentDetails
  });
  return sendSuccess(res, 'Withdrawal request submitted successfully', result);
});

/**
 * Approve withdrawal request (Admin only)
 */
exports.approveWithdrawal = asyncHandler(async (req, res) => {
  const { requestId } = req.params;
  const { withdrawalFeePercent } = req.body; // Get fee percentage from request body
  const adminId = req.userId;
  
  // Validate fee percentage if provided
  if (withdrawalFeePercent !== undefined && withdrawalFeePercent !== null) {
    if (typeof withdrawalFeePercent !== 'number' || withdrawalFeePercent < 0 || withdrawalFeePercent > 100) {
      return res.status(400).json({
        success: false,
        message: 'Withdrawal fee percentage must be a number between 0 and 100',
        errors: [{ message: 'Invalid withdrawal fee percentage' }]
      });
    }
  }
  
  const result = await balanceService.approveWithdrawal(requestId, adminId, withdrawalFeePercent);
  return sendSuccess(res, 'Withdrawal request approved successfully', result);
});

/**
 * Reject withdrawal request (Admin only)
 */
exports.rejectWithdrawal = asyncHandler(async (req, res) => {
  const { requestId } = req.params;
  const { reason } = req.body;
  const adminId = req.userId;
  const result = await balanceService.rejectWithdrawal(requestId, adminId, reason);
  return sendSuccess(res, 'Withdrawal request rejected', result);
});

/**
 * Get withdrawal requests
 */
exports.getWithdrawalRequests = asyncHandler(async (req, res) => {
  const filter = { ...req.query };
  
  // If not admin, only show user's own requests
  if (req.userRole !== 'ADMIN') {
    filter.userId = req.userId;
  }
  
  const result = await balanceService.getWithdrawalRequests(filter);
  return sendSuccess(res, 'OK', result);
});
