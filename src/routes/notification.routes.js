const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notification.controller');
const { authGuard } = require('../middleware/authGuard');
const asyncHandler = require('../middleware/asyncHandler');

router.use(authGuard());

/**
 * Create notification
 */
router.post('/', asyncHandler(notificationController.create));

/**
 * List notifications
 */
router.get('/', asyncHandler(notificationController.list));

/**
 * Mark notification as read
 */
router.put('/:id/read', asyncHandler(notificationController.markRead));

/**
 * Mark all notifications as read
 */
router.put('/read-all', asyncHandler(notificationController.markAllRead));

/**
 * Get unread notifications count
 */
router.get('/unread-count', asyncHandler(notificationController.getUnreadCount));

module.exports = router;
