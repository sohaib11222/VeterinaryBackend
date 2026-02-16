const express = require('express');
const router = express.Router();
const weeklyScheduleController = require('../controllers/weeklySchedule.controller');
const { authGuard } = require('../middleware/authGuard');
const asyncHandler = require('../middleware/asyncHandler');

/**
 * @route   POST /api/weekly-schedule
 * @desc    Create or update weekly schedule
 * @access  Private (VETERINARIAN)
 */
router.post(
  '/',
  authGuard(['VETERINARIAN']),
  asyncHandler(weeklyScheduleController.upsertSchedule)
);

/**
 * @route   GET /api/weekly-schedule
 * @desc    Get weekly schedule
 * @access  Private (VETERINARIAN)
 */
router.get(
  '/',
  authGuard(['VETERINARIAN']),
  asyncHandler(weeklyScheduleController.getSchedule)
);

/**
 * @route   PUT /api/weekly-schedule/duration
 * @desc    Update appointment duration
 * @access  Private (VETERINARIAN)
 */
router.put(
  '/duration',
  authGuard(['VETERINARIAN']),
  asyncHandler(weeklyScheduleController.updateAppointmentDuration)
);

/**
 * @route   POST /api/weekly-schedule/day/:dayOfWeek/slot
 * @desc    Add time slot to a day
 * @access  Private (VETERINARIAN)
 */
router.post(
  '/day/:dayOfWeek/slot',
  authGuard(['VETERINARIAN']),
  asyncHandler(weeklyScheduleController.addTimeSlot)
);

/**
 * @route   PUT /api/weekly-schedule/day/:dayOfWeek/slot/:slotId
 * @desc    Update time slot
 * @access  Private (VETERINARIAN)
 */
router.put(
  '/day/:dayOfWeek/slot/:slotId',
  authGuard(['VETERINARIAN']),
  asyncHandler(weeklyScheduleController.updateTimeSlot)
);

/**
 * @route   DELETE /api/weekly-schedule/day/:dayOfWeek/slot/:slotId
 * @desc    Delete time slot
 * @access  Private (VETERINARIAN)
 */
router.delete(
  '/day/:dayOfWeek/slot/:slotId',
  authGuard(['VETERINARIAN']),
  asyncHandler(weeklyScheduleController.deleteTimeSlot)
);

/**
 * @route   GET /api/weekly-schedule/slots
 * @desc    Get available slots for a date (public)
 * @access  Public
 */
router.get(
  '/slots',
  asyncHandler(weeklyScheduleController.getAvailableSlotsForDate)
);

module.exports = router;
