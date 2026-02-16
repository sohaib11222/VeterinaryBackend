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
conversationSchema.index({ appointmentId: 1 });
conversationSchema.index({ lastMessageAt: -1 });

module.exports = mongoose.model('Conversation', conversationSchema);
