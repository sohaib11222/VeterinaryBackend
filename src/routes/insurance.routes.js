const express = require('express');
const router = express.Router();
const insuranceController = require('../controllers/insurance.controller');
const { authGuard } = require('../middleware/authGuard');
const asyncHandler = require('../middleware/asyncHandler');

/**
 * @route   GET /api/insurance
 * @desc    Get active insurance companies (public)
 * @access  Public
 */
router.get(
  '/',
  asyncHandler(insuranceController.getActiveInsuranceCompanies)
);

/**
 * @route   GET /api/insurance/:id
 * @desc    Get insurance company by ID (public)
 * @access  Public
 */
router.get(
  '/:id',
  asyncHandler(insuranceController.getInsuranceCompanyById)
);

/**
 * @route   GET /api/insurance/admin/all
 * @desc    Get all insurance companies (admin)
 * @access  Private (ADMIN)
 */
router.get(
  '/admin/all',
  authGuard(['ADMIN']),
  asyncHandler(insuranceController.getAllInsuranceCompanies)
);

/**
 * @route   POST /api/insurance
 * @desc    Create insurance company
 * @access  Private (ADMIN)
 */
router.post(
  '/',
  authGuard(['ADMIN']),
  asyncHandler(insuranceController.createInsuranceCompany)
);

/**
 * @route   PUT /api/insurance/:id
 * @desc    Update insurance company
 * @access  Private (ADMIN)
 */
router.put(
  '/:id',
  authGuard(['ADMIN']),
  asyncHandler(insuranceController.updateInsuranceCompany)
);

/**
 * @route   DELETE /api/insurance/:id
 * @desc    Delete insurance company
 * @access  Private (ADMIN)
 */
router.delete(
  '/:id',
  authGuard(['ADMIN']),
  asyncHandler(insuranceController.deleteInsuranceCompany)
);

/**
 * @route   PUT /api/insurance/:id/toggle-status
 * @desc    Toggle insurance company status
 * @access  Private (ADMIN)
 */
router.put(
  '/:id/toggle-status',
  authGuard(['ADMIN']),
  asyncHandler(insuranceController.toggleInsuranceCompanyStatus)
);

module.exports = router;
