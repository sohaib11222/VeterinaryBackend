const Announcement = require('../models/Announcement');
const AnnouncementRead = require('../models/AnnouncementRead');
const User = require('../models/User');
const VeterinarianProfile = require('../models/VeterinarianProfile');
const Notification = require('../models/Notification');

/**
 * Send notifications to veterinarians for new announcement
 * @param {Object} announcement - Announcement object
 */
const sendAnnouncementNotifications = async (announcement) => {
  try {
    let targetVeterinarians = [];

    if (announcement.announcementType === 'BROADCAST') {
      // Get all approved veterinarians
      targetVeterinarians = await User.find({ role: 'VETERINARIAN', status: 'APPROVED' }).select('_id');
    } else if (announcement.announcementType === 'TARGETED') {
      const criteria = announcement.targetCriteria || {};
      const query = { role: 'VETERINARIAN', status: 'APPROVED' };

      // If individual veterinarian IDs specified, use those
      if (criteria.individualVeterinarianIds && criteria.individualVeterinarianIds.length > 0) {
        query._id = { $in: criteria.individualVeterinarianIds };
      } else {
        // Build query based on criteria
        const veterinarianIds = new Set();

        // Filter by specialization
        if (criteria.specializationIds && criteria.specializationIds.length > 0) {
          const profiles = await VeterinarianProfile.find({
            specializations: { $in: criteria.specializationIds }
          }).select('userId');
          profiles.forEach(profile => veterinarianIds.add(profile.userId.toString()));
        }

        // Filter by subscription plan
        if (criteria.subscriptionPlanIds && criteria.subscriptionPlanIds.length > 0) {
          const VeterinarianSubscription = require('../models/VeterinarianSubscription');
          const subscriptions = await VeterinarianSubscription.find({
            subscriptionPlanId: { $in: criteria.subscriptionPlanIds },
            isActive: true,
            endDate: { $gt: new Date() }
          }).select('veterinarianId');
          subscriptions.forEach(sub => veterinarianIds.add(sub.veterinarianId.toString()));
        }

        // Filter by location
        if (criteria.location) {
          const locationQuery = {};
          if (criteria.location.city) {
            locationQuery['clinics.city'] = { $regex: criteria.location.city, $options: 'i' };
          }
          if (criteria.location.state) {
            locationQuery['clinics.state'] = { $regex: criteria.location.state, $options: 'i' };
          }
          if (criteria.location.country) {
            locationQuery['clinics.country'] = { $regex: criteria.location.country, $options: 'i' };
          }

          if (Object.keys(locationQuery).length > 0) {
            const profiles = await VeterinarianProfile.find(locationQuery).select('userId');
            profiles.forEach(profile => veterinarianIds.add(profile.userId.toString()));
          }
        }

        if (veterinarianIds.size > 0) {
          const mongoose = require('mongoose');
          query._id = { $in: Array.from(veterinarianIds).map(id => new mongoose.Types.ObjectId(id)) };
        } else {
          return;
        }
      }

      targetVeterinarians = await User.find(query).select('_id');
    }

    // Create notifications for all target veterinarians
    const notifications = targetVeterinarians.map(vet => ({
      userId: vet._id,
      title: announcement.priority === 'URGENT' ? `🚨 URGENT: ${announcement.title}` : announcement.title,
      body: announcement.message.length > 200 ? announcement.message.substring(0, 200) + '...' : announcement.message,
      type: 'SYSTEM',
      data: {
        announcementId: announcement._id.toString(),
        priority: announcement.priority,
        isPinned: announcement.isPinned
      },
      isRead: false
    }));

    if (notifications.length > 0) {
      await Notification.insertMany(notifications);
    }
  } catch (error) {
    console.error('Error sending announcement notifications:', error);
  }
};

/**
 * Create announcement
 * @param {Object} data - Announcement data
 * @returns {Promise<Object>} Created announcement
 */
const createAnnouncement = async (data) => {
  const {
    title,
    message,
    image,
    file,
    link,
    priority,
    announcementType,
    targetCriteria,
    isPinned,
    expiryType,
    expiryDate,
    createdBy
  } = data;

  // Validate expiry date if provided
  if (expiryType === 'EXPIRE_AFTER_DATE' && !expiryDate) {
    throw new Error('Expiry date is required when expiry type is EXPIRE_AFTER_DATE');
  }

  const announcement = await Announcement.create({
    title,
    message,
    image,
    file,
    link,
    priority: priority || 'NORMAL',
    announcementType,
    targetCriteria: targetCriteria || {},
    isPinned: isPinned || false,
    expiryType: expiryType || 'NO_EXPIRY',
    expiryDate: expiryDate ? new Date(expiryDate) : null,
    createdBy,
    isActive: true
  });

  // Send notifications to target veterinarians
  await sendAnnouncementNotifications(announcement);

  return announcement;
};

/**
 * List announcements for admin
 * @param {Object} filter - Filter options
 * @returns {Promise<Object>} Announcements and pagination info
 */
const listAnnouncements = async (filter = {}) => {
  const {
    priority,
    announcementType,
    isPinned,
    isActive,
    page = 1,
    limit = 20
  } = filter;

  const query = {};

  if (priority) {
    query.priority = priority.toUpperCase();
  }

  if (announcementType) {
    query.announcementType = announcementType.toUpperCase();
  }

  if (isPinned !== undefined) {
    query.isPinned = isPinned === true || isPinned === 'true';
  }

  if (isActive !== undefined) {
    query.isActive = isActive === true || isActive === 'true';
  }

  // Filter expired announcements
  const now = new Date();
  query.$or = [
    { expiryType: 'NO_EXPIRY' },
    { expiryType: 'EXPIRE_AFTER_DATE', expiryDate: { $gt: now } },
    { expiryType: 'AUTO_HIDE_AFTER_READ' }
  ];

  const skip = (page - 1) * limit;

  const [announcements, total] = await Promise.all([
    Announcement.find(query)
      .populate('createdBy', 'name email fullName')
      .populate('targetCriteria.specializationIds', 'name')
      .populate('targetCriteria.subscriptionPlanIds', 'name')
      .populate('targetCriteria.individualVeterinarianIds', 'name email fullName')
      .sort({ isPinned: -1, priority: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Announcement.countDocuments(query)
  ]);

  return {
    announcements,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };
};

/**
 * Get announcements for veterinarian
 * @param {string} veterinarianId - Veterinarian ID
 * @param {Object} options - Filter options
 * @returns {Promise<Object>} Announcements and pagination info
 */
const getAnnouncementsForVeterinarian = async (veterinarianId, options = {}) => {
  const { page = 1, limit = 20, isRead } = options;

  // Verify veterinarian exists and is approved
  const veterinarian = await User.findById(veterinarianId);
  if (!veterinarian || veterinarian.role !== 'VETERINARIAN' || veterinarian.status !== 'APPROVED') {
    throw new Error('Veterinarian not found or not approved');
  }

  const now = new Date();

  // Get veterinarian's profile for filtering
  const veterinarianProfile = await VeterinarianProfile.findOne({ userId: veterinarianId });

  // Build query for announcements visible to this veterinarian
  const visibilityQuery = {
    isActive: true,
    $or: [
      // Broadcast announcements
      { announcementType: 'BROADCAST' },
      // Targeted announcements matching this veterinarian
      {
        announcementType: 'TARGETED',
        $or: [
          { 'targetCriteria.individualVeterinarianIds': veterinarianId },
          { 'targetCriteria.specializationIds': { $in: veterinarianProfile?.specializations || [] } },
          // Location matching (if veterinarian has clinics)
          ...(veterinarianProfile?.clinics?.length > 0 ? veterinarianProfile.clinics.flatMap(clinic => [
            clinic.city ? { 'targetCriteria.location.city': { $regex: clinic.city, $options: 'i' } } : null,
            clinic.state ? { 'targetCriteria.location.state': { $regex: clinic.state, $options: 'i' } } : null,
            clinic.country ? { 'targetCriteria.location.country': { $regex: clinic.country, $options: 'i' } } : null
          ].filter(Boolean)) : [])
        ]
      }
    ]
  };

  // Get all matching announcements first
  const allMatchingAnnouncements = await Announcement.find(visibilityQuery).select('_id expiryType expiryDate');
  
  // Filter by expiry
  const validAnnouncementIds = allMatchingAnnouncements
    .filter(announcement => {
      if (announcement.expiryType === 'NO_EXPIRY') return true;
      if (announcement.expiryType === 'EXPIRE_AFTER_DATE' && announcement.expiryDate && announcement.expiryDate > now) return true;
      if (announcement.expiryType === 'AUTO_HIDE_AFTER_READ') return true;
      return false;
    })
    .map(a => a._id);

  const query = {
    _id: { $in: validAnnouncementIds }
  };

  const skip = (page - 1) * limit;

  const [announcements, total] = await Promise.all([
    Announcement.find(query)
      .populate('createdBy', 'name fullName')
      .sort({ isPinned: -1, priority: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Announcement.countDocuments(query)
  ]);

  // Get read status for each announcement
  const announcementIds = announcements.map(a => a._id);
  const readRecords = await AnnouncementRead.find({
    announcementId: { $in: announcementIds },
    veterinarianId
  });

  const readMap = new Map();
  readRecords.forEach(record => {
    readMap.set(record.announcementId.toString(), true);
  });

  // Filter by isRead if specified
  let filteredAnnouncements = announcements;
  if (isRead !== undefined) {
    const isReadBool = isRead === true || isRead === 'true';
    filteredAnnouncements = announcements.filter(announcement => {
      const isReadStatus = readMap.has(announcement._id.toString());
      return isReadBool ? isReadStatus : !isReadStatus;
    });
  }

  // Add read status and filter expired auto-hide announcements
  const announcementsWithStatus = filteredAnnouncements
    .filter(announcement => {
      // Hide if auto-hide after read and already read
      if (announcement.expiryType === 'AUTO_HIDE_AFTER_READ' && readMap.has(announcement._id.toString())) {
        return false;
      }
      return true;
    })
    .map(announcement => {
      const announcementObj = announcement.toObject();
      announcementObj.isRead = readMap.has(announcement._id.toString());
      return announcementObj;
    });

  return {
    announcements: announcementsWithStatus,
    pagination: {
      page,
      limit,
      total: filteredAnnouncements.length,
      pages: Math.ceil(filteredAnnouncements.length / limit)
    }
  };
};

/**
 * Get single announcement by ID
 * @param {string} announcementId - Announcement ID
 * @returns {Promise<Object>} Announcement
 */
const getAnnouncementById = async (announcementId) => {
  const announcement = await Announcement.findById(announcementId)
    .populate('createdBy', 'name email fullName')
    .populate('targetCriteria.specializationIds', 'name')
    .populate('targetCriteria.subscriptionPlanIds', 'name')
    .populate('targetCriteria.individualVeterinarianIds', 'name email fullName');

  if (!announcement) {
    throw new Error('Announcement not found');
  }

  return announcement;
};

/**
 * Update announcement
 * @param {string} announcementId - Announcement ID
 * @param {Object} data - Update data
 * @returns {Promise<Object>} Updated announcement
 */
const updateAnnouncement = async (announcementId, data) => {
  const announcement = await Announcement.findById(announcementId);

  if (!announcement) {
    throw new Error('Announcement not found');
  }

  // Update allowed fields
  if (data.title !== undefined) announcement.title = data.title;
  if (data.message !== undefined) announcement.message = data.message;
  if (data.image !== undefined) announcement.image = data.image;
  if (data.file !== undefined) announcement.file = data.file;
  if (data.link !== undefined) announcement.link = data.link;
  if (data.priority !== undefined) announcement.priority = data.priority;
  if (data.isPinned !== undefined) announcement.isPinned = data.isPinned;
  if (data.expiryType !== undefined) announcement.expiryType = data.expiryType;
  if (data.expiryDate !== undefined) announcement.expiryDate = data.expiryDate ? new Date(data.expiryDate) : null;
  if (data.isActive !== undefined) announcement.isActive = data.isActive;
  if (data.targetCriteria !== undefined) announcement.targetCriteria = data.targetCriteria;

  await announcement.save();

  return announcement;
};

/**
 * Delete announcement
 * @param {string} announcementId - Announcement ID
 * @returns {Promise<Object>} Success message
 */
const deleteAnnouncement = async (announcementId) => {
  const announcement = await Announcement.findById(announcementId);

  if (!announcement) {
    throw new Error('Announcement not found');
  }

  await Announcement.findByIdAndDelete(announcementId);
  // Also delete read records
  await AnnouncementRead.deleteMany({ announcementId });

  return { message: 'Announcement deleted successfully' };
};

/**
 * Mark announcement as read by veterinarian
 * @param {string} announcementId - Announcement ID
 * @param {string} veterinarianId - Veterinarian ID
 * @returns {Promise<Object>} Read record
 */
const markAnnouncementAsRead = async (announcementId, veterinarianId) => {
  const announcement = await Announcement.findById(announcementId);
  if (!announcement) {
    throw new Error('Announcement not found');
  }

  const veterinarian = await User.findById(veterinarianId);
  if (!veterinarian || veterinarian.role !== 'VETERINARIAN') {
    throw new Error('Veterinarian not found');
  }

  // Create or update read record
  const readRecord = await AnnouncementRead.findOneAndUpdate(
    { announcementId, veterinarianId },
    { isRead: true, readAt: new Date() },
    { upsert: true, new: true }
  );

  return readRecord;
};

/**
 * Get announcement read status (who has read it)
 * @param {string} announcementId - Announcement ID
 * @param {Object} options - Pagination options
 * @returns {Promise<Object>} Read records and pagination info
 */
const getAnnouncementReadStatus = async (announcementId, options = {}) => {
  const { page = 1, limit = 50 } = options;
  const skip = (page - 1) * limit;

  const [readRecords, total] = await Promise.all([
    AnnouncementRead.find({ announcementId })
      .populate('veterinarianId', 'name email profileImage fullName')
      .skip(skip)
      .limit(limit)
      .sort({ readAt: -1 }),
    AnnouncementRead.countDocuments({ announcementId })
  ]);

  return {
    readRecords,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };
};

/**
 * Get unread announcement count for veterinarian
 * @param {string} veterinarianId - Veterinarian ID
 * @returns {Promise<number>} Unread count
 */
const getUnreadAnnouncementCount = async (veterinarianId) => {
  const veterinarian = await User.findById(veterinarianId);
  if (!veterinarian || veterinarian.role !== 'VETERINARIAN') {
    return 0;
  }

  // Get all visible announcements
  const veterinarianProfile = await VeterinarianProfile.findOne({ userId: veterinarianId });
  const now = new Date();

  const visibilityQuery = {
    isActive: true,
    $or: [
      { announcementType: 'BROADCAST' },
      {
        announcementType: 'TARGETED',
        $or: [
          { 'targetCriteria.individualVeterinarianIds': veterinarianId },
          { 'targetCriteria.specializationIds': { $in: veterinarianProfile?.specializations || [] } },
          ...(veterinarianProfile?.clinics?.length > 0 ? veterinarianProfile.clinics.flatMap(clinic => [
            clinic.city ? { 'targetCriteria.location.city': { $regex: clinic.city, $options: 'i' } } : null,
            clinic.state ? { 'targetCriteria.location.state': { $regex: clinic.state, $options: 'i' } } : null,
            clinic.country ? { 'targetCriteria.location.country': { $regex: clinic.country, $options: 'i' } } : null
          ].filter(Boolean)) : [])
        ]
      }
    ]
  };

  const allMatchingAnnouncements = await Announcement.find(visibilityQuery).select('_id expiryType expiryDate');
  
  const validAnnouncementIds = allMatchingAnnouncements
    .filter(announcement => {
      if (announcement.expiryType === 'NO_EXPIRY') return true;
      if (announcement.expiryType === 'EXPIRE_AFTER_DATE' && announcement.expiryDate && announcement.expiryDate > now) return true;
      if (announcement.expiryType === 'AUTO_HIDE_AFTER_READ') return true;
      return false;
    })
    .map(a => a._id);

  // Get announcements
  const announcements = await Announcement.find({ _id: { $in: validAnnouncementIds } });
  
  // Get read records
  const readRecords = await AnnouncementRead.find({
    announcementId: { $in: validAnnouncementIds },
    veterinarianId
  });

  const readSet = new Set(readRecords.map(r => r.announcementId.toString()));

  // Count unread announcements
  const unreadCount = announcements.filter(announcement => {
    const isRead = readSet.has(announcement._id.toString());
    if (announcement.expiryType === 'AUTO_HIDE_AFTER_READ' && isRead) {
      return false;
    }
    return !isRead;
  }).length;

  return unreadCount;
};

module.exports = {
  createAnnouncement,
  listAnnouncements,
  getAnnouncementsForVeterinarian,
  getAnnouncementById,
  updateAnnouncement,
  deleteAnnouncement,
  markAnnouncementAsRead,
  getAnnouncementReadStatus,
  getUnreadAnnouncementCount
};
