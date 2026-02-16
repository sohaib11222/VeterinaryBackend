const asyncHandler = require('../middleware/asyncHandler');
const vaccineService = require('../services/vaccine.service');
const { sendSuccess } = require('../utils/response');

exports.create = asyncHandler(async (req, res) => {
  const result = await vaccineService.createVaccine(req.body);
  return sendSuccess(res, 'Vaccine created successfully', result, 201);
});

exports.update = asyncHandler(async (req, res) => {
  const result = await vaccineService.updateVaccine(req.params.id, req.body);
  return sendSuccess(res, 'Vaccine updated successfully', result);
});

exports.list = asyncHandler(async (req, res) => {
  const includeInactive = req.userRole === 'ADMIN' && String(req.query.includeInactive || '').toLowerCase() === 'true';
  const result = await vaccineService.listVaccines({ includeInactive });
  return sendSuccess(res, 'OK', result);
});

exports.delete = asyncHandler(async (req, res) => {
  await vaccineService.deleteVaccine(req.params.id);
  return sendSuccess(res, 'Vaccine deleted successfully');
});
