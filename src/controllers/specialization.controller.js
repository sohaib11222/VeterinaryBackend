const asyncHandler = require('../middleware/asyncHandler');
const specializationService = require('../services/specialization.service');
const { sendSuccess } = require('../utils/response');

/**
 * Create specialization
 */
exports.create = asyncHandler(async (req, res) => {
  const result = await specializationService.createSpecialization(req.body);
  return sendSuccess(res, 'Specialization created successfully', result, 201);
});

/**
 * Update specialization
 */
exports.update = asyncHandler(async (req, res) => {
  const result = await specializationService.updateSpecialization(req.params.id, req.body);
  return sendSuccess(res, 'Specialization updated successfully', result);
});

/**
 * List all specializations
 */
exports.list = asyncHandler(async (req, res) => {
  const result = await specializationService.listSpecializations();
  return sendSuccess(res, 'OK', result);
});

/**
 * Delete specialization
 */
exports.delete = asyncHandler(async (req, res) => {
  await specializationService.deleteSpecialization(req.params.id);
  return sendSuccess(res, 'Specialization deleted successfully');
});
