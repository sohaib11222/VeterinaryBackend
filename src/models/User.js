const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { USER_ROLES, USER_STATUS } = require('../types/enums');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    default: null
  },
  email: {
    type: String,
    default: null,
    lowercase: true,
    trim: true,
    unique: true,
    sparse: true
  },
  phone: {
    type: String,
    default: null
  },
  password: {
    type: String,
    default: null,
    select: false // Don't return password by default
  },
  role: {
    type: String,
    enum: Object.values(USER_ROLES),
    default: USER_ROLES.PET_OWNER
  },
  status: {
    type: String,
    enum: Object.values(USER_STATUS),
    default: USER_STATUS.APPROVED // Pet owners are auto-approved, veterinarians need approval
  },
  profileImage: {
    type: String,
    default: null
  },
  address: {
    line1: { type: String, default: null },
    line2: { type: String, default: null },
    city: { type: String, default: null },
    state: { type: String, default: null },
    country: { type: String, default: null },
    zip: { type: String, default: null }
  },
  location: {
    lat: { type: Number, default: null },
    lng: { type: Number, default: null }
  },
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  // New pet-owner registrations must verify their email before activation.
  // Kept separate from isEmailVerified so existing accounts remain usable.
  emailVerificationRequired: {
    type: Boolean,
    default: false
  },
  isPhoneVerified: {
    type: Boolean,
    default: false
  },
  balance: {
    type: Number,
    default: 0,
    min: 0
  },
  fullName: {
    type: String,
    default: null
  },
  gender: {
    type: String,
    enum: ['MALE', 'FEMALE', 'OTHER'],
    default: null
  },
  bloodGroup: {
    type: String,
    default: null
  },
  dob: {
    type: Date,
    default: null
  },
  emergencyContact: {
    name: { type: String, default: null },
    phone: { type: String, default: null },
    relation: { type: String, default: null }
  },
  documentUploads: {
    type: [{
      fileUrl: { type: String, default: null },
      type: { type: String, default: null },
      originalName: { type: String, default: null },
      uploadedAt: { type: Date, default: Date.now }
    }],
    default: null
  },
  veterinarianProfile: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'VeterinarianProfile',
    default: null
  },
  subscriptionPlan: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SubscriptionPlan',
    default: null
  },
  subscriptionExpiresAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password') || !this.password) {
    return next();
  }
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
  if (!this.password) {
    return false;
  }
  return await bcrypt.compare(candidatePassword, this.password);
};

// Indexes
userSchema.index({ email: 1 });
userSchema.index({ role: 1, status: 1 });

const User = mongoose.model('User', userSchema);

module.exports = User;
