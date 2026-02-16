const express = require('express');
const router = express.Router();
const balanceController = require('../controllers/balance.controller');
const { authGuard } = require('../middleware/authGuard');
const asyncHandler = require('../middleware/asyncHandler');

/**
 * @route   GET /api/balance
 * @desc    Get current user balance
 * @access  Private
 */
router.get(
  '/',
  authGuard(),
  asyncHandler(balanceController.getBalance)
);

/**
 * @route   POST /api/balance/topup
 * @desc    Top up user balance (Admin only)
 * @access  Private (ADMIN)
 */
router.post(
  '/topup',
  authGuard(['ADMIN']),
  asyncHandler(balanceController.topUp)
);

/**
 * @route   POST /api/balance/withdraw/request
 * @desc    Request withdrawal
 * @access  Private (VETERINARIAN, PET_OWNER)
 */
router.post(
  '/withdraw/request',
  authGuard(['VETERINARIAN', 'PET_OWNER', 'PET_STORE', 'PARAPHARMACY']),
  asyncHandler(balanceController.requestWithdrawal)
);

/**
 * @route   POST /api/balance/withdraw/:requestId/approve
 * @desc    Approve withdrawal request (Admin only)
 * @access  Private (ADMIN)
 */
router.post(
  '/withdraw/:requestId/approve',
  authGuard(['ADMIN']),
  asyncHandler(balanceController.approveWithdrawal)
);

/**
 * @route   POST /api/balance/withdraw/:requestId/reject
 * @desc    Reject withdrawal request (Admin only)
 * @access  Private (ADMIN)
 */
router.post(
  '/withdraw/:requestId/reject',
  authGuard(['ADMIN']),
  asyncHandler(balanceController.rejectWithdrawal)
);

/**
 * @route   GET /api/balance/withdraw/requests
 * @desc    Get withdrawal requests
 * @access  Private
 */
router.get(
  '/withdraw/requests',
  authGuard(),
  asyncHandler(balanceController.getWithdrawalRequests)
);

module.exports = router;
