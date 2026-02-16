const mongoose = require('mongoose');

const veterinarianSubscriptionSchema = new mongoose.Schema({
  veterinarianId: {
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

// Indexes
veterinarianSubscriptionSchema.index({ veterinarianId: 1, isActive: 1 });
veterinarianSubscriptionSchema.index({ endDate: 1 });

module.exports = mongoose.model('VeterinarianSubscription', veterinarianSubscriptionSchema);
