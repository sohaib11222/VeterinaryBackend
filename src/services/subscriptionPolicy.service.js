const SubscriptionPlan = require('../models/SubscriptionPlan');
const VeterinarianSubscription = require('../models/VeterinarianSubscription');
const Appointment = require('../models/Appointment');
const Conversation = require('../models/Conversation');

const FIXED_PLAN_NAMES = ['BASIC', 'PRO', 'PREMIUM'];

const FIXED_PLANS = {
  BASIC: {
    name: 'BASIC',
    defaultPrice: 29,
    durationInDays: 30,
    limits: {
      privateConsultations: 10,
      videoConsultations: 5,
      chatSessions: 15,
    },
    crmAccess: false,
  },
  PRO: {
    name: 'PRO',
    defaultPrice: 59,
    durationInDays: 30,
    limits: {
      privateConsultations: 20,
      videoConsultations: 10,
      chatSessions: 30,
    },
    crmAccess: false,
  },
  PREMIUM: {
    name: 'PREMIUM',
    defaultPrice: 99,
    durationInDays: 30,
    limits: {
      privateConsultations: null,
      videoConsultations: null,
      chatSessions: null,
    },
    crmAccess: true,
  },
};

const normalizePlanName = (name) => String(name || '').trim().toUpperCase();

const getPlanPolicy = (planName) => {
  const key = normalizePlanName(planName);
  return FIXED_PLANS[key] || null;
};

const getPlanFeatures = (planName) => {
  const policy = getPlanPolicy(planName);
  if (!policy) return [];

  const privateText = policy.limits.privateConsultations === null
    ? 'Private Consultation: Unlimited'
    : `Private Consultation: Max ${policy.limits.privateConsultations}`;

  const videoText = policy.limits.videoConsultations === null
    ? 'Video Consultation: Unlimited'
    : `Video Consultation: Max ${policy.limits.videoConsultations}`;

  const chatText = policy.limits.chatSessions === null
    ? 'Chat: Unlimited'
    : `Chat: Max ${policy.limits.chatSessions}`;

  const features = [privateText, videoText, chatText];

  if (policy.crmAccess) {
    features.push('CRM: Full Access');
  }

  return features;
};

const attachPolicyToPlan = (planDoc) => {
  const planObj = planDoc?.toObject ? planDoc.toObject() : planDoc;
  const policy = getPlanPolicy(planObj?.name);

  return {
    ...planObj,
    limits: policy ? policy.limits : null,
    crmAccess: policy ? policy.crmAccess : false,
  };
};

const ensureFixedPlansExist = async () => {
  const existing = await SubscriptionPlan.find({
    name: { $in: FIXED_PLAN_NAMES },
    planType: { $in: ['VETERINARIAN', null] },
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
    if (!existingByName.has(key)) {
      existingByName.set(key, p);
    }
  });

  const createdOrUpdated = [];

  for (const planName of FIXED_PLAN_NAMES) {
    const policy = FIXED_PLANS[planName];
    const found = existingByName.get(planName);

    if (!found) {
      const created = await SubscriptionPlan.create({
        name: policy.name,
        planType: 'VETERINARIAN',
        price: policy.defaultPrice,
        durationInDays: policy.durationInDays,
        features: getPlanFeatures(planName),
        status: 'ACTIVE',
      });
      createdOrUpdated.push(created);
      continue;
    }

    let changed = false;

    if (found.planType !== 'VETERINARIAN') {
      found.planType = 'VETERINARIAN';
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

    const desiredFeatures = getPlanFeatures(planName);
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

const getSubscriptionWindow = (subscription) => {
  if (!subscription?.startDate || !subscription?.endDate) return null;
  return { start: new Date(subscription.startDate), end: new Date(subscription.endDate) };
};

const computeVeterinarianUsage = async (veterinarianId, window) => {
  if (!window) {
    return {
      privateConsultations: 0,
      videoConsultations: 0,
      chatSessions: 0,
    };
  }

  const statusFilter = { $nin: ['CANCELLED', 'REJECTED'] };

  const [privateConsultations, videoConsultations, chatSessions] = await Promise.all([
    Appointment.countDocuments({
      veterinarianId,
      bookingType: 'VISIT',
      status: statusFilter,
      createdAt: { $gte: window.start, $lte: window.end },
    }),
    Appointment.countDocuments({
      veterinarianId,
      bookingType: 'ONLINE',
      status: statusFilter,
      createdAt: { $gte: window.start, $lte: window.end },
    }),
    Conversation.countDocuments({
      veterinarianId,
      conversationType: 'VETERINARIAN_PET_OWNER',
      createdAt: { $gte: window.start, $lte: window.end },
    }),
  ]);

  return {
    privateConsultations,
    videoConsultations,
    chatSessions,
  };
};

const computeRemaining = (limits, usage) => {
  if (!limits) return null;

  const remainingValue = (limit, used) => {
    if (limit === null) return null;
    const left = limit - (used || 0);
    return left < 0 ? 0 : left;
  };

  return {
    privateConsultations: remainingValue(limits.privateConsultations, usage.privateConsultations),
    videoConsultations: remainingValue(limits.videoConsultations, usage.videoConsultations),
    chatSessions: remainingValue(limits.chatSessions, usage.chatSessions),
  };
};

const getVeterinarianSubscriptionContext = async (veterinarianId) => {
  await ensureFixedPlansExist();

  const now = new Date();
  const subscription = await VeterinarianSubscription.findOne({
    veterinarianId,
    isActive: true,
    endDate: { $gt: now },
  })
    .lean()
    .sort({ createdAt: -1 });

  if (!subscription) {
    return {
      hasActiveSubscription: false,
      subscription: null,
      subscriptionPlan: null,
      planName: null,
      policy: null,
      window: null,
    };
  }

  const plan = subscription.subscriptionPlanId
    ? await SubscriptionPlan.findById(subscription.subscriptionPlanId).lean()
    : null;

  const planName = normalizePlanName(plan?.name);
  const policy = getPlanPolicy(planName);

  return {
    hasActiveSubscription: !!plan && !!policy,
    subscription,
    subscriptionPlan: plan ? attachPolicyToPlan(plan) : null,
    planName,
    policy,
    window: getSubscriptionWindow(subscription),
  };
};

const enforceAppointmentBookingLimit = async ({ veterinarianId, bookingType }) => {
  const { hasActiveSubscription, policy, window } = await getVeterinarianSubscriptionContext(veterinarianId);

  if (!hasActiveSubscription) {
    const error = new Error('Veterinarian does not have an active subscription');
    error.statusCode = 403;
    throw error;
  }

  if (!policy || !policy.limits) {
    return;
  }

  const usage = await computeVeterinarianUsage(veterinarianId, window);

  if (bookingType === 'VISIT' && policy.limits.privateConsultations !== null) {
    if (usage.privateConsultations >= policy.limits.privateConsultations) {
      const error = new Error('Veterinarian has reached the monthly Private Consultation limit. Please upgrade your plan.');
      error.statusCode = 403;
      throw error;
    }
  }

  if (bookingType === 'ONLINE' && policy.limits.videoConsultations !== null) {
    if (usage.videoConsultations >= policy.limits.videoConsultations) {
      const error = new Error('Veterinarian has reached the monthly Video Consultation limit. Please upgrade your plan.');
      error.statusCode = 403;
      throw error;
    }
  }
};

const enforceChatStartLimit = async ({ veterinarianId }) => {
  const { hasActiveSubscription, policy, window } = await getVeterinarianSubscriptionContext(veterinarianId);

  if (!hasActiveSubscription) {
    const error = new Error('Veterinarian does not have an active subscription. Please renew your plan to use chat.');
    error.statusCode = 403;
    throw error;
  }

  if (!policy || !policy.limits || policy.limits.chatSessions === null) {
    return;
  }

  const usage = await computeVeterinarianUsage(veterinarianId, window);

  if (usage.chatSessions >= policy.limits.chatSessions) {
    const error = new Error('Veterinarian has reached the monthly Chat limit. Please upgrade your plan.');
    error.statusCode = 403;
    throw error;
  }
};

const enforceCrmAccess = async ({ veterinarianId }) => {
  const { hasActiveSubscription, planName } = await getVeterinarianSubscriptionContext(veterinarianId);

  if (!hasActiveSubscription) {
    const error = new Error('Veterinarian does not have an active subscription.');
    error.statusCode = 403;
    throw error;
  }

  if (planName !== 'PREMIUM') {
    const error = new Error('CRM access is available for PREMIUM plan only.');
    error.statusCode = 403;
    throw error;
  }
};

module.exports = {
  FIXED_PLAN_NAMES,
  FIXED_PLANS,
  normalizePlanName,
  getPlanPolicy,
  getPlanFeatures,
  attachPolicyToPlan,
  ensureFixedPlansExist,
  getSubscriptionWindow,
  computeVeterinarianUsage,
  computeRemaining,
  getVeterinarianSubscriptionContext,
  enforceAppointmentBookingLimit,
  enforceChatStartLimit,
  enforceCrmAccess,
};
