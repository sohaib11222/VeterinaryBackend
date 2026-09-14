const mongoose = require('mongoose');
const { USER_ROLES } = require('../types/enums');

const providerServiceOfferingSchema = new mongoose.Schema({
  serviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'PlatformService', required: true, index: true },
  providerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  providerRole: { type: String, enum: Object.values(USER_ROLES), required: true, index: true },
  description: { type: String, default: '', trim: true, maxlength: 1000 },
  priceFrom: { type: Number, default: null, min: 0 },
  deliveryModes: [{ type: String, enum: ['IN_PERSON', 'ONLINE', 'HOME_VISIT', 'TRANSPORT', 'STORE'] }],
  isActive: { type: Boolean, default: true, index: true },
}, { timestamps: true });

providerServiceOfferingSchema.index({ providerId: 1, serviceId: 1 }, { unique: true });
providerServiceOfferingSchema.index({ serviceId: 1, providerRole: 1, isActive: 1 });

module.exports = mongoose.model('ProviderServiceOffering', providerServiceOfferingSchema);
