const express = require('express');
const router = express.Router();
const rescheduleRequestController = require('../controllers/rescheduleRequest.controller');
const { authGuard } = require('../middleware/authGuard');
const asyncHandler = require('../middleware/asyncHandler');

/**
 * @route   GET /api/reschedule-request/eligible-appointments
 * @desc    Get appointments eligible for reschedule (pet owner only)
 * @access  Private (PET_OWNER)
 */
router.get(
  '/eligible-appointments',
  authGuard(['PET_OWNER']),
  asyncHandler(rescheduleRequestController.getEligibleAppointments)
);

/**
 * @route   POST /api/reschedule-request
 * @desc    Create reschedule request (pet owner only)
 * @access  Private (PET_OWNER)
 */
router.post(
  '/',
  authGuard(['PET_OWNER']),
  asyncHandler(rescheduleRequestController.create)
);

/**
 * @route   GET /api/reschedule-request
 * @desc    List reschedule requests (filtered by role)
 * @access  Private
 */
router.get(
  '/',
  authGuard(),
  asyncHandler(rescheduleRequestController.list)
);

/**
 * @route   GET /api/reschedule-request/:id
 * @desc    Get reschedule request by ID
 * @access  Private
 */
router.get(
  '/:id',
  authGuard(),
  asyncHandler(rescheduleRequestController.getById)
);

/**
 * @route   POST /api/reschedule-request/:id/approve
 * @desc    Approve reschedule request (veterinarian only)
 * @access  Private (VETERINARIAN)
 */
router.post(
  '/:id/approve',
  authGuard(['VETERINARIAN']),
  asyncHandler(rescheduleRequestController.approve)
);

/**
 * @route   POST /api/reschedule-request/:id/reject
 * @desc    Reject reschedule request (veterinarian only)
 * @access  Private (VETERINARIAN)
 */
router.post(
  '/:id/reject',
  authGuard(['VETERINARIAN']),
  asyncHandler(rescheduleRequestController.reject)
);

/**
 * @route   POST /api/reschedule-request/:id/pay
 * @desc    Pay reschedule fee (pet owner only)
 * @access  Private (PET_OWNER)
 */
router.post(
  '/:id/pay',
  authGuard(['PET_OWNER']),
  asyncHandler(rescheduleRequestController.pay)
);

module.exports = router;
