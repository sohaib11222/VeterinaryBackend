const express = require('express');
const router = express.Router();
const controller = require('../controllers/petSitter.controller');
const { authGuard, requireApproved } = require('../middleware/authGuard');
const asyncHandler = require('../middleware/asyncHandler');
const { uploadMultipleImages } = require('../middleware/upload.middleware');

router.get('/me/profile', authGuard(['PET_SITTER']), asyncHandler(controller.getMine));
router.patch('/me/profile', authGuard(['PET_SITTER']), requireApproved, asyncHandler(controller.updateMine));
router.post('/me/documents', authGuard(['PET_SITTER']), requireApproved, uploadMultipleImages('petSitterDocs', 5), asyncHandler(controller.uploadDocuments));
router.get('/', asyncHandler(controller.listPublic));
router.get('/:id', asyncHandler(controller.getPublic));

module.exports = router;
