const mongoose = require('mongoose');

const videoSessionSchema = new mongoose.Schema({
  appointmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Appointment',
    required: true
  },
  veterinarianId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  petOwnerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  sessionId: {
    type: String,
    default: null
  },
  callId: {
    type: String,
    default: null
  },
  startedAt: {
    type: Date,
    default: null
  },
  endedAt: {
    type: Date,
    default: null
  },
  duration: {
    type: Number,
    default: null // Duration in seconds
  }
}, {
  timestamps: true
});

// Indexes
videoSessionSchema.index({ appointmentId: 1 });
videoSessionSchema.index({ veterinarianId: 1, startedAt: -1 });

module.exports = mongoose.model('VideoSession', videoSessionSchema);
