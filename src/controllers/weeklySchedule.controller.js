const asyncHandler = require('../middleware/asyncHandler');
const weeklyScheduleService = require('../services/weeklySchedule.service');
const { sendSuccess } = require('../utils/response');

/**
 * Create or update weekly schedule
 */
exports.upsertSchedule = asyncHandler(async (req, res) => {
  const result = await weeklyScheduleService.upsertSchedule(req.userId, req.body);
  return sendSuccess(res, 'Schedule updated successfully', result);
});

/**
 * Get weekly schedule
 */
exports.getSchedule = asyncHandler(async (req, res) => {
  const result = await weeklyScheduleService.getSchedule(req.userId);
  return sendSuccess(res, 'OK', result);
});

/**
 * Update appointment duration
 */
exports.updateAppointmentDuration = asyncHandler(async (req, res) => {
  const result = await weeklyScheduleService.updateAppointmentDuration(req.userId, req.body.duration);
  return sendSuccess(res, 'Appointment duration updated successfully', result);
});

/**
 * Add time slot to a day
 */
exports.addTimeSlot = asyncHandler(async (req, res) => {
  const { dayOfWeek } = req.params;
  const result = await weeklyScheduleService.addTimeSlot(req.userId, dayOfWeek, req.body);
  return sendSuccess(res, 'Time slot added successfully', result);
});

/**
 * Update time slot
 */
exports.updateTimeSlot = asyncHandler(async (req, res) => {
  const { dayOfWeek, slotId } = req.params;
  const result = await weeklyScheduleService.updateTimeSlot(req.userId, dayOfWeek, slotId, req.body);
  return sendSuccess(res, 'Time slot updated successfully', result);
});

/**
 * Delete time slot
 */
exports.deleteTimeSlot = asyncHandler(async (req, res) => {
  const { dayOfWeek, slotId } = req.params;
  const result = await weeklyScheduleService.deleteTimeSlot(req.userId, dayOfWeek, slotId);
  return sendSuccess(res, 'Time slot deleted successfully', result);
});

/**
 * Get available slots for a date (public)
 */
exports.getAvailableSlotsForDate = asyncHandler(async (req, res) => {
  const { veterinarianId, date } = req.query;
  const result = await weeklyScheduleService.getAvailableSlotsForDate(veterinarianId, date);
  return sendSuccess(res, 'OK', result);
});
