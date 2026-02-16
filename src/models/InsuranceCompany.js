const mongoose = require('mongoose');

const insuranceCompanySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true
  },
  logo: {
    type: String,
    default: null
  },
  contactInfo: {
    phone: { type: String, default: null },
    email: { type: String, default: null },
    website: { type: String, default: null }
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('InsuranceCompany', insuranceCompanySchema);
