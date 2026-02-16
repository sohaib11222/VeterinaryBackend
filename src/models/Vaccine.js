const mongoose = require('mongoose');

const vaccineSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  applicableSpecies: {
    type: [String],
    default: ['ALL']
  },
  minAgeWeeks: {
    type: Number,
    default: null
  },
  dosesRequired: {
    type: Number,
    default: null
  },
  boosterScheduleDays: {
    type: [Number],
    default: []
  },
  defaultNextDueDays: {
    type: Number,
    default: null
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

vaccineSchema.index({ name: 1 }, { unique: true });

module.exports = mongoose.model('Vaccine', vaccineSchema);
