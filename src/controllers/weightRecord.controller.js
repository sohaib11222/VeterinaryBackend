const asyncHandler = require('../middleware/asyncHandler');
const weightRecordService = require('../services/weightRecord.service');
const { sendSuccess } = require('../utils/response');

/**
 * Create weight record
 */
exports.create = asyncHandler(async (req, res) => {
  const result = await weightRecordService.createWeightRecord(req.userId, req.userRole, req.body);
  return sendSuccess(res, 'Weight record created successfully', result, 201);
});

/**
 * Get weight records
 */
exports.list = asyncHandler(async (req, res) => {
  const result = await weightRecordService.getWeightRecords(req.userId, req.userRole, req.query);
  return sendSuccess(res, 'OK', result);
});

/**
 * Get weight record by ID
 */
exports.getById = asyncHandler(async (req, res) => {
  const result = await weightRecordService.getWeightRecord(req.params.id, req.userId, req.userRole);
  return sendSuccess(res, 'OK', result);
});

/**
 * Update weight record
 */
exports.update = asyncHandler(async (req, res) => {
  const result = await weightRecordService.updateWeightRecord(req.params.id, req.userId, req.userRole, req.body);
  return sendSuccess(res, 'Weight record updated successfully', result);
});

/**
 * Delete weight record
 */
exports.delete = asyncHandler(async (req, res) => {
  await weightRecordService.deleteWeightRecord(req.params.id, req.userId, req.userRole);
  return sendSuccess(res, 'Weight record deleted successfully');
});
