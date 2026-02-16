const mongoose = require('mongoose');

const petStoreSubscriptionSchema = new mongoose.Schema({
  petStoreOwnerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  subscriptionPlanId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SubscriptionPlan',
    required: true
  },
  startDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  endDate: {
    type: Date,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

petStoreSubscriptionSchema.index({ petStoreOwnerId: 1, isActive: 1 });
petStoreSubscriptionSchema.index({ endDate: 1 });

module.exports = mongoose.model('PetStoreSubscription', petStoreSubscriptionSchema);
