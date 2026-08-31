const express = require('express');

const supportTicketController = require('../controllers/supportTicket.controller');
const { authGuard } = require('../middleware/authGuard');
const { uploadMultipleImages } = require('../middleware/upload.middleware');

const router = express.Router();

// Support evidence is private and can only be downloaded through the guarded route below.
router.post(
  '/attachments',
  authGuard(['PET_OWNER', 'ADMIN']),
  uploadMultipleImages('supportTicket', 5),
  supportTicketController.uploadAttachments,
);

router.get('/attachments/:attachmentId/download', authGuard(['PET_OWNER', 'ADMIN']), supportTicketController.downloadAttachment);

router.get('/admin', authGuard(['ADMIN']), supportTicketController.listAdmin);
router.get('/admin/unread-count', authGuard(['ADMIN']), supportTicketController.getAdminUnreadCount);
router.get('/admin/:ticketId', authGuard(['ADMIN']), supportTicketController.getAdmin);
router.patch('/admin/:ticketId', authGuard(['ADMIN']), supportTicketController.updateAdmin);
router.post('/admin/:ticketId/messages', authGuard(['ADMIN']), supportTicketController.replyAdmin);

router.get('/unread-count', authGuard(['PET_OWNER']), supportTicketController.getMyUnreadCount);
router.get('/', authGuard(['PET_OWNER']), supportTicketController.listMine);
router.post('/', authGuard(['PET_OWNER']), supportTicketController.create);
router.get('/:ticketId', authGuard(['PET_OWNER']), supportTicketController.getMine);
router.post('/:ticketId/messages', authGuard(['PET_OWNER']), supportTicketController.reply);
router.post('/:ticketId/reopen', authGuard(['PET_OWNER']), supportTicketController.reopen);

module.exports = router;
