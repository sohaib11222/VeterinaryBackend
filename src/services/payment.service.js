const Transaction = require('../models/Transaction');
const Appointment = require('../models/Appointment');
const User = require('../models/User');
const SubscriptionPlan = require('../models/SubscriptionPlan');
const Product = require('../models/Product');
const VeterinarianSubscription = require('../models/VeterinarianSubscription');
const balanceService = require('./balance.service');

/**
 * Process appointment payment
 * @param {string} userId - User ID (pet owner)
 * @param {string} appointmentId - Appointment ID
 * @param {number} amount - Payment amount
 * @param {string} paymentMethod - Payment method
 * @returns {Promise<Object>} Transaction
 */
const processAppointmentPayment = async (userId, appointmentId, amount, paymentMethod = 'DUMMY') => {
  const appointment = await Appointment.findById(appointmentId);
  
  if (!appointment) {
    throw new Error('Appointment not found');
  }

  // Prevent duplicate payments
  if (appointment.paymentStatus === 'PAID') {
    throw new Error('Appointment is already paid');
  }

  // Create transaction
  const transaction = await Transaction.create({
    userId,
    amount,
    currency: 'EUR',
    relatedAppointmentId: appointmentId,
    status: 'SUCCESS',
    provider: paymentMethod,
    providerReference: `APT-${Date.now()}`
  });

  // Update appointment payment status
  appointment.paymentStatus = 'PAID';
  appointment.paymentMethod = paymentMethod;
  await appointment.save();

  // Credit veterinarian balance (idempotent)
  try {
    const veterinarianId = appointment.veterinarianId?.toString ? appointment.veterinarianId.toString() : appointment.veterinarianId;
    if (veterinarianId && amount > 0) {
      const existingCredit = await Transaction.findOne({
        userId: veterinarianId,
        'metadata.type': 'BALANCE_CREDIT',
        'metadata.transactionType': 'APPOINTMENT',
        'metadata.appointmentId': appointmentId.toString()
      }).lean();

      if (!existingCredit) {
        await balanceService.creditBalance(
          veterinarianId,
          amount,
          'APPOINTMENT',
          {
            appointmentId: appointmentId.toString(),
            transactionId: transaction._id.toString(),
            payerId: userId.toString ? userId.toString() : userId
          }
        );
      }
    }
  } catch (error) {
    console.error('Error crediting veterinarian balance for appointment:', error);
  }

  return transaction;
};

/**
 * Process subscription payment
 * @param {string} veterinarianId - Veterinarian user ID
 * @param {string} planId - Subscription plan ID
 * @param {number} amount - Payment amount
 * @param {string} paymentMethod - Payment method
 * @returns {Promise<Object>} Transaction and subscription
 */
const processSubscriptionPayment = async (veterinarianId, planId, amount, paymentMethod = 'DUMMY') => {
  const veterinarian = await User.findById(veterinarianId);
  const plan = await SubscriptionPlan.findById(planId);
  
  if (!veterinarian || veterinarian.role !== 'VETERINARIAN') {
    throw new Error('Veterinarian not found');
  }

  if (!plan) {
    throw new Error('Subscription plan not found');
  }

  // Create transaction
  const transaction = await Transaction.create({
    userId: veterinarianId,
    amount,
    currency: 'EUR',
    relatedSubscriptionId: planId,
    status: 'SUCCESS',
    provider: paymentMethod,
    providerReference: `SUB-${Date.now()}`
  });

  // Calculate expiration date
  const startDate = new Date();
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + plan.durationInDays);

  // Create or update subscription
  const subscription = await VeterinarianSubscription.findOneAndUpdate(
    { veterinarianId, isActive: true },
    {
      veterinarianId,
      subscriptionPlanId: planId,
      startDate,
      endDate,
      isActive: true
    },
    { upsert: true, new: true }
  );

  return { transaction, subscription };
};

/**
 * Process product payment (single product - legacy)
 * @param {string} userId - User ID (pet owner)
 * @param {string} productId - Product ID
 * @param {number} amount - Payment amount
 * @param {string} paymentMethod - Payment method
 * @returns {Promise<Object>} Transaction
 */
const processProductPayment = async (userId, productId, amount, paymentMethod = 'DUMMY') => {
  const product = await Product.findById(productId);
  
  if (!product) {
    throw new Error('Product not found');
  }

  // Create transaction
  const transaction = await Transaction.create({
    userId,
    amount,
    currency: 'EUR',
    relatedProductId: productId,
    status: 'SUCCESS',
    provider: paymentMethod,
    providerReference: `PROD-${Date.now()}`
  });

  // Update product stock if needed
  if (product.stock > 0) {
    product.stock -= 1;
    await product.save();
  }

  return transaction;
};

/**
 * Process order payment
 * @param {string} orderId - Order ID
 * @param {string} paymentMethod - Payment method
 * @param {number} amount - Optional amount to pay (if not provided, uses order.total)
 * @returns {Promise<Object>} Transaction and updated order
 */
const processOrderPayment = async (orderId, paymentMethod = 'DUMMY', amount = null) => {
  const Order = require('../models/Order');
  const orderService = require('./order.service');
  
  const order = await Order.findById(orderId)
    .populate('items.productId');

  if (!order) {
    throw new Error('Order not found');
  }

  // Check if order is already paid
  if (order.paymentStatus === 'PAID') {
    throw new Error('Order already paid');
  }

  // Calculate amount to pay
  let amountToPay = amount !== null ? amount : order.total;
  
  // If order was partially paid, calculate difference
  if (order.paymentStatus === 'PARTIAL' && order.requiresPaymentUpdate) {
    const alreadyPaid = order.initialTotal || 0;
    amountToPay = order.total - alreadyPaid;
  } else if (order.paymentStatus === 'PAID' && !order.requiresPaymentUpdate) {
    throw new Error('Order already paid');
  }

  if (amountToPay <= 0) {
    throw new Error('No payment required');
  }

  // Create transaction
  const transaction = await Transaction.create({
    userId: order.petOwnerId,
    amount: amountToPay,
    currency: 'EUR',
    relatedProductId: order.items[0]?.productId?._id || null,
    relatedOrderId: order._id,
    status: 'SUCCESS',
    provider: paymentMethod,
    providerReference: `ORD-${order.orderNumber || Date.now()}`
  });

  // Link transaction to order
  order.transactionId = transaction._id;
  await order.save();

  // Update order payment status
  if (order.paymentStatus === 'PARTIAL') {
    order.paymentStatus = 'PAID';
    order.requiresPaymentUpdate = false;
  } else {
    order.paymentStatus = 'PAID';
  }
  order.paymentMethod = paymentMethod;
  await order.save();

  // Credit seller (owner) balance
  try {
    const sellerAmount = order.subtotal;
    await balanceService.creditBalance(
      order.ownerId.toString(),
      sellerAmount,
      'ORDER',
      {
        orderId: order._id.toString(),
        orderNumber: order.orderNumber,
        transactionId: transaction._id.toString()
      }
    );
  } catch (error) {
    console.error('Error crediting seller balance for order:', error);
  }

  return { transaction, order };
};

/**
 * Refund transaction
 * @param {string} transactionId - Transaction ID
 * @returns {Promise<Object>} Refunded transaction
 */
const refundTransaction = async (transactionId) => {
  const transaction = await Transaction.findById(transactionId)
    .populate('relatedAppointmentId')
    .populate('relatedOrderId');
  
  if (!transaction) {
    throw new Error('Transaction not found');
  }

  if (transaction.status === 'REFUNDED') {
    throw new Error('Transaction already refunded');
  }

  // Deduct balance from veterinarian/seller if balance was previously credited
  try {
    if (transaction.relatedAppointmentId) {
      const appointment = await Appointment.findById(transaction.relatedAppointmentId);
      if (appointment && appointment.veterinarianId) {
        const veterinarianId = appointment.veterinarianId.toString ? appointment.veterinarianId.toString() : appointment.veterinarianId;
        
        const creditTransaction = await Transaction.findOne({
          userId: veterinarianId,
          'metadata.type': 'BALANCE_CREDIT',
          'metadata.transactionType': 'APPOINTMENT',
          'metadata.appointmentId': appointment._id.toString()
        });

        if (creditTransaction && creditTransaction.amount > 0) {
          await balanceService.debitBalance(
            veterinarianId,
            creditTransaction.amount,
            'REFUND',
            {
              originalTransactionId: transaction._id.toString(),
              appointmentId: appointment._id.toString(),
              refundReason: 'Appointment refunded'
            }
          );
        }
      }
    } else if (transaction.relatedOrderId) {
      const Order = require('../models/Order');
      const order = await Order.findById(transaction.relatedOrderId);
      if (order && order.ownerId) {
        const ownerId = order.ownerId.toString ? order.ownerId.toString() : order.ownerId;
        
        const creditTransaction = await Transaction.findOne({
          userId: ownerId,
          'metadata.type': 'BALANCE_CREDIT',
          'metadata.transactionType': 'ORDER',
          'metadata.orderId': order._id.toString()
        });

        if (creditTransaction && creditTransaction.amount > 0) {
          await balanceService.debitBalance(
            ownerId,
            creditTransaction.amount,
            'REFUND',
            {
              originalTransactionId: transaction._id.toString(),
              orderId: order._id.toString(),
              orderNumber: order.orderNumber,
              refundReason: 'Order refunded'
            }
          );
        }
      }
    }
  } catch (error) {
    console.error('Error deducting balance during refund:', error);
  }

  transaction.status = 'REFUNDED';
  await transaction.save();

  // Update related appointment if exists
  if (transaction.relatedAppointmentId) {
    const appointment = await Appointment.findById(transaction.relatedAppointmentId);
    if (appointment) {
      appointment.paymentStatus = 'REFUNDED';
      await appointment.save();
    }
  }

  // Update related order if exists
  if (transaction.relatedOrderId) {
    const Order = require('../models/Order');
    const order = await Order.findById(transaction.relatedOrderId);
    if (order) {
      order.paymentStatus = 'REFUNDED';
      await order.save();
    }
  }

  return transaction;
};

/**
 * Get user transactions
 * @param {string} userId - User ID
 * @param {Object} options - Filter options
 * @returns {Promise<Object>} Transactions and pagination
 */
const getUserTransactions = async (userId, options = {}) => {
  const { status, page = 1, limit = 10 } = options;
  const skip = (page - 1) * limit;

  const query = { userId };
  if (status) {
    query.status = status.toUpperCase();
  }

  const [transactions, total] = await Promise.all([
    Transaction.find(query)
      .populate('relatedAppointmentId')
      .populate('relatedSubscriptionId')
      .populate('relatedProductId')
      .populate('relatedOrderId')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Transaction.countDocuments(query)
  ]);

  return {
    transactions,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };
};

/**
 * Get transaction by ID
 * @param {string} transactionId - Transaction ID
 * @returns {Promise<Object>} Transaction
 */
const getTransactionById = async (transactionId, requesterId = null, requesterRole = null) => {
  const transaction = await Transaction.findById(transactionId)
    .populate('userId', 'name email fullName')
    .populate({
      path: 'relatedAppointmentId',
      populate: [
        { path: 'veterinarianId', select: 'name email profileImage fullName' },
        { path: 'petOwnerId', select: 'name email profileImage fullName' },
        { path: 'petId', select: 'name species breed photo' },
      ],
    })
    .populate('relatedSubscriptionId')
    .populate('relatedProductId')
    .populate('relatedOrderId');
  
  if (!transaction) {
    throw new Error('Transaction not found');
  }

  if (requesterRole !== 'ADMIN') {
    const ownerId = transaction.userId?._id?.toString() || transaction.userId?.toString();
    if (!requesterId || !ownerId || ownerId !== requesterId.toString()) {
      throw new Error('Unauthorized: You do not have access to this transaction');
    }
  }

  return transaction;
};

module.exports = {
  processAppointmentPayment,
  processSubscriptionPayment,
  processProductPayment,
  processOrderPayment,
  refundTransaction,
  getUserTransactions,
  getTransactionById
};
