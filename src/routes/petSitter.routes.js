const express = require('express');
const router = express.Router();
const controller = require('../controllers/petSitter.controller');
const { authGuard, requireApproved } = require('../middleware/authGuard');
const asyncHandler = require('../middleware/asyncHandler');

router.get('/me/profile', authGuard(['PET_SITTER']), asyncHandler(controller.getMine));
router.patch('/me/profile', authGuard(['PET_SITTER']), requireApproved, asyncHandler(controller.updateMine));
router.get('/', asyncHandler(controller.listPublic));
router.get('/:id', asyncHandler(controller.getPublic));

module.exports = router;
