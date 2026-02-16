const mongoose = require('mongoose');

const weightRecordSchema = new mongoose.Schema({
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
  weight: {
    value: {
      type: Number,
      required: true
    },
    unit: {
      type: String,
      enum: ['kg', 'lbs'],
      default: 'kg'
    }
  },
  date: {
    type: Date,
    required: true,
    default: Date.now
  },
  notes: {
    type: String,
    default: null
  },
  recordedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null // Can be pet owner or veterinarian
  },
  relatedAppointmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Appointment',
    default: null
  }
}, {
  timestamps: true
});

// Indexes
weightRecordSchema.index({ petId: 1, date: -1 });
weightRecordSchema.index({ petOwnerId: 1 });

module.exports = mongoose.model('WeightRecord', weightRecordSchema);
