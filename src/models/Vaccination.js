const mongoose = require('mongoose');

const vaccinationSchema = new mongoose.Schema({
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
  vaccineId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vaccine',
    default: null
  },
  vaccinationType: {
    type: String,
    required: true // e.g., "Rabies", "DHPP", "FVRCP", "Bordetella"
  },
  vaccinationDate: {
    type: Date,
    required: true
  },
  doseNumber: {
    type: Number,
    default: null
  },
  nextDueDate: {
    type: Date,
    default: null
  },
  veterinarianId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  batchNumber: {
    type: String,
    default: null
  },
  certificateUrl: {
    type: String,
    default: null
  },
  isCompleted: {
    type: Boolean,
    default: true
  },
  relatedAppointmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Appointment',
    default: null
  },
  notes: {
    type: String,
    default: null
  }
}, {
  timestamps: true
});

// Indexes
vaccinationSchema.index({ petId: 1, vaccinationDate: -1 });
vaccinationSchema.index({ petOwnerId: 1 });
vaccinationSchema.index({ nextDueDate: 1 }); // For reminder queries

module.exports = mongoose.model('Vaccination', vaccinationSchema);
