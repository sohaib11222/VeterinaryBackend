const express = require('express');
const router = express.Router();
const availabilityController = require('../controllers/availability.controller');
const { authGuard } = require('../middleware/authGuard');
const asyncHandler = require('../middleware/asyncHandler');

/**
 * @route   POST /api/availability
 * @desc    Set veterinarian availability
 * @access  Private (VETERINARIAN)
 */
router.post(
  '/',
  authGuard(['VETERINARIAN']),
  asyncHandler(availabilityController.setAvailability)
);

/**
 * @route   GET /api/availability
 * @desc    Get veterinarian availability
 * @access  Private (VETERINARIAN)
 */
router.get(
  '/',
  authGuard(['VETERINARIAN']),
  asyncHandler(availabilityController.getAvailability)
);

/**
 * @route   GET /api/availability/slots
 * @desc    Get available time slots (public)
 * @access  Public
 */
router.get(
  '/slots',
  asyncHandler(availabilityController.getAvailableSlots)
);

/**
 * @route   GET /api/availability/check
 * @desc    Check time slot availability (public)
 * @access  Public
 */
router.get(
  '/check',
  asyncHandler(availabilityController.checkTimeSlot)
);

module.exports = router;
