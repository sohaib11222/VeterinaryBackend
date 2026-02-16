const asyncHandler = require('../middleware/asyncHandler');
const appointmentService = require('../services/appointment.service');
const { sendSuccess } = require('../utils/response');

/**
 * Create appointment
 */
exports.create = asyncHandler(async (req, res) => {
  const appointmentData = {
    ...req.body,
    createdBy: req.userId
  };
  const result = await appointmentService.createAppointment(appointmentData);
  return sendSuccess(res, 'Appointment created successfully', result, 201);
});

/**
 * Update appointment status
 */
exports.updateStatus = asyncHandler(async (req, res) => {
  const result = await appointmentService.updateAppointmentStatus(req.params.id, req.body);
  return sendSuccess(res, 'Appointment status updated successfully', result);
});

/**
 * List appointments with filtering
 * Automatically filters by veterinarianId for veterinarians and petOwnerId for pet owners
 */
exports.list = asyncHandler(async (req, res) => {
  const filter = { ...req.query };
  
  if (req.userRole === 'VETERINARIAN') {
    filter.veterinarianId = req.userId;
  } else if (req.userRole === 'PET_OWNER') {
    filter.petOwnerId = req.userId;
  }
  // Admin can see all appointments (no auto-filter)
  
  const result = await appointmentService.listAppointments(filter);
  return sendSuccess(res, 'OK', result);
});

/**
 * Get appointment by ID
 */
exports.getById = asyncHandler(async (req, res) => {
  const result = await appointmentService.getAppointment(req.params.id, req.userId, req.userRole);
  return sendSuccess(res, 'OK', result);
});

/**
 * Accept appointment (veterinarian action)
 */
exports.accept = asyncHandler(async (req, res) => {
  const result = await appointmentService.acceptAppointment(req.params.id, req.userId);
  return sendSuccess(res, 'Appointment accepted successfully', result);
});

/**
 * Reject appointment (veterinarian action)
 */
exports.reject = asyncHandler(async (req, res) => {
  const { reason } = req.body;
  const result = await appointmentService.rejectAppointment(req.params.id, req.userId, reason);
  return sendSuccess(res, 'Appointment rejected successfully', result);
});

/**
 * Cancel appointment (pet owner action)
 */
exports.cancel = asyncHandler(async (req, res) => {
  const { reason } = req.body;
  const result = await appointmentService.cancelAppointment(req.params.id, req.userId, reason);
  return sendSuccess(res, 'Appointment cancelled successfully', result);
});

/**
 * Complete appointment (veterinarian action)
 */
exports.complete = asyncHandler(async (req, res) => {
  const result = await appointmentService.completeAppointment(req.params.id, req.userId, req.body);
  return sendSuccess(res, 'Appointment completed successfully', result);
});
