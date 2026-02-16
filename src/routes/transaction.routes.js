const express = require('express');
const router = express.Router();
const transactionController = require('../controllers/transaction.controller');
const { authGuard } = require('../middleware/authGuard');
const asyncHandler = require('../middleware/asyncHandler');

/**
 * @route   POST /api/transaction
 * @desc    Create transaction
 * @access  Private
 */
router.post(
  '/',
  authGuard(),
  asyncHandler(transactionController.create)
);

/**
 * @route   PUT /api/transaction/:id
 * @desc    Update transaction status
 * @access  Private (ADMIN)
 */
router.put(
  '/:id',
  authGuard(['ADMIN']),
  asyncHandler(transactionController.updateStatus)
);

/**
 * @route   GET /api/transaction
 * @desc    List transactions with filtering
 * @access  Private
 */
router.get(
  '/',
  authGuard(),
  asyncHandler(transactionController.list)
);

/**
 * @route   GET /api/transaction/:id
 * @desc    Get transaction by ID
 * @access  Private
 */
router.get(
  '/:id',
  authGuard(),
  asyncHandler(transactionController.getById)
);

module.exports = router;
