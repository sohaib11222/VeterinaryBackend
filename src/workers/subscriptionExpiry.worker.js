const VeterinarianSubscription = require('../models/VeterinarianSubscription');
const PetStoreSubscription = require('../models/PetStoreSubscription');
const SubscriptionPlan = require('../models/SubscriptionPlan');
const User = require('../models/User');
const { sendSubscriptionExpiryEmail } = require('../services/email.service');

const STALE_PROCESSING_MS = 10 * 60 * 1000;

const expireSubscriptions = async ({ Model, ownerField, role }) => {
  const now = new Date();
  const staleBefore = new Date(now.getTime() - STALE_PROCESSING_MS);
  const candidates = await Model.find({
    endDate: { $lte: now },
    expiryEmailSentAt: null,
    $or: [
      { isActive: true },
      { isActive: false, expiryEmailProcessingAt: { $ne: null, $lte: staleBefore } },
    ],
  })
    .select('_id ' + ownerField + ' subscriptionPlanId startDate endDate')
    .limit(100)
    .lean()
    .maxTimeMS(3000);

  let processed = 0;

  for (const candidate of candidates) {
    const claimedAt = new Date();
    const claimed = await Model.findOneAndUpdate(
      {
        _id: candidate._id,
        endDate: { $lte: now },
        expiryEmailSentAt: null,
        $or: [
          { isActive: true, $or: [{ expiryEmailProcessingAt: null }, { expiryEmailProcessingAt: { $exists: false } }, { expiryEmailProcessingAt: { $lte: staleBefore } }] },
          { isActive: false, expiryEmailProcessingAt: { $lte: staleBefore } },
        ],
      },
      { $set: { isActive: false, expiryEmailProcessingAt: claimedAt } },
      { new: true }
    ).lean();

    if (!claimed) continue;

    try {
      const [user, plan] = await Promise.all([
        User.findById(claimed[ownerField]).select('name email role').lean().maxTimeMS(2000),
        SubscriptionPlan.findById(claimed.subscriptionPlanId).select('name price durationInDays').lean().maxTimeMS(2000),
      ]);

      if (!user?.email) {
        throw new Error('Subscription owner does not have an email address');
      }

      const delivery = await sendSubscriptionExpiryEmail({
        user,
        subscription: claimed,
        plan,
        role,
      });

      if (delivery?.skipped) {
        throw new Error('Email delivery is not configured');
      }

      await Model.updateOne(
        { _id: claimed._id },
        { $set: { expiryEmailSentAt: new Date() }, $unset: { expiryEmailProcessingAt: 1 } }
      );
      processed += 1;
    } catch (error) {
      // Keep the processing timestamp so a temporary SMTP failure is retried
      // after the stale window without sending a duplicate every minute.
      console.error(`[email] Failed to send expired ${role} subscription email:`, error.message);
    }
  }

  return processed;
};

const runSubscriptionExpiryNotifications = async () => {
  const [veterinarianCount, pharmacyCount] = await Promise.all([
    expireSubscriptions({
      Model: VeterinarianSubscription,
      ownerField: 'veterinarianId',
      role: 'VETERINARIAN',
    }),
    expireSubscriptions({
      Model: PetStoreSubscription,
      ownerField: 'petStoreOwnerId',
      role: 'PET_STORE',
    }),
  ]);

  return { veterinarianCount, pharmacyCount };
};

if (require.main === module) {
  runSubscriptionExpiryNotifications()
    .then((result) => {
      console.log('Subscription expiry check completed', result);
      process.exit(0);
    })
    .catch((error) => {
      console.error('Subscription expiry check failed:', error);
      process.exit(1);
    });
}

module.exports = {
  runSubscriptionExpiryNotifications,
};

