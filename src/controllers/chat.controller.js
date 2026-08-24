const asyncHandler = require('../middleware/asyncHandler');
const chatService = require('../services/chat.service');
const { sendSuccess } = require('../utils/response');

/**
 * Send message
 */
exports.sendMessage = asyncHandler(async (req, res) => {
  const messageData = {
    ...req.body,
    senderId: req.userId
  };
  const result = await chatService.sendMessage(messageData);
  return sendSuccess(res, 'Message sent successfully', result);
});

/**
 * Get messages for conversation
 */
exports.getMessages = asyncHandler(async (req, res) => {
  const result = await chatService.getMessages(req.params.conversationId, req.userId, req.query);
  return sendSuccess(res, 'OK', result);
});

/**
 * Get or create conversation
 */
exports.getOrCreateConversation = asyncHandler(async (req, res) => {
  const { veterinarianId, petOwnerId, businessId, appointmentId } = req.body;
  const adminId = req.userRole === 'ADMIN' ? req.userId : req.body.adminId;
  const result = await chatService.getOrCreateConversation(
    veterinarianId,
    petOwnerId,
    adminId,
    appointmentId,
    req.userId,
    businessId
  );
  return sendSuccess(res, 'OK', result);
});

/**
 * Get conversations for current user
 */
exports.getConversations = asyncHandler(async (req, res) => {
  const result = await chatService.getConversations(req.userId, req.userRole, req.query);
  return sendSuccess(res, 'OK', result);
});

/**
 * Mark messages as read
 */
exports.markMessagesAsRead = asyncHandler(async (req, res) => {
  const result = await chatService.markMessagesAsRead(req.params.conversationId, req.userId);
  return sendSuccess(res, 'Messages marked as read', result);
});

/**
 * Get unread message count
 */
exports.getUnreadCount = asyncHandler(async (req, res) => {
  const result = await chatService.getUnreadCount(req.userId, req.userRole);
  return sendSuccess(res, 'OK', { unreadCount: result });
});

/**
 * Mark conversation as completed (Veterinarian only)
 */
exports.markConversationComplete = asyncHandler(async (req, res) => {
  const { conversationId } = req.params;
  const result = await chatService.markConversationComplete(conversationId, req.userId);
  return sendSuccess(res, 'Conversation marked as completed', result);
});
