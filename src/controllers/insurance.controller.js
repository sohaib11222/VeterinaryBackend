const asyncHandler = require('../middleware/asyncHandler');
const insuranceService = require('../services/insurance.service');
const { sendSuccess } = require('../utils/response');

/**
 * Get all insurance companies (admin)
 */
exports.getAllInsuranceCompanies = asyncHandler(async (req, res) => {
  const { isActive, page, limit } = req.query;
  
  const result = await insuranceService.getAllInsuranceCompanies({
    isActive: isActive !== undefined ? isActive === 'true' : undefined,
    page: parseInt(page) || 1,
    limit: parseInt(limit) || 100
  });

  return sendSuccess(res, 'OK', result);
});

/**
 * Get active insurance companies (public)
 */
exports.getActiveInsuranceCompanies = asyncHandler(async (req, res) => {
  const companies = await insuranceService.getActiveInsuranceCompanies();
  return sendSuccess(res, 'OK', companies);
});

/**
 * Get insurance company by ID
 */
exports.getInsuranceCompanyById = asyncHandler(async (req, res) => {
  const company = await insuranceService.getInsuranceCompanyById(req.params.id);
  return sendSuccess(res, 'OK', company);
});

/**
 * Create insurance company
 */
exports.createInsuranceCompany = asyncHandler(async (req, res) => {
  const company = await insuranceService.createInsuranceCompany(req.body);
  return sendSuccess(res, 'Insurance company created successfully', company, 201);
});

/**
 * Update insurance company
 */
exports.updateInsuranceCompany = asyncHandler(async (req, res) => {
  const company = await insuranceService.updateInsuranceCompany(req.params.id, req.body);
  return sendSuccess(res, 'Insurance company updated successfully', company);
});

/**
 * Delete insurance company
 */
exports.deleteInsuranceCompany = asyncHandler(async (req, res) => {
  await insuranceService.deleteInsuranceCompany(req.params.id);
  return sendSuccess(res, 'Insurance company deleted successfully');
});

/**
 * Toggle insurance company status
 */
exports.toggleInsuranceCompanyStatus = asyncHandler(async (req, res) => {
  const { isActive } = req.body;
  const company = await insuranceService.toggleInsuranceCompanyStatus(req.params.id, isActive);
  return sendSuccess(res, `Insurance company ${isActive ? 'activated' : 'deactivated'} successfully`, company);
});
