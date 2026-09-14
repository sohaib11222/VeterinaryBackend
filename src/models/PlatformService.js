const mongoose = require('mongoose');
const { USER_ROLES } = require('../types/enums');

const platformServiceSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  nameIt: { type: String, required: true, trim: true, maxlength: 120 },
  slug: { type: String, required: true, trim: true, lowercase: true, unique: true },
  description: { type: String, default: '', trim: true, maxlength: 600 },
  descriptionIt: { type: String, default: '', trim: true, maxlength: 600 },
  icon: { type: String, default: 'fa-paw', trim: true, maxlength: 80 },
  kind: { type: String, enum: ['PROFESSIONAL', 'COMMERCE'], default: 'PROFESSIONAL' },
  allowedRoles: [{ type: String, enum: Object.values(USER_ROLES) }],
  isActive: { type: Boolean, default: true, index: true },
  displayOrder: { type: Number, default: 0, index: true },
}, { timestamps: true });

platformServiceSchema.index({ isActive: 1, displayOrder: 1 });

module.exports = mongoose.model('PlatformService', platformServiceSchema);
