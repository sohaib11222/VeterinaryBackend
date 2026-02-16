const mongoose = require('mongoose');
const { MEDICAL_RECORD_TYPE } = require('../types/enums');

const medicalRecordSchema = new mongoose.Schema({
  petId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Pet',
    required: true
  },
  petOwnerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    default: null
  },
  recordType: {
    type: String,
    enum: Object.values(MEDICAL_RECORD_TYPE),
    default: MEDICAL_RECORD_TYPE.GENERAL
  },
  fileUrl: {
    type: String,
    required: true
  },
  fileName: {
    type: String,
    default: null
  },
  fileSize: {
    type: Number,
    default: null
  },
  uploadedDate: {
    type: Date,
    default: Date.now
  },
  relatedAppointmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Appointment',
    default: null
  },
  relatedVeterinarianId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  // Vaccination-specific fields
  vaccinationType: {
    type: String,
    default: null
  },
  vaccinationDate: {
    type: Date,
    default: null
  },
  nextVaccinationDue: {
    type: Date,
    default: null
  },
  // Weight-specific fields
  weight: {
    value: { type: Number, default: null },
    unit: { type: String, enum: ['kg', 'lbs'], default: 'kg' }
  },
  // Surgery-specific fields
  surgeryType: {
    type: String,
    default: null
  },
  surgeryDate: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Indexes - Optimized for queries
medicalRecordSchema.index({ petId: 1, uploadedDate: -1 });
medicalRecordSchema.index({ petOwnerId: 1, uploadedDate: -1 }); // Compound for getMedicalRecords
medicalRecordSchema.index({ petOwnerId: 1, recordType: 1, uploadedDate: -1 }); // Compound for filtered queries
medicalRecordSchema.index({ recordType: 1 });
medicalRecordSchema.index({ relatedAppointmentId: 1 });

module.exports = mongoose.model('MedicalRecord', medicalRecordSchema);
