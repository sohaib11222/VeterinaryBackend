const SubscriptionPlan = require('../models/SubscriptionPlan');
const subscriptionPolicy = require('./subscriptionPolicy.service');
const petStorePlanPolicy = require('./petStorePlanPolicy.service');

const normalizePlanType = (t) => String(t || '').trim().toUpperCase();

const getPolicyByType = (planType) => {
  const t = normalizePlanType(planType);
  if (t === 'PET_STORE') return petStorePlanPolicy;
  return subscriptionPolicy;
};

const getPlanTypeQuery = (planType) => {
  const t = normalizePlanType(planType);
  if (t === 'PET_STORE') return 'PET_STORE';
  return { $in: ['VETERINARIAN', null] };
};

const attachPolicy = (planDoc) => {
  const obj = planDoc?.toObject ? planDoc.toObject() : planDoc;
  const t = normalizePlanType(obj?.planType);
  if (t === 'PET_STORE') return obj;
  return subscriptionPolicy.attachPolicyToPlan(obj);
};

/**
 * Create subscription plan
 */
const createPlan = async (data) => {
  const error = new Error('Subscription plans are fixed. Admin can only update plan prices.');
  error.statusCode = 403;
  throw error;
};

/**
 * Get all subscription plans
 */
const getAllPlans = async (filter = {}) => {
  const policy = getPolicyByType(filter?.planType);
  await policy.ensureFixedPlansExist();

  const query = {
    name: { $in: policy.FIXED_PLAN_NAMES },
    planType: getPlanTypeQuery(filter?.planType),
  };

  if (filter.status) {
    query.status = filter.status.toUpperCase();
  }

  const plans = await SubscriptionPlan.find(query).sort({ createdAt: 1 });

  const uniqueByName = new Map();
  plans.forEach((p) => {
    const key = policy.normalizePlanName(p.name);
    if (!uniqueByName.has(key)) uniqueByName.set(key, p);
  });

  return Array.from(uniqueByName.values())
    .sort((a, b) => Number(a.price || 0) - Number(b.price || 0))
    .map((p) => attachPolicy(p));
};

/**
 * Get active subscription plans
 */
const getActivePlans = async () => {
  const policy = subscriptionPolicy;
  await policy.ensureFixedPlansExist();

  const plans = await SubscriptionPlan.find({
    name: { $in: policy.FIXED_PLAN_NAMES },
    planType: getPlanTypeQuery('VETERINARIAN'),
    status: 'ACTIVE'
  })
    .lean()
    .maxTimeMS(2000)
    .sort({ createdAt: 1 });

  const uniqueByName = new Map();
  plans.forEach((p) => {
    const key = subscriptionPolicy.normalizePlanName(p.name);
    if (!uniqueByName.has(key)) uniqueByName.set(key, p);
  });

  return Array.from(uniqueByName.values())
    .sort((a, b) => Number(a.price || 0) - Number(b.price || 0))
    .map((p) => subscriptionPolicy.attachPolicyToPlan(p));
};

const getActivePlansByType = async (planType) => {
  const policy = getPolicyByType(planType);
  await policy.ensureFixedPlansExist();

  const plans = await SubscriptionPlan.find({
    name: { $in: policy.FIXED_PLAN_NAMES },
    planType: getPlanTypeQuery(planType),
    status: 'ACTIVE'
  })
    .lean()
    .maxTimeMS(2000)
    .sort({ createdAt: 1 });

  const uniqueByName = new Map();
  plans.forEach((p) => {
    const key = policy.normalizePlanName(p.name);
    if (!uniqueByName.has(key)) uniqueByName.set(key, p);
  });

  return Array.from(uniqueByName.values())
    .sort((a, b) => Number(a.price || 0) - Number(b.price || 0))
    .map((p) => attachPolicy(p));
};

/**
 * Get subscription plan by ID
 */
const getPlanById = async (id) => {
  await subscriptionPolicy.ensureFixedPlansExist();
  await petStorePlanPolicy.ensureFixedPlansExist();

  const plan = await SubscriptionPlan.findById(id)
    .maxTimeMS(2000);
  
  if (!plan) {
    throw new Error('Subscription plan not found');
  }

  const t = normalizePlanType(plan?.planType);
  const policy = getPolicyByType(t);
  const normalizedName = policy.normalizePlanName(plan.name);
  if (!policy.FIXED_PLAN_NAMES.includes(normalizedName)) {
    throw new Error('Subscription plan not found');
  }

  return attachPolicy(plan);
};

/**
 * Update subscription plan
 */
const updatePlan = async (id, data) => {
  await subscriptionPolicy.ensureFixedPlansExist();
  await petStorePlanPolicy.ensureFixedPlansExist();

  const plan = await SubscriptionPlan.findById(id);
  
  if (!plan) {
    throw new Error('Subscription plan not found');
  }

  const t = normalizePlanType(plan?.planType);
  const policy = getPolicyByType(t);
  const normalizedName = policy.normalizePlanName(plan.name);
  if (!policy.FIXED_PLAN_NAMES.includes(normalizedName)) {
    throw new Error('Subscription plan not found');
  }

  const allowedKeys = ['price'];
  const providedKeys = Object.keys(data || {});
  const hasDisallowed = providedKeys.some((k) => !allowedKeys.includes(k));
  if (hasDisallowed) {
    const error = new Error('Admin can only update plan price');
    error.statusCode = 403;
    throw error;
  }

  if (data.price === undefined) {
    const error = new Error('Price is required');
    error.statusCode = 400;
    throw error;
  }

  plan.price = data.price;

  await plan.save();
  return attachPolicy(plan);
};

/**
 * Delete subscription plan
 */
const deletePlan = async (id) => {
  const error = new Error('Subscription plans are fixed. Admin can only update plan prices.');
  error.statusCode = 403;
  throw error;
};

module.exports = {
  createPlan,
  getAllPlans,
  getActivePlans,
  getActivePlansByType,
  getPlanById,
  updatePlan,
  deletePlan
};
