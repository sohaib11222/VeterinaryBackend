const express = require('express');
const router = express.Router();
const medicalRecordController = require('../controllers/medicalRecord.controller');
const { authGuard } = require('../middleware/authGuard');
const asyncHandler = require('../middleware/asyncHandler');

router.use(authGuard());

/**
 * Create medical record
 */
router.post('/', asyncHandler(medicalRecordController.create));

/**
 * Get medical records
 */
router.get('/', asyncHandler(medicalRecordController.list));

/**
 * Get medical record by ID
 */
router.get('/:id', asyncHandler(medicalRecordController.getById));

/**
 * Delete medical record
 */
router.delete('/:id', asyncHandler(medicalRecordController.delete));

module.exports = router;
