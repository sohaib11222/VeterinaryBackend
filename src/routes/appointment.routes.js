const express = require('express');
const router = express.Router();
const appointmentController = require('../controllers/appointment.controller');
const { authGuard } = require('../middleware/authGuard');
const asyncHandler = require('../middleware/asyncHandler');

// All routes require authentication
router.use(authGuard());

/**
 * Create appointment
 */
router.post('/', asyncHandler(appointmentController.create));

/**
 * List appointments (auto-filtered by role)
 */
router.get('/', asyncHandler(appointmentController.list));

/**
 * Get appointment by ID
 */
router.get('/:id', asyncHandler(appointmentController.getById));

/**
 * Accept appointment (veterinarian only)
 */
router.post('/:id/accept', asyncHandler(appointmentController.accept));

/**
 * Reject appointment (veterinarian only)
 */
router.post('/:id/reject', asyncHandler(appointmentController.reject));

/**
 * Cancel appointment (pet owner only)
 */
router.post('/:id/cancel', asyncHandler(appointmentController.cancel));

/**
 * Complete appointment (veterinarian only)
 */
router.post('/:id/complete', asyncHandler(appointmentController.complete));

/**
 * Update appointment status
 */
router.put('/:id/status', asyncHandler(appointmentController.updateStatus));

module.exports = router;
