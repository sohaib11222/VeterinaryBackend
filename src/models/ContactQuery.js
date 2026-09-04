const mongoose = require('mongoose');

const CONTACT_QUERY_STATUSES = ['NEW', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];

const contactQuerySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 120,
  },
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    maxlength: 160,
  },
  phone: {
    type: String,
    required: true,
    trim: true,
    maxlength: 60,
  },
  services: {
    type: String,
    required: true,
    trim: true,
    maxlength: 160,
  },
  message: {
    type: String,
    required: true,
    trim: true,
    maxlength: 5000,
  },
  status: {
    type: String,
    enum: CONTACT_QUERY_STATUSES,
    default: 'NEW',
    index: true,
  },
  adminNotes: {
    type: String,
    default: '',
    trim: true,
    maxlength: 5000,
  },
  resolvedAt: {
    type: Date,
    default: null,
  },
  resolvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
}, {
  timestamps: true,
});

contactQuerySchema.index({ createdAt: -1 });
contactQuerySchema.index({ email: 1, createdAt: -1 });

module.exports = {
  ContactQuery: mongoose.model('ContactQuery', contactQuerySchema),
  CONTACT_QUERY_STATUSES,
};
