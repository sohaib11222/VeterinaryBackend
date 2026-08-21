const asyncHandler = require('../middleware/asyncHandler');
const adminService = require('../services/admin.service');
const { sendSuccess } = require('../utils/response');

/**
 * Get admin dashboard statistics
 */
exports.getDashboard = asyncHandler(async (req, res) => {
  const result = await adminService.getDashboardStats();
  return sendSuccess(res, 'OK', result);
});

/**
 * Get compact sidebar change markers (Admin only)
 */
exports.getSidebarIndicators = asyncHandler(async (req, res) => {
  const result = await adminService.getSidebarIndicators();
  return sendSuccess(res, 'OK', result);
});

/**
 * Get all users
 */
exports.getUsers = asyncHandler(async (req, res) => {
  const result = await adminService.getUsers(req.query);
  return sendSuccess(res, 'OK', result);
});

/**
 * Get all appointments
 */
exports.getAppointments = asyncHandler(async (req, res) => {
  const appointmentService = require('../services/appointment.service');
  const result = await appointmentService.listAppointments(req.query);
  return sendSuccess(res, 'OK', result);
});

/**
 * Get all transactions
 */
exports.getTransactions = asyncHandler(async (req, res) => {
  const result = await adminService.getAllTransactions(req.query);
  return sendSuccess(res, 'OK', result);
});

/**
 * Get all reviews
 */
exports.getReviews = asyncHandler(async (req, res) => {
  const result = await adminService.getAllReviews(req.query);
  return sendSuccess(res, 'OK', result);
});

/**
 * Get all pets
 */
exports.getPets = asyncHandler(async (req, res) => {
  const result = await adminService.getAllPets(req.query);
  return sendSuccess(res, 'OK', result);
});

/**
 * Get all medical records
 */
exports.getMedicalRecords = asyncHandler(async (req, res) => {
  const result = await adminService.getAllMedicalRecords(req.query);
  return sendSuccess(res, 'OK', result);
});

/**
 * Delete medical record
 */
exports.deleteMedicalRecord = asyncHandler(async (req, res) => {
  const result = await adminService.deleteMedicalRecordAdmin(req.params.id);
  return sendSuccess(res, 'Medical record deleted successfully', result);
});

/**
 * Get system activity
 */
exports.getSystemActivity = asyncHandler(async (req, res) => {
  const result = await adminService.getSystemActivity(req.query);
  return sendSuccess(res, 'OK', result);
});
