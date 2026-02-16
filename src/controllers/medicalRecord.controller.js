const asyncHandler = require('../middleware/asyncHandler');
const medicalRecordService = require('../services/medicalRecord.service');
const { sendSuccess } = require('../utils/response');

/**
 * Create medical record
 */
exports.create = asyncHandler(async (req, res) => {
  const result = await medicalRecordService.createMedicalRecord(req.userId, req.body);
  return sendSuccess(res, 'Medical record created successfully', result, 201);
});

/**
 * Get medical records
 */
exports.list = asyncHandler(async (req, res) => {
  const result = await medicalRecordService.getMedicalRecords(req.userId, req.query);
  return sendSuccess(res, 'OK', result);
});

/**
 * Get medical record by ID
 */
exports.getById = asyncHandler(async (req, res) => {
  const result = await medicalRecordService.getMedicalRecord(req.params.id, req.userId);
  return sendSuccess(res, 'OK', result);
});

/**
 * Delete medical record
 */
exports.delete = asyncHandler(async (req, res) => {
  await medicalRecordService.deleteMedicalRecord(req.params.id, req.userId);
  return sendSuccess(res, 'Medical record deleted successfully');
});
