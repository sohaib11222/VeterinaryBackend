const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
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
  petId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Pet',
    default: null // Optional: review can be pet-specific
  },
  appointmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Appointment',
    default: null
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  reviewText: {
    type: String,
    default: null
  },
  reviewType: {
    type: String,
    enum: ['OVERALL', 'APPOINTMENT'],
    default: 'OVERALL'
  }
}, {
  timestamps: true
});

// Indexes
reviewSchema.index({ veterinarianId: 1, createdAt: -1 });
reviewSchema.index({ petOwnerId: 1 });
reviewSchema.index({ appointmentId: 1 });

module.exports = mongoose.model('Review', reviewSchema);
