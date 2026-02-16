const mongoose = require('mongoose');

const announcementReadSchema = new mongoose.Schema({
  announcementId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Announcement',
    required: true
  },
  veterinarianId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  isRead: {
    type: Boolean,
    default: true
  },
  readAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes - ensure unique combination
announcementReadSchema.index({ announcementId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('AnnouncementRead', announcementReadSchema);
