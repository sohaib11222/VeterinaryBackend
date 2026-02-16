const Transaction = require('../models/Transaction');
const User = require('../models/User');
const { validateObjectId } = require('../utils/validation');

/**
 * Create transaction
 * @param {Object} data - Transaction data
 * @returns {Promise<Object>} Created transaction
 */
const createTransaction = async (data) => {
  const {
    userId,
    amount,
    currency,
    relatedAppointmentId,
    relatedSubscriptionId,
    relatedProductId,
    relatedOrderId,
    status,
    provider,
    providerReference
  } = data;

  // Verify user exists
  validateObjectId(userId, 'User ID');
  
  const user = await User.findById(userId)
    .maxTimeMS(2000);
  if (!user) {
    throw new Error('User not found');
  }

  const transaction = await Transaction.create({
    userId,
    amount,
    currency: currency || 'EUR',
    relatedAppointmentId: relatedAppointmentId || null,
    relatedSubscriptionId: relatedSubscriptionId || null,
    relatedProductId: relatedProductId || null,
    relatedOrderId: relatedOrderId || null,
    status: status || 'PENDING',
    provider: provider || null,
    providerReference: providerReference || null
  });

  return transaction;
};

/**
 * Update transaction status
 * @param {string} id - Transaction ID
 * @param {string} status - New status
 * @returns {Promise<Object>} Updated transaction
 */
const updateTransactionStatus = async (id, status) => {
  const transaction = await Transaction.findById(id)
    .maxTimeMS(2000);
  
  if (!transaction) {
    throw new Error('Transaction not found');
  }

  const validStatuses = ['PENDING', 'SUCCESS', 'FAILED', 'REFUNDED'];
  if (!validStatuses.includes(status)) {
    throw new Error('Invalid transaction status');
  }

  transaction.status = status;
  await transaction.save();

  return transaction;
};

/**
 * List transactions with filtering
 * @param {Object} filter - Filter criteria
 * @returns {Promise<Object>} Transactions and pagination info
 */
const listTransactions = async (filter = {}) => {
  const {
    userId,
    status,
    provider,
    type,
    fromDate,
    toDate,
    page = 1,
    limit = 10
  } = filter;

  const query = {};

  if (userId) {
    query.userId = userId;
  }

  if (status) {
    query.status = status.toUpperCase();
  }

  if (provider) {
    query.provider = provider;
  }

  // Filter by transaction type
  if (type) {
    const typeUpper = type.toUpperCase();
    if (typeUpper === 'APPOINTMENT') {
      query.relatedAppointmentId = { $ne: null };
    } else if (typeUpper === 'SUBSCRIPTION') {
      query.relatedSubscriptionId = { $ne: null };
    } else if (typeUpper === 'PRODUCT') {
      query.relatedProductId = { $ne: null };
    } else if (typeUpper === 'ORDER') {
      query.relatedOrderId = { $ne: null };
    }
  }

  if (fromDate || toDate) {
    query.createdAt = {};
    if (fromDate) {
      query.createdAt.$gte = new Date(fromDate);
    }
    if (toDate) {
      query.createdAt.$lte = new Date(toDate);
    }
  }

  const skip = (page - 1) * limit;

  const [transactionsRaw, total] = await Promise.all([
    Transaction.find(query)
      .lean()
      .maxTimeMS(3000)
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 }),
    Transaction.countDocuments(query).maxTimeMS(2000)
  ]);

  // Populate separately for better performance
  const userIds = [...new Set(transactionsRaw.map(t => t.userId?.toString()).filter(Boolean))];
  const appointmentIds = [...new Set(transactionsRaw.map(t => t.relatedAppointmentId?.toString()).filter(Boolean))];
  const subscriptionIds = [...new Set(transactionsRaw.map(t => t.relatedSubscriptionId?.toString()).filter(Boolean))];
  const productIds = [...new Set(transactionsRaw.map(t => t.relatedProductId?.toString()).filter(Boolean))];
  const orderIds = [...new Set(transactionsRaw.map(t => t.relatedOrderId?.toString()).filter(Boolean))];

  const [users, appointments, subscriptions, products, orders] = await Promise.all([
    userIds.length > 0 ? User.find({ _id: { $in: userIds } })
      .select('name email fullName')
      .lean()
      .maxTimeMS(2000) : Promise.resolve([]),
    appointmentIds.length > 0 ? require('../models/Appointment').find({ _id: { $in: appointmentIds } })
      .lean()
      .maxTimeMS(2000) : Promise.resolve([]),
    subscriptionIds.length > 0 ? require('../models/VeterinarianSubscription').find({ _id: { $in: subscriptionIds } })
      .lean()
      .maxTimeMS(2000) : Promise.resolve([]),
    productIds.length > 0 ? require('../models/Product').find({ _id: { $in: productIds } })
      .lean()
      .maxTimeMS(2000) : Promise.resolve([]),
    orderIds.length > 0 ? require('../models/Order').find({ _id: { $in: orderIds } })
      .lean()
      .maxTimeMS(2000) : Promise.resolve([])
  ]);

  const userMap = {};
  users.forEach(u => { userMap[u._id.toString()] = u; });
  const appointmentMap = {};
  appointments.forEach(a => { appointmentMap[a._id.toString()] = a; });
  const subscriptionMap = {};
  subscriptions.forEach(s => { subscriptionMap[s._id.toString()] = s; });
  const productMap = {};
  products.forEach(p => { productMap[p._id.toString()] = p; });
  const orderMap = {};
  orders.forEach(o => { orderMap[o._id.toString()] = o; });

  const transactions = transactionsRaw.map(t => ({
    ...t,
    userId: t.userId ? userMap[t.userId.toString()] : null,
    relatedAppointmentId: t.relatedAppointmentId ? appointmentMap[t.relatedAppointmentId.toString()] : null,
    relatedSubscriptionId: t.relatedSubscriptionId ? subscriptionMap[t.relatedSubscriptionId.toString()] : null,
    relatedProductId: t.relatedProductId ? productMap[t.relatedProductId.toString()] : null,
    relatedOrderId: t.relatedOrderId ? orderMap[t.relatedOrderId.toString()] : null
  }));

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
 * @param {string} id - Transaction ID
 * @returns {Promise<Object>} Transaction
 */
const getTransaction = async (id) => {
  const transaction = await Transaction.findById(id)
    .lean()
    .maxTimeMS(2000);
  
  if (!transaction) {
    throw new Error('Transaction not found');
  }

  // Populate separately for better performance
  const [user, appointment, subscription, product, order] = await Promise.all([
    transaction.userId ? User.findById(transaction.userId)
      .select('name email profileImage fullName')
      .lean()
      .maxTimeMS(1000) : Promise.resolve(null),
    transaction.relatedAppointmentId ? require('../models/Appointment').findById(transaction.relatedAppointmentId)
      .lean()
      .maxTimeMS(1000) : Promise.resolve(null),
    transaction.relatedSubscriptionId ? require('../models/VeterinarianSubscription').findById(transaction.relatedSubscriptionId)
      .lean()
      .maxTimeMS(1000) : Promise.resolve(null),
    transaction.relatedProductId ? require('../models/Product').findById(transaction.relatedProductId)
      .lean()
      .maxTimeMS(1000) : Promise.resolve(null),
    transaction.relatedOrderId ? require('../models/Order').findById(transaction.relatedOrderId)
      .lean()
      .maxTimeMS(1000) : Promise.resolve(null)
  ]);

  return {
    ...transaction,
    userId: user,
    relatedAppointmentId: appointment,
    relatedSubscriptionId: subscription,
    relatedProductId: product,
    relatedOrderId: order
  };
};

module.exports = {
  createTransaction,
  updateTransactionStatus,
  listTransactions,
  getTransaction
};
