const mongoose = require('mongoose');
const { VETERINARY_SPECIALIZATION } = require('../types/enums');

const specializationSchema = new mongoose.Schema({
  name: {
    type: String,
    unique: true,
    required: true
  },
  slug: {
    type: String,
    unique: true,
    default: null
  },
  icon: {
    type: String,
    default: null
  },
  description: {
    type: String,
    default: null
  },
  type: {
    type: String,
    enum: Object.values(VETERINARY_SPECIALIZATION),
    default: null
  }
}, {
  timestamps: true
});

// Indexes for performance
specializationSchema.index({ name: 1 });
specializationSchema.index({ slug: 1 });

module.exports = mongoose.model('Specialization', specializationSchema);
