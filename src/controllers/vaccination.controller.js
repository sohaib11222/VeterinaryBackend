const asyncHandler = require('../middleware/asyncHandler');
const vaccinationService = require('../services/vaccination.service');
const { sendSuccess } = require('../utils/response');

/**
 * Create vaccination
 */
exports.create = asyncHandler(async (req, res) => {
  const result = await vaccinationService.createVaccination(req.userId, req.userRole, req.body);
  return sendSuccess(res, 'Vaccination record created successfully', result, 201);
});

/**
 * Get vaccinations
 */
exports.list = asyncHandler(async (req, res) => {
  const result = await vaccinationService.getVaccinations(req.userId, req.userRole, req.query);
  return sendSuccess(res, 'OK', result);
});

/**
 * Get upcoming vaccinations
 */
exports.getUpcoming = asyncHandler(async (req, res) => {
  const result = await vaccinationService.getUpcomingVaccinations(req.userId, req.userRole, req.query);
  return sendSuccess(res, 'OK', result);
});

/**
 * Update vaccination
 */
exports.update = asyncHandler(async (req, res) => {
  const result = await vaccinationService.updateVaccination(req.params.id, req.userId, req.userRole, req.body);
  return sendSuccess(res, 'Vaccination updated successfully', result);
});

/**
 * Delete vaccination
 */
exports.delete = asyncHandler(async (req, res) => {
  await vaccinationService.deleteVaccination(req.params.id, req.userId, req.userRole);
  return sendSuccess(res, 'Vaccination deleted successfully');
});
