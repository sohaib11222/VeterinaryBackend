const PetStoreSubscription = require('../models/PetStoreSubscription');
const SubscriptionPlan = require('../models/SubscriptionPlan');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const petStorePlanPolicy = require('./petStorePlanPolicy.service');

const getMySubscription = async (petStoreOwnerId) => {
  const user = await User.findById(petStoreOwnerId);
  if (!user || String(user.role || '').toUpperCase() !== 'PET_STORE') {
    throw new Error('Pet store not found');
  }

  const now = new Date();
  const subscription = await PetStoreSubscription.findOne({
    petStoreOwnerId,
    isActive: true,
    endDate: { $gt: now }
  })
    .populate('subscriptionPlanId', 'name planType price durationInDays features status')
    .lean()
    .maxTimeMS(2000);

  const activePlan = subscription?.subscriptionPlanId && String(subscription.subscriptionPlanId.planType || '').toUpperCase() === petStorePlanPolicy.PLAN_TYPE
    ? subscription.subscriptionPlanId
    : null;

  return {
    subscriptionPlan: activePlan,
    subscriptionExpiresAt: activePlan ? subscription.endDate : null,
    hasActiveSubscription: !!activePlan,
  };
};

const purchaseSubscription = async (petStoreOwnerId, planId) => {
  await petStorePlanPolicy.ensureFixedPlansExist();

  const user = await User.findById(petStoreOwnerId);
  if (!user || String(user.role || '').toUpperCase() !== 'PET_STORE') {
    throw new Error('Pet store not found');
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

  if (String(plan.planType || '').toUpperCase() !== petStorePlanPolicy.PLAN_TYPE) {
    const error = new Error('Invalid subscription plan');
    error.statusCode = 400;
    throw error;
  }

  const normalizedName = petStorePlanPolicy.normalizePlanName(plan.name);
  if (!petStorePlanPolicy.FIXED_PLAN_NAMES.includes(normalizedName)) {
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

  const subscription = await PetStoreSubscription.findOneAndUpdate(
    { petStoreOwnerId, isActive: true },
    {
      petStoreOwnerId,
      subscriptionPlanId: planId,
      startDate,
      endDate,
      isActive: true,
    },
    { upsert: true, new: true }
  );

  try {
    await Transaction.create({
      userId: petStoreOwnerId,
      relatedSubscriptionId: planId,
      amount: plan.price,
      currency: 'EUR',
      status: 'SUCCESS',
      provider: 'DUMMY',
      providerReference: `PETSTORE-SUB-${Date.now()}-${petStoreOwnerId}`,
    });
  } catch (error) {
    console.error('Failed to create transaction record:', error);
  }

  const my = await getMySubscription(petStoreOwnerId);
  await require('./petStore.service').getSetupStatusForOwner(petStoreOwnerId);
  return {
    ...my,
    subscriptionId: subscription?._id || null,
  };
};

module.exports = {
  getMySubscription,
  purchaseSubscription,
};
