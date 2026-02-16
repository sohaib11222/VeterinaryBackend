const mongoose = require('mongoose');
const { VETERINARY_SPECIALIZATION } = require('../types/enums');

const veterinarianProfileSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  title: {
    type: String,
    default: null // Dr., DVM, etc.
  },
  biography: {
    type: String,
    default: null
  },
  specializations: {
    type: [String],
    enum: Object.values(VETERINARY_SPECIALIZATION),
    default: []
  },
  experienceYears: {
    type: Number,
    default: null
  },
  licenseNumber: {
    type: String,
    default: null
  },
  licenseDocument: {
    type: String,
    default: null
  },
  services: {
    type: [{
      name: { type: String, default: null },
      price: { type: Number, default: null },
      description: { type: String, default: null }
    }],
    default: []
  },
  consultationFees: {
    clinic: {
      type: Number,
      default: null
    },
    online: {
      type: Number,
      default: null
    }
  },
  clinics: {
    type: [{
      name: { type: String, default: null },
      address: { type: String, default: null },
      city: { type: String, default: null },
      state: { type: String, default: null },
      country: { type: String, default: null },
      phone: { type: String, default: null },
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
      images: {
        type: [String],
        default: []
      },
      timings: {
        type: [{
          dayOfWeek: { type: String, default: null },
          startTime: { type: String, default: null },
          endTime: { type: String, default: null }
        }],
        default: []
      }
    }],
    default: []
  },
  education: {
    type: [{
      degree: { type: String, default: null },
      college: { type: String, default: null },
      year: { type: String, default: null }
    }],
    default: []
  },
  experience: {
    type: [{
      hospital: { type: String, default: null },
      fromYear: { type: String, default: null },
      toYear: { type: String, default: null },
      designation: { type: String, default: null }
    }],
    default: []
  },
  awards: {
    type: [{
      title: { type: String, default: null },
      year: { type: String, default: null }
    }],
    default: []
  },
  memberships: {
    type: [{
      name: { type: String, default: null }
    }],
    default: []
  },
  ratingAvg: {
    type: Number,
    default: 0
  },
  ratingCount: {
    type: Number,
    default: 0
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  isFeatured: {
    type: Boolean,
    default: false
  },
  isAvailableOnline: {
    type: Boolean,
    default: true
  },
  canSellProducts: {
    type: Boolean,
    default: false
  },
  socialLinks: {
    facebook: { type: String, default: null },
    instagram: { type: String, default: null },
    linkedin: { type: String, default: null },
    twitter: { type: String, default: null },
    website: { type: String, default: null }
  },
  profileCompleted: {
    type: Boolean,
    default: false
  },
  // Insurance / conventioned (parity with doctor profile "convenzionato")
  convenzionato: {
    type: Boolean,
    default: false
  },
  insuranceCompanies: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'InsuranceCompany',
    default: []
  }],
  acceptsInsurance: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Indexes
veterinarianProfileSchema.index({ userId: 1 });
veterinarianProfileSchema.index({ isVerified: 1, isFeatured: 1 });
veterinarianProfileSchema.index({ specializations: 1 });

module.exports = mongoose.model('VeterinarianProfile', veterinarianProfileSchema);
