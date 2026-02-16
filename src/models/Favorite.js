const mongoose = require('mongoose');

const favoriteSchema = new mongoose.Schema({
  petOwnerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  veterinarianId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Indexes - ensure unique combination
favoriteSchema.index({ petOwnerId: 1, veterinarianId: 1 }, { unique: true });

module.exports = mongoose.model('Favorite', favoriteSchema);
