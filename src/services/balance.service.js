const User = require('../models/User');
const WithdrawalRequest = require('../models/WithdrawalRequest');
const Transaction = require('../models/Transaction');
const { validateObjectId } = require('../utils/validation');
const config = require('../config/env');

/**
 * Calculate net amount after platform fee
 * @param {number} amount - Gross amount
 * @param {number} platformFeePercent - Platform fee percentage (0-100)
 * @returns {Object} { netAmount, platformFee }
 */
const calculateNetAmount = (amount, platformFeePercent = 0) => {
  const platformFee = (amount * platformFeePercent) / 100;
  const netAmount = amount - platformFee;
  return { netAmount, platformFee };
};

// Monetary values are persisted as numbers in the existing schema. Round each
// withdrawal calculation to cents so the request, wallet balance, and audit
// record always agree.
const roundCurrency = (amount) => Math.round((Number(amount) + Number.EPSILON) * 100) / 100;
const STRIPE_PAYOUT_METHOD = 'STRIPE';
const isStorePayoutRole = (role) => ['PET_STORE', 'PARAPHARMACY'].includes(String(role || '').toUpperCase());
const normalizeStripeAccountId = (value) => String(value || '').trim();
const isStripeConnectedAccountId = (value) => /^acct_[A-Za-z0-9]+$/.test(value);

const createStripeTransfer = async ({ amount, destination, requestId }) => {
  if (!config.STRIPE_SECRET_KEY) {
    throw new Error('Stripe payouts are not configured. Add STRIPE_SECRET_KEY to the backend environment before approving this request.');
  }
  if (typeof fetch !== 'function') {
    throw new Error('This server runtime does not support Stripe payouts. Upgrade Node.js to version 18 or newer.');
  }

  const cents = Math.round(Number(amount) * 100);
  if (!Number.isSafeInteger(cents) || cents <= 0) {
    throw new Error('The Stripe payout amount must be greater than zero.');
  }

  const form = new URLSearchParams({
    amount: String(cents),
    currency: 'eur',
    destination,
    'metadata[withdrawalRequestId]': String(requestId),
  });
  const response = await fetch('https://api.stripe.com/v1/transfers', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      // Retrying after a network/database interruption cannot create a second
      // transfer for this withdrawal request.
      'Idempotency-Key': `withdrawal-${requestId}`,
    },
    body: form.toString(),
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch (_) {
    // Stripe can only return JSON, but keep the error user-safe if a proxy
    // returns another response format.
  }
  if (!response.ok) {
    throw new Error(payload?.error?.message || 'Stripe could not create the payout transfer.');
  }
  if (!payload?.id) {
    throw new Error('Stripe did not return a transfer ID.');
  }
  return payload;
};

/**
 * Credit balance to user (internal helper)
 * @param {string} userId - User ID
 * @param {number} amount - Amount to credit
 * @param {string} transactionType - Type of transaction (APPOINTMENT, ORDER, etc.)
 * @param {Object} metadata - Additional metadata
 * @returns {Promise<Object>} Updated balance info
 */
const creditBalance = async (userId, amount, transactionType, metadata = {}) => {
  validateObjectId(userId, 'User ID');
  
  if (amount <= 0) {
    throw new Error('Amount must be greater than 0');
  }

  const user = await User.findById(userId);
  
  if (!user) {
    throw new Error('User not found');
  }

  // Get platform fee percentage from env (default 0%)
  const platformFeePercent = parseFloat(process.env.PLATFORM_FEE_PERCENT || '0');
  const { netAmount, platformFee } = calculateNetAmount(amount, platformFeePercent);

  // Update balance
  user.balance = (user.balance || 0) + netAmount;
  await user.save();

  // Create transaction record for the credit
  await Transaction.create({
    userId,
    amount: netAmount,
    currency: 'EUR',
    status: 'SUCCESS',
    provider: 'BALANCE_CREDIT',
    providerReference: `${transactionType}-${Date.now()}-${userId}`,
    metadata: {
      type: 'BALANCE_CREDIT',
      transactionType,
      grossAmount: amount,
      platformFee,
      platformFeePercent,
      netAmount,
      ...metadata
    }
  });

  return {
    userId: user._id,
    balance: user.balance,
    creditedAmount: netAmount,
    platformFee,
    grossAmount: amount
  };
};

/**
 * Debit balance from user (for refunds)
 * @param {string} userId - User ID
 * @param {number} amount - Amount to debit
 * @param {string} transactionType - Type of transaction (REFUND, etc.)
 * @param {Object} metadata - Additional metadata
 * @returns {Promise<Object>} Updated balance info
 */
const debitBalance = async (userId, amount, transactionType, metadata = {}) => {
  validateObjectId(userId, 'User ID');
  
  if (amount <= 0) {
    throw new Error('Amount must be greater than 0');
  }

  const user = await User.findById(userId);
  
  if (!user) {
    throw new Error('User not found');
  }

  // Check if user has sufficient balance
  const currentBalance = user.balance || 0;
  if (currentBalance < amount) {
    // Allow negative balance for refunds (veterinarian owes the platform)
    // But log a warning
    console.warn(`Warning: Debiting ${amount} from user ${userId} with balance ${currentBalance} (will result in negative balance)`);
  }

  // Update balance
  user.balance = currentBalance - amount;
  await user.save();

  // Create transaction record for the debit
  await Transaction.create({
    userId,
    amount: -amount, // Negative for debit
    currency: 'EUR',
    status: 'SUCCESS',
    provider: 'BALANCE_DEBIT',
    providerReference: `${transactionType}-${Date.now()}-${userId}`,
    metadata: {
      type: 'BALANCE_DEBIT',
      transactionType,
      amount,
      ...metadata
    }
  });

  return {
    userId: user._id,
    balance: user.balance,
    debitedAmount: amount
  };
};

/**
 * Get user balance
 * @param {string} userId - User ID
 * @returns {Promise<Object>} User balance info
 */
const getUserBalance = async (userId) => {
  validateObjectId(userId, 'User ID');
  
  const user = await User.findById(userId).select('balance name email fullName');
  
  if (!user) {
    throw new Error('User not found');
  }

  return {
    userId: user._id,
    balance: user.balance || 0,
    user: {
      name: user.name || user.fullName,
      email: user.email
    }
  };
};

/**
 * Top up user balance (Admin only)
 * @param {string} userId - User ID
 * @param {number} amount - Amount to add
 * @param {string} adminId - Admin ID who is topping up
 * @returns {Promise<Object>} Updated balance
 */
const topUpBalance = async (userId, amount, adminId) => {
  if (amount <= 0) {
    throw new Error('Amount must be greater than 0');
  }

  const user = await User.findById(userId);
  
  if (!user) {
    throw new Error('User not found');
  }

  // Update balance
  user.balance = (user.balance || 0) + amount;
  await user.save();

  // Create transaction record
  await Transaction.create({
    userId,
    amount,
    currency: 'EUR',
    status: 'SUCCESS',
    provider: 'ADMIN_TOPUP',
    providerReference: `TOPUP-${Date.now()}-${userId}`,
    metadata: {
      type: 'TOPUP',
      adminId,
      timestamp: new Date()
    }
  });

  return {
    userId: user._id,
    balance: user.balance,
    topUpAmount: amount
  };
};

/**
 * Request withdrawal (Veterinarian/Pet Owner)
 * @param {string} userId - User ID
 * @param {number} amount - Amount to withdraw
 * @param {Object} paymentDetails - Payment method and details
 * @returns {Promise<Object>} Withdrawal request
 */
const requestWithdrawal = async (userId, amount, paymentDetails = {}) => {
  validateObjectId(userId, 'User ID');
  const withdrawalAmount = Number(amount);
  if (!Number.isFinite(withdrawalAmount) || withdrawalAmount <= 0) {
    throw new Error('Amount must be greater than 0');
  }

  const user = await User.findById(userId);
  
  if (!user) {
    throw new Error('User not found');
  }

  // Check if user has sufficient balance
  if ((user.balance || 0) < withdrawalAmount) {
    throw new Error('Insufficient balance');
  }

  const requestedMethod = String(paymentDetails.paymentMethod || '').trim().toUpperCase();
  const stripeAccountId = normalizeStripeAccountId(paymentDetails.stripeAccountId || paymentDetails.details);
  if (isStorePayoutRole(user.role) && requestedMethod !== STRIPE_PAYOUT_METHOD) {
    throw new Error('Pharmacy and Parapharmacy payouts must use Stripe.');
  }
  if (isStorePayoutRole(user.role) && !isStripeConnectedAccountId(stripeAccountId)) {
    throw new Error('Enter a valid Stripe Connected Account ID (for example, acct_...).');
  }

  // A failed Stripe transfer can be retried by the administrator. Do not let
  // the store create a second withdrawal for the same available balance.
  const pendingRequest = await WithdrawalRequest.findOne({
    userId,
    status: { $in: ['PENDING', 'PROCESSING', 'FAILED'] }
  });

  if (pendingRequest) {
    throw new Error('You already have a pending withdrawal request');
  }

  // Create withdrawal request
  const withdrawalRequest = await WithdrawalRequest.create({
    userId,
    amount: withdrawalAmount,
    status: 'PENDING',
    paymentMethod: isStorePayoutRole(user.role)
      ? STRIPE_PAYOUT_METHOD
      : requestedMethod || null,
    paymentDetails: paymentDetails.details || null,
    stripeAccountId: isStorePayoutRole(user.role) ? stripeAccountId : null,
  });

  return withdrawalRequest;
};

/**
 * Approve withdrawal request (Admin only)
 * @param {string} requestId - Withdrawal request ID
 * @param {string} adminId - Admin ID
 * @param {number} withdrawalFeePercent - Withdrawal fee percentage (0-100)
 * @returns {Promise<Object>} Approved request
 */
const approveWithdrawal = async (requestId, adminId, withdrawalFeePercent = null) => {
  validateObjectId(requestId, 'Withdrawal request ID');
  if (withdrawalFeePercent !== null) {
    if (!Number.isFinite(Number(withdrawalFeePercent)) || withdrawalFeePercent < 0 || withdrawalFeePercent > 100) {
      throw new Error('Withdrawal fee percentage must be between 0 and 100');
    }
  }

  const request = await WithdrawalRequest.findOneAndUpdate(
    { _id: requestId, status: { $in: ['PENDING', 'FAILED'] } },
    { $set: { status: 'PROCESSING', stripePayoutFailure: null } },
    { new: true },
  )
    .populate('userId', 'balance name email fullName role');
  
  if (!request) {
    throw new Error('Withdrawal request not found');
  }

  const user = request.userId;
  if (!user) {
    request.status = 'FAILED';
    request.stripePayoutFailure = 'The withdrawal user no longer exists.';
    await request.save();
    throw new Error(request.stripePayoutFailure);
  }
  const withdrawalAmount = roundCurrency(request.amount);

  // A withdrawal fee is withheld from the requested payout. It must never be
  // charged a second time to the veterinarian's wallet.
  const feePercent = withdrawalFeePercent !== null ? Number(withdrawalFeePercent) : 0;
  const withdrawalFeeAmount = roundCurrency((withdrawalAmount * feePercent) / 100);
  const totalDeducted = withdrawalAmount;
  const netAmount = roundCurrency(withdrawalAmount - withdrawalFeeAmount);

  // The wallet only needs to cover the original requested amount.
  if ((user.balance || 0) < totalDeducted) {
    request.status = 'REJECTED';
    request.rejectionReason = `Insufficient balance. Required: ${totalDeducted.toFixed(2)}, Available: ${(user.balance || 0).toFixed(2)}`;
    await request.save();
    throw new Error(`Insufficient balance. Required: $${totalDeducted.toFixed(2)}, Available: $${(user.balance || 0).toFixed(2)}`);
  }

  const usesStripePayout = isStorePayoutRole(user.role);
  if (usesStripePayout && (!isStripeConnectedAccountId(request.stripeAccountId) || request.paymentMethod !== STRIPE_PAYOUT_METHOD)) {
    request.status = 'FAILED';
    request.stripePayoutFailure = 'This store payout is missing a valid Stripe Connected Account ID.';
    await request.save();
    throw new Error(request.stripePayoutFailure);
  }

  let stripeTransfer = null;
  if (usesStripePayout) {
    try {
      stripeTransfer = await createStripeTransfer({
        amount: netAmount,
        destination: request.stripeAccountId,
        requestId: request._id,
      });
    } catch (error) {
      request.status = 'FAILED';
      request.stripePayoutFailure = error?.message || 'Stripe payout failed.';
      await request.save();
      throw error;
    }
  }

  // Debit the requested amount once. The payout provider receives netAmount.
  user.balance = roundCurrency((user.balance || 0) - totalDeducted);
  await user.save();

  // Update request with fee information
  request.status = usesStripePayout ? 'COMPLETED' : 'APPROVED';
  request.approvedAt = new Date();
  request.approvedBy = adminId;
  request.withdrawalFeePercent = feePercent;
  request.withdrawalFeeAmount = withdrawalFeeAmount;
  request.totalDeducted = totalDeducted;
  request.netAmount = netAmount;
  request.stripeTransferId = stripeTransfer?.id || null;
  request.payoutProcessedAt = usesStripePayout ? new Date() : null;
  await request.save();

  // Create transaction record for the withdrawal
  await Transaction.create({
    userId: user._id,
    amount: -totalDeducted,
    currency: 'EUR',
    status: 'SUCCESS',
    provider: usesStripePayout ? 'STRIPE_TRANSFER' : 'WITHDRAWAL',
    providerReference: stripeTransfer?.id || `WITHDRAW-${Date.now()}-${user._id}`,
    metadata: {
      type: 'WITHDRAWAL',
      requestId: request._id,
      adminId,
      withdrawalAmount: withdrawalAmount,
      withdrawalFeePercent: feePercent,
      withdrawalFeeAmount: withdrawalFeeAmount,
      totalDeducted: totalDeducted,
      netAmount: netAmount,
      feeDeductedFromPayout: true,
      paymentMethod: request.paymentMethod,
      stripeAccountId: request.stripeAccountId || undefined,
      stripeTransferId: stripeTransfer?.id || undefined,
      timestamp: new Date()
    }
  });

  return request;
};

/**
 * Reject withdrawal request (Admin only)
 * @param {string} requestId - Withdrawal request ID
 * @param {string} adminId - Admin ID
 * @param {string} reason - Rejection reason
 * @returns {Promise<Object>} Rejected request
 */
const rejectWithdrawal = async (requestId, adminId, reason = null) => {
  const request = await WithdrawalRequest.findById(requestId);
  
  if (!request) {
    throw new Error('Withdrawal request not found');
  }

  if (request.status !== 'PENDING') {
    throw new Error(`Cannot reject withdrawal request with status: ${request.status}`);
  }

  request.status = 'REJECTED';
  request.rejectionReason = reason || 'Rejected by admin';
  request.approvedBy = adminId;
  await request.save();

  return request;
};

/**
 * Get withdrawal requests
 * @param {Object} filter - Filter options
 * @returns {Promise<Object>} Withdrawal requests and pagination
 */
const getWithdrawalRequests = async (filter = {}) => {
  const {
    userId,
    status,
    page = 1,
    limit = 20
  } = filter;

  const query = {};

  if (userId) {
    query.userId = userId;
  }

  if (status) {
    query.status = status.toUpperCase();
  }

  const skip = (page - 1) * limit;

  const [requests, total] = await Promise.all([
    WithdrawalRequest.find(query)
      .populate('userId', 'name email balance fullName role')
      .populate('approvedBy', 'name email fullName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    WithdrawalRequest.countDocuments(query)
  ]);

  return {
    requests,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };
};

module.exports = {
  getUserBalance,
  topUpBalance,
  requestWithdrawal,
  approveWithdrawal,
  rejectWithdrawal,
  getWithdrawalRequests,
  creditBalance,
  debitBalance,
  calculateNetAmount
};
