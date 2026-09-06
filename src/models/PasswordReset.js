const mongoose = require('mongoose');

const passwordResetSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true
  },
  purpose: {
    type: String,
    enum: ['PASSWORD_RESET', 'PASSWORD_CHANGE', 'EMAIL_VERIFICATION'],
    default: 'PASSWORD_RESET'
  },
  code: {
    type: String,
    required: true
  },
  expiresAt: {
    type: Date,
    required: true
  },
  isUsed: {
    type: Boolean,
    default: false
  },
  verifiedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Indexes
passwordResetSchema.index({ email: 1, purpose: 1, isUsed: 1, expiresAt: 1 });
passwordResetSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('PasswordReset', passwordResetSchema);
