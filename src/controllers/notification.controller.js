const asyncHandler = require('../middleware/asyncHandler');
const notificationService = require('../services/notification.service');
const { sendSuccess } = require('../utils/response');

/**
 * Create notification
 */
exports.create = asyncHandler(async (req, res) => {
  const result = await notificationService.createNotification(req.body);
  return sendSuccess(res, 'Notification created successfully', result, 201);
});

/**
 * List notifications for current user
 */
exports.list = asyncHandler(async (req, res) => {
  const result = await notificationService.listNotifications(req.userId, req.query);
  return sendSuccess(res, 'OK', result);
});

/**
 * Mark notification as read
 */
exports.markRead = asyncHandler(async (req, res) => {
  const result = await notificationService.markNotificationRead(req.params.id, req.userId);
  return sendSuccess(res, 'Notification marked as read', result);
});

/**
 * Mark all notifications as read
 */
exports.markAllRead = asyncHandler(async (req, res) => {
  const result = await notificationService.markAllNotificationsRead(req.userId);
  return sendSuccess(res, 'All notifications marked as read', result);
});

/**
 * Get unread notifications count
 */
exports.getUnreadCount = asyncHandler(async (req, res) => {
  const result = await notificationService.getUnreadCount(req.userId);
  return sendSuccess(res, 'OK', result);
});
