const mongoose = require('mongoose');

const socialLinkSchema = new mongoose.Schema({
  platform: {
    type: String,
    required: true,
    trim: true,
    maxlength: 40,
  },
  url: {
    type: String,
    required: true,
    trim: true,
    maxlength: 500,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
}, { _id: true });

const footerOptionSchema = new mongoose.Schema({
  key: {
    type: String,
    default: 'default',
    unique: true,
    immutable: true,
  },
  address: {
    type: String,
    default: '3556 Beech Street, USA',
    trim: true,
    maxlength: 300,
  },
  supportEmail: {
    type: String,
    default: 'support@mypetplus.com',
    trim: true,
    lowercase: true,
    maxlength: 160,
  },
  phoneNumber: {
    type: String,
    default: '+1 315 369 5943',
    trim: true,
    maxlength: 60,
  },
  socialLinks: {
    type: [socialLinkSchema],
    default: [],
  },
}, {
  timestamps: true,
  collection: 'footer_options',
});

module.exports = mongoose.model('FooterOption', footerOptionSchema);
