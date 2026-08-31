const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    required: true
  },
  body: {
    type: String,
    default: null
  },
  type: {
    type: String,
    enum: [
      'APPOINTMENT',
      'PAYMENT',
      'SYSTEM',
      'SUBSCRIPTION',
      'CHAT',
      'PRESCRIPTION',
      'PRESCRIPTION_REQUEST',
      'PRESCRIPTION_APPROVED',
      'PRESCRIPTION_REJECTED',
      'VACCINATION',
      'WEIGHT',
      'RESCHEDULE_REQUEST',
      'RESCHEDULE_APPROVED',
      'RESCHEDULE_REJECTED',
      'SUPPORT_TICKET',
      'OTHER',
    ],
    default: 'OTHER'
  },
  data: {
    type: Object,
    default: null
  },
  isRead: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Indexes
notificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
