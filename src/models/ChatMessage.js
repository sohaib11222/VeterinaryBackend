const mongoose = require('mongoose');

const chatMessageSchema = new mongoose.Schema({
  conversationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Conversation',
    required: true
  },
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  message: {
    type: String,
    default: null
  },
  type: {
    type: String,
    enum: ['TEXT', 'IMAGE', 'FILE', 'SYSTEM'],
    default: 'TEXT'
  },
  attachments: [
    {
      type: {
        type: String,
        enum: ['image', 'file'],
        default: 'file'
      },
      url: { type: String, required: true },
      name: { type: String, default: null },
      size: { type: Number, default: null },
      mimeType: { type: String, default: null }
    }
  ],
  fileUrl: {
    type: String,
    default: null
  },
  fileName: {
    type: String,
    default: null
  },
  readBy: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    readAt: { type: Date, default: Date.now }
  }]
}, {
  timestamps: true
});

// Indexes
chatMessageSchema.index({ conversationId: 1, createdAt: -1 });
chatMessageSchema.index({ senderId: 1 });

module.exports = mongoose.model('ChatMessage', chatMessageSchema);
