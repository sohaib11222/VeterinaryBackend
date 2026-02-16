const asyncHandler = require('../middleware/asyncHandler');
const availabilityService = require('../services/availability.service');
const { sendSuccess } = require('../utils/response');

/**
 * Set veterinarian availability
 */
exports.setAvailability = asyncHandler(async (req, res) => {
  const result = await availabilityService.setAvailability(req.userId, req.body);
  return sendSuccess(res, 'Availability set successfully', result);
});

/**
 * Get veterinarian availability
 */
exports.getAvailability = asyncHandler(async (req, res) => {
  const result = await availabilityService.getAvailability(req.userId, req.query);
  return sendSuccess(res, 'OK', result);
});

/**
 * Get available time slots (public)
 */
exports.getAvailableSlots = asyncHandler(async (req, res) => {
  const { veterinarianId, date } = req.query;
  const result = await availabilityService.getAvailableSlots(veterinarianId, date);
  return sendSuccess(res, 'OK', result);
});

/**
 * Check time slot availability (public)
 */
exports.checkTimeSlot = asyncHandler(async (req, res) => {
  const { veterinarianId, date, timeSlot } = req.query;
  const result = await availabilityService.isTimeSlotAvailable(veterinarianId, date, timeSlot);
  return sendSuccess(res, 'OK', { available: result });
});
