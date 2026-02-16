const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  relatedAppointmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Appointment',
    default: null
  },
  relatedSubscriptionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SubscriptionPlan',
    default: null
  },
  relatedProductId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    default: null
  },
  relatedOrderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    default: null
  },
  amount: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    default: 'EUR'
  },
  status: {
    type: String,
    enum: ['PENDING', 'SUCCESS', 'FAILED', 'REFUNDED'],
    default: 'PENDING'
  },
  provider: {
    type: String,
    default: 'DUMMY'
  },
  providerReference: {
    type: String,
    default: null
  },
  metadata: {
    type: Object,
    default: {}
  }
}, {
  timestamps: true
});

// Indexes
transactionSchema.index({ userId: 1, createdAt: -1 });
transactionSchema.index({ relatedAppointmentId: 1 });
transactionSchema.index({ relatedOrderId: 1 });
transactionSchema.index({ status: 1 });

module.exports = mongoose.model('Transaction', transactionSchema);
