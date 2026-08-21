const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
  veterinarianId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  petOwnerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  adminId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  appointmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Appointment',
    default: null
  },
  conversationType: {
    type: String,
    enum: ['VETERINARIAN_PET_OWNER', 'ADMIN_VETERINARIAN'],
    default: 'VETERINARIAN_PET_OWNER'
  },
  status: {
    type: String,
    enum: ['ACTIVE', 'COMPLETED'],
    default: 'ACTIVE'
  },
  completedAt: {
    type: Date,
    default: null
  },
  completedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  // Legacy appointment-specific conversations are retained for audit/history
  // after their messages have been consolidated into the relationship chat.
  mergedInto: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Conversation',
    default: null
  },
  lastMessage: {
    message: { type: String, default: null },
    sentAt: { type: Date, default: null },
    sentBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
  },
  lastMessageAt: {
    type: Date,
    default: null
  },
  unreadCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Indexes
conversationSchema.index({ veterinarianId: 1, petOwnerId: 1 });
conversationSchema.index({ veterinarianId: 1, petOwnerId: 1, conversationType: 1, mergedInto: 1, lastMessageAt: -1 });
conversationSchema.index({ appointmentId: 1 });
conversationSchema.index({ lastMessageAt: -1 });

module.exports = mongoose.model('Conversation', conversationSchema);
