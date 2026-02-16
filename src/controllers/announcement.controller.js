const asyncHandler = require('../middleware/asyncHandler');
const announcementService = require('../services/announcement.service');
const { sendSuccess } = require('../utils/response');

/**
 * Create announcement
 */
exports.create = asyncHandler(async (req, res) => {
  const announcementData = {
    ...req.body,
    createdBy: req.userId
  };
  const result = await announcementService.createAnnouncement(announcementData);
  return sendSuccess(res, 'Announcement created successfully', result, 201);
});

/**
 * List announcements (admin)
 */
exports.list = asyncHandler(async (req, res) => {
  const result = await announcementService.listAnnouncements(req.query);
  return sendSuccess(res, 'OK', result);
});

/**
 * Get announcements for veterinarian
 */
exports.getForVeterinarian = asyncHandler(async (req, res) => {
  const result = await announcementService.getAnnouncementsForVeterinarian(req.userId, req.query);
  return sendSuccess(res, 'OK', result);
});

/**
 * Get single announcement
 */
exports.getById = asyncHandler(async (req, res) => {
  const result = await announcementService.getAnnouncementById(req.params.id);
  return sendSuccess(res, 'OK', result);
});

/**
 * Update announcement
 */
exports.update = asyncHandler(async (req, res) => {
  const result = await announcementService.updateAnnouncement(req.params.id, req.body);
  return sendSuccess(res, 'Announcement updated successfully', result);
});

/**
 * Delete announcement
 */
exports.delete = asyncHandler(async (req, res) => {
  await announcementService.deleteAnnouncement(req.params.id);
  return sendSuccess(res, 'Announcement deleted successfully');
});

/**
 * Mark announcement as read
 */
exports.markAsRead = asyncHandler(async (req, res) => {
  const result = await announcementService.markAnnouncementAsRead(req.params.id, req.userId);
  return sendSuccess(res, 'Announcement marked as read', result);
});

/**
 * Get announcement read status
 */
exports.getReadStatus = asyncHandler(async (req, res) => {
  const result = await announcementService.getAnnouncementReadStatus(req.params.id, req.query);
  return sendSuccess(res, 'OK', result);
});

/**
 * Get unread announcement count
 */
exports.getUnreadCount = asyncHandler(async (req, res) => {
  const count = await announcementService.getUnreadAnnouncementCount(req.userId);
  return sendSuccess(res, 'OK', { unreadCount: count });
});
