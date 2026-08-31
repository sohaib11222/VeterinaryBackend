const path = require('path');

const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess } = require('../utils/response');
const supportTicketService = require('../services/supportTicket.service');

exports.uploadAttachments = asyncHandler(async (req, res) => {
  const attachments = await supportTicketService.createUploadedAttachments(req.files, req.userId);
  return sendSuccess(res, 'Attachments uploaded successfully', {
    attachments: attachments.map(supportTicketService.attachmentDto),
  }, 201);
});

exports.listMine = asyncHandler(async (req, res) => {
  const result = await supportTicketService.listPatientTickets(req.userId, req.userRole, req.query);
  return sendSuccess(res, 'OK', result);
});

exports.getMine = asyncHandler(async (req, res) => {
  const result = await supportTicketService.getPatientTicket(req.params.ticketId, req.userId, req.userRole);
  return sendSuccess(res, 'OK', result);
});

exports.create = asyncHandler(async (req, res) => {
  const result = await supportTicketService.createPatientTicket(req.userId, req.userRole, req.body);
  return sendSuccess(res, 'Support ticket created', result, 201);
});

exports.reply = asyncHandler(async (req, res) => {
  const result = await supportTicketService.addPatientMessage(req.params.ticketId, req.userId, req.userRole, req.body);
  return sendSuccess(res, 'Reply sent', result, 201);
});

exports.reopen = asyncHandler(async (req, res) => {
  const result = await supportTicketService.reopenPatientTicket(req.params.ticketId, req.userId, req.userRole);
  return sendSuccess(res, 'Support ticket reopened', result);
});

exports.getMyUnreadCount = asyncHandler(async (req, res) => {
  const result = await supportTicketService.getPatientUnreadCount(req.userId, req.userRole);
  return sendSuccess(res, 'OK', result);
});

exports.listAdmin = asyncHandler(async (req, res) => {
  const result = await supportTicketService.listAdminTickets(req.query);
  return sendSuccess(res, 'OK', result);
});

exports.getAdmin = asyncHandler(async (req, res) => {
  const result = await supportTicketService.getAdminTicket(req.params.ticketId);
  return sendSuccess(res, 'OK', result);
});

exports.updateAdmin = asyncHandler(async (req, res) => {
  const result = await supportTicketService.updateAdminTicket(req.params.ticketId, req.userId, req.body);
  return sendSuccess(res, 'Support ticket updated', result);
});

exports.replyAdmin = asyncHandler(async (req, res) => {
  const result = await supportTicketService.addAdminMessage(req.params.ticketId, req.userId, req.body);
  return sendSuccess(res, 'Reply sent', result, 201);
});

exports.getAdminUnreadCount = asyncHandler(async (req, res) => {
  const result = await supportTicketService.getAdminUnreadCount();
  return sendSuccess(res, 'OK', result);
});

exports.downloadAttachment = asyncHandler(async (req, res) => {
  const { attachment, filePath } = await supportTicketService.getAttachmentFile(req.params.attachmentId, req.userId, req.userRole);
  const safeName = path.basename(attachment.originalName).replace(/[\r\n"]/g, '_');
  res.setHeader('Content-Type', attachment.mimeType || 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);
  return res.sendFile(filePath);
});
