const express = require('express');
const router = express.Router();
const weightRecordController = require('../controllers/weightRecord.controller');
const { authGuard, requireRole } = require('../middleware/authGuard');
const asyncHandler = require('../middleware/asyncHandler');

router.use(authGuard());

/**
 * Get weight records
 */
router.get('/', asyncHandler(weightRecordController.list));

/**
 * Get weight record by ID
 */
router.get('/:id', asyncHandler(weightRecordController.getById));

router.use(requireRole('VETERINARIAN', 'ADMIN'));

/**
 * Create weight record
 */
router.post('/', asyncHandler(weightRecordController.create));

/**
 * Update weight record
 */
router.put('/:id', asyncHandler(weightRecordController.update));

/**
 * Delete weight record
 */
router.delete('/:id', asyncHandler(weightRecordController.delete));

module.exports = router;
