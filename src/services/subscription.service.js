const VeterinarianSubscription = require('../models/VeterinarianSubscription');
const SubscriptionPlan = require('../models/SubscriptionPlan');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const subscriptionPolicy = require('./subscriptionPolicy.service');

/**
 * Get current subscription for authenticated veterinarian
 */
const getMySubscription = async (veterinarianId) => {
  const veterinarian = await User.findById(veterinarianId);
  if (!veterinarian || veterinarian.role !== 'VETERINARIAN') {
    throw new Error('Veterinarian not found');
  }

  const ctx = await subscriptionPolicy.getVeterinarianSubscriptionContext(veterinarianId);

  if (!ctx.hasActiveSubscription) {
    return {
      subscriptionPlan: null,
      expiresAt: null,
      hasActiveSubscription: false,
      usage: { privateConsultations: 0, videoConsultations: 0, chatSessions: 0 },
      remaining: null,
      window: null,
    };
  }

  const usage = await subscriptionPolicy.computeVeterinarianUsage(veterinarianId, ctx.window);
  const remaining = subscriptionPolicy.computeRemaining(ctx.policy?.limits || null, usage);

  return {
    subscriptionPlan: ctx.subscriptionPlan,
    expiresAt: ctx.subscription?.endDate || null,
    hasActiveSubscription: true,
    usage,
    remaining,
    window: ctx.window,
  };
};

/**
 * Purchase subscription plan (veterinarian)
 */
const purchaseSubscription = async (veterinarianId, planId) => {
  await subscriptionPolicy.ensureFixedPlansExist();

  const veterinarian = await User.findById(veterinarianId);
  if (!veterinarian || veterinarian.role !== 'VETERINARIAN') {
    throw new Error('Veterinarian not found');
  }

  if (!planId) {
    const error = new Error('Plan ID is required');
    error.statusCode = 400;
    throw error;
  }

  const plan = await SubscriptionPlan.findById(planId);
  if (!plan) {
    throw new Error('Subscription plan not found');
  }

  const normalizedName = subscriptionPolicy.normalizePlanName(plan.name);
  if (!subscriptionPolicy.FIXED_PLAN_NAMES.includes(normalizedName)) {
    const error = new Error('Invalid subscription plan');
    error.statusCode = 400;
    throw error;
  }

  if (plan.status !== 'ACTIVE') {
    const error = new Error('Subscription plan is not active');
    error.statusCode = 403;
    throw error;
  }

  const startDate = new Date();
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + plan.durationInDays);

  const subscription = await VeterinarianSubscription.findOneAndUpdate(
    { veterinarianId, isActive: true },
    {
      veterinarianId,
      subscriptionPlanId: planId,
      startDate,
      endDate,
      isActive: true,
    },
    { upsert: true, new: true }
  );

  try {
    await Transaction.create({
      userId: veterinarianId,
      relatedSubscriptionId: planId,
      amount: plan.price,
      currency: 'EUR',
      status: 'SUCCESS',
      provider: 'DUMMY',
      providerReference: `SUB-${Date.now()}-${veterinarianId}`,
    });
  } catch (error) {
    console.error('Failed to create transaction record:', error);
  }

  const my = await getMySubscription(veterinarianId);
  return {
    ...my,
    subscriptionId: subscription?._id || null,
  };
};

/**
 * Get subscription by veterinarian ID
 */
const getSubscriptionByVeterinarianId = async (veterinarianId) => {
  const subscription = await VeterinarianSubscription.findOne({
    veterinarianId,
    isActive: true
  })
    .lean()
    .maxTimeMS(2000)
    .sort({ createdAt: -1 });

  if (!subscription) {
    throw new Error('No active subscription found for this veterinarian');
  }

  // Populate separately for better performance
  const [plan, veterinarian] = await Promise.all([
    subscription.subscriptionPlanId ? SubscriptionPlan.findById(subscription.subscriptionPlanId)
      .lean()
      .maxTimeMS(1000) : Promise.resolve(null),
    subscription.veterinarianId ? User.findById(subscription.veterinarianId)
      .select('name email phone profileImage')
      .lean()
      .maxTimeMS(1000) : Promise.resolve(null)
  ]);

  return {
    ...subscription,
    subscriptionPlanId: plan,
    veterinarianId: veterinarian
  };
};

/**
 * List all subscriptions with filtering (admin)
 */
const listSubscriptions = async (filter = {}) => {
  const {
    veterinarianId,
    subscriptionPlanId,
    isActive,
    page = 1,
    limit = 10
  } = filter;

  const query = {};

  if (veterinarianId) {
    query.veterinarianId = veterinarianId;
  }

  if (subscriptionPlanId) {
    query.subscriptionPlanId = subscriptionPlanId;
  }

  if (isActive !== undefined) {
    query.isActive = isActive === true || isActive === 'true';
  }

  const skip = (page - 1) * limit;

  const [subscriptionsRaw, total] = await Promise.all([
    VeterinarianSubscription.find(query)
      .lean()
      .maxTimeMS(3000)
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 }),
    VeterinarianSubscription.countDocuments(query).maxTimeMS(2000)
  ]);

  // Populate separately for better performance
  const planIds = [...new Set(subscriptionsRaw.map(s => s.subscriptionPlanId?.toString()).filter(Boolean))];
  const vetIds = [...new Set(subscriptionsRaw.map(s => s.veterinarianId?.toString()).filter(Boolean))];

  const [plans, veterinarians] = await Promise.all([
    planIds.length > 0 ? SubscriptionPlan.find({ _id: { $in: planIds } })
      .lean()
      .maxTimeMS(2000) : Promise.resolve([]),
    vetIds.length > 0 ? User.find({ _id: { $in: vetIds } })
      .select('name email phone profileImage')
      .lean()
      .maxTimeMS(2000) : Promise.resolve([])
  ]);

  const planMap = {};
  plans.forEach(p => { planMap[p._id.toString()] = p; });
  const vetMap = {};
  veterinarians.forEach(v => { vetMap[v._id.toString()] = v; });

  const subscriptions = subscriptionsRaw.map(sub => ({
    ...sub,
    subscriptionPlanId: sub.subscriptionPlanId ? planMap[sub.subscriptionPlanId.toString()] : null,
    veterinarianId: sub.veterinarianId ? vetMap[sub.veterinarianId.toString()] : null
  }));

  return {
    subscriptions,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };
};

/**
 * Cancel subscription
 */
const cancelSubscription = async (subscriptionId, userId, userRole) => {
  const subscription = await VeterinarianSubscription.findById(subscriptionId)
    .maxTimeMS(2000);

  if (!subscription) {
    throw new Error('Subscription not found');
  }

  // Check authorization
  if (userRole !== 'ADMIN' && subscription.veterinarianId.toString() !== userId.toString()) {
    throw new Error('Unauthorized: You can only cancel your own subscription');
  }

  subscription.isActive = false;
  await subscription.save();

  return subscription;
};

/**
 * Activate subscription (admin only)
 */
const activateSubscription = async (subscriptionId) => {
  const subscription = await VeterinarianSubscription.findById(subscriptionId)
    .maxTimeMS(2000);

  if (!subscription) {
    throw new Error('Subscription not found');
  }

  // Check if subscription has expired
  if (new Date() > subscription.endDate) {
    throw new Error('Cannot activate expired subscription');
  }

  subscription.isActive = true;
  await subscription.save();

  return subscription;
};

module.exports = {
  getMySubscription,
  getSubscriptionByVeterinarianId,
  listSubscriptions,
  cancelSubscription,
  activateSubscription,
  purchaseSubscription
};
