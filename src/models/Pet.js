const mongoose = require('mongoose');
const { PET_SPECIES, PET_GENDER } = require('../types/enums');

const petSchema = new mongoose.Schema({
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  species: {
    type: String,
    enum: Object.values(PET_SPECIES),
    required: true
  },
  breed: {
    type: String,
    default: null
  },
  dateOfBirth: {
    type: Date,
    default: null
  },
  age: {
    type: Number, // Age in months
    default: null
  },
  gender: {
    type: String,
    enum: Object.values(PET_GENDER),
    default: PET_GENDER.UNKNOWN
  },
  weight: {
    value: { type: Number, default: null },
    unit: { type: String, enum: ['kg', 'lbs'], default: 'kg' }
  },
  color: {
    type: String,
    default: null
  },
  photo: {
    type: String,
    default: null
  },
  photos: {
    type: [String],
    default: []
  },
  // No default – when omitted the field is not stored; sparse unique index then allows multiple pets without microchip
  microchipNumber: {
    type: String,
    unique: true,
    sparse: true
  },
  insuranceInfo: {
    company: { type: String, default: null },
    policyNumber: { type: String, default: null },
    expiryDate: { type: Date, default: null }
  },
  medicalConditions: {
    type: [String],
    default: []
  },
  allergies: {
    type: [String],
    default: []
  },
  spayNeuterStatus: {
    type: String,
    enum: ['NEUTERED', 'SPAYED', 'INTACT', 'UNKNOWN'],
    default: 'UNKNOWN'
  },
  vaccinationHistory: [{
    type: { type: String, default: null },
    date: { type: Date, default: null },
    nextDue: { type: Date, default: null },
    veterinarianId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    certificateUrl: { type: String, default: null }
  }],
  notes: {
    type: String,
    default: null
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Indexes
petSchema.index({ ownerId: 1, isActive: 1 });
petSchema.index({ microchipNumber: 1 }, { unique: true, sparse: true }); // Sparse allows multiple null/undefined
petSchema.index({ species: 1 });

// Virtual for age calculation if dateOfBirth is provided
petSchema.virtual('calculatedAge').get(function() {
  if (this.dateOfBirth) {
    const today = new Date();
    const birthDate = new Date(this.dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  }
  return this.age;
});

const Pet = mongoose.model('Pet', petSchema);

module.exports = Pet;
