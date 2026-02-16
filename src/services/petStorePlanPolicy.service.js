const SubscriptionPlan = require('../models/SubscriptionPlan');

const PLAN_TYPE = 'PET_STORE';
const FIXED_PLAN_NAMES = ['STARTER', 'PRO', 'PREMIUM'];

const FIXED_PLANS = {
  STARTER: {
    name: 'STARTER',
    defaultPrice: 29,
    durationInDays: 30,
    features: ['Full access for one month'],
  },
  PRO: {
    name: 'PRO',
    defaultPrice: 59,
    durationInDays: 60,
    features: ['Full access for two months'],
  },
  PREMIUM: {
    name: 'PREMIUM',
    defaultPrice: 89,
    durationInDays: 150,
    features: ['Full access for five months'],
  },
};

const normalizePlanName = (name) => String(name || '').trim().toUpperCase();

const ensureFixedPlansExist = async () => {
  const existing = await SubscriptionPlan.find({
    planType: PLAN_TYPE,
    name: { $in: FIXED_PLAN_NAMES },
  }).sort({ createdAt: 1 });

  const duplicatesToDelete = [];
  const seenNames = new Set();
  existing.forEach((p) => {
    const key = normalizePlanName(p.name);
    if (seenNames.has(key)) {
      duplicatesToDelete.push(p._id);
      return;
    }
    seenNames.add(key);
  });

  if (duplicatesToDelete.length > 0) {
    await SubscriptionPlan.deleteMany({ _id: { $in: duplicatesToDelete } });
  }

  const existingByName = new Map();
  existing.forEach((p) => {
    const key = normalizePlanName(p.name);
    if (!existingByName.has(key)) existingByName.set(key, p);
  });

  const createdOrUpdated = [];

  for (const planName of FIXED_PLAN_NAMES) {
    const policy = FIXED_PLANS[planName];
    const found = existingByName.get(planName);

    if (!found) {
      const created = await SubscriptionPlan.create({
        name: policy.name,
        planType: PLAN_TYPE,
        price: policy.defaultPrice,
        durationInDays: policy.durationInDays,
        features: policy.features,
        status: 'ACTIVE',
      });
      createdOrUpdated.push(created);
      continue;
    }

    let changed = false;

    if (found.planType !== PLAN_TYPE) {
      found.planType = PLAN_TYPE;
      changed = true;
    }

    if (found.name !== policy.name) {
      found.name = policy.name;
      changed = true;
    }

    if (found.durationInDays !== policy.durationInDays) {
      found.durationInDays = policy.durationInDays;
      changed = true;
    }

    const desiredFeatures = Array.isArray(policy.features) ? policy.features : [];
    const currentFeatures = Array.isArray(found.features) ? found.features : [];
    const featuresEqual = currentFeatures.length === desiredFeatures.length && currentFeatures.every((v, i) => v === desiredFeatures[i]);
    if (!featuresEqual) {
      found.features = desiredFeatures;
      changed = true;
    }

    if (found.status !== 'ACTIVE') {
      found.status = 'ACTIVE';
      changed = true;
    }

    if (changed) {
      await found.save();
    }

    createdOrUpdated.push(found);
  }

  return createdOrUpdated;
};

module.exports = {
  PLAN_TYPE,
  FIXED_PLAN_NAMES,
  FIXED_PLANS,
  normalizePlanName,
  ensureFixedPlansExist,
};
