const mongoose = require('mongoose');

const veterinarianAvailabilitySchema = new mongoose.Schema({
  veterinarianId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  timeSlots: [{
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    isAvailable: { type: Boolean, default: true },
    appointmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Appointment',
      default: null
    }
  }],
  isAvailable: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Indexes
veterinarianAvailabilitySchema.index({ veterinarianId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('VeterinarianAvailability', veterinarianAvailabilitySchema);
