const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chat.controller');
const { authGuard } = require('../middleware/authGuard');
const asyncHandler = require('../middleware/asyncHandler');

router.use(authGuard());

/**
 * Send message
 */
router.post('/send', asyncHandler(chatController.sendMessage));

/**
 * Get or create conversation
 */
router.post('/conversation', asyncHandler(chatController.getOrCreateConversation));

/**
 * Get conversations
 */
router.get('/conversations', asyncHandler(chatController.getConversations));

/**
 * Get messages for conversation
 */
router.get('/messages/:conversationId', asyncHandler(chatController.getMessages));

/**
 * Mark messages as read
 */
router.post('/conversations/:conversationId/read', asyncHandler(chatController.markMessagesAsRead));

/**
 * Get unread count
 */
router.get('/unread-count', asyncHandler(chatController.getUnreadCount));

module.exports = router;
