const Notification = require('../models/Notification');
const User = require('../models/User');
const { validateObjectId } = require('../utils/validation');

/**
 * Create notification
 */
const createNotification = async (data) => {
  const { userId, title, body, type, data: notificationData } = data;

  validateObjectId(userId, 'User ID');
  
  const user = await User.findById(userId);
  if (!user) {
    throw new Error('User not found');
  }

  const notification = await Notification.create({
    userId,
    title,
    body,
    type: type || 'SYSTEM',
    data: notificationData || null,
    isRead: false
  });

  return notification;
};

/**
 * Mark notification as read
 */
const markNotificationRead = async (notificationId, userId) => {
  const notification = await Notification.findById(notificationId);
  
  if (!notification) {
    throw new Error('Notification not found');
  }

  if (notification.userId.toString() !== userId.toString()) {
    throw new Error('Unauthorized: Notification does not belong to this user');
  }

  notification.isRead = true;
  await notification.save();

  return notification;
};

/**
 * Mark all notifications as read
 */
const markAllNotificationsRead = async (userId) => {
  const result = await Notification.updateMany(
    { userId, isRead: false },
    { isRead: true }
  );

  return { updatedCount: result.modifiedCount };
};

/**
 * List notifications for user
 */
const listNotifications = async (userId, options = {}) => {
  const {
    type,
    unreadOnly,
    page = 1,
    limit = 20
  } = options;

  const query = { userId };

  if (type) {
    query.type = type.toUpperCase();
  }

  if (unreadOnly === true || unreadOnly === 'true') {
    query.isRead = false;
  }

  const skip = (page - 1) * limit;

  const [notifications, total] = await Promise.all([
    Notification.find(query)
      .select('title body type data isRead createdAt')
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 })
      .lean()
      .maxTimeMS(2000),
    Notification.countDocuments(query).maxTimeMS(2000)
  ]);

  return {
    notifications,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };
};

/**
 * Get unread notifications count
 */
const getUnreadCount = async (userId) => {
  const count = await Notification.countDocuments({
    userId,
    isRead: false
  }).maxTimeMS(2000);

  return { unreadCount: count };
};

module.exports = {
  createNotification,
  markNotificationRead,
  markAllNotificationsRead,
  listNotifications,
  getUnreadCount
};
