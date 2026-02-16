const mongoose = require('mongoose');

const petStoreSchema = new mongoose.Schema({
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  name: {
    type: String,
    required: true
  },
  logo: {
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
  phone: {
    type: String,
    default: null
  },
  location: {
    lat: { type: Number, default: null },
    lng: { type: Number, default: null }
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Indexes
petStoreSchema.index({ ownerId: 1 });
petStoreSchema.index({ isActive: 1 });

module.exports = mongoose.model('PetStore', petStoreSchema);
