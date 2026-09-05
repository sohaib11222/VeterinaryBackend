const express = require('express');
const router = express.Router();
const crmController = require('../controllers/crm.controller');
const { authGuard } = require('../middleware/authGuard');
const { crmApiKeyGuard } = require('../middleware/crmApiKeyGuard');
const asyncHandler = require('../middleware/asyncHandler');

/**
 * @route   GET /api/crm/leads
 * @desc    Filterable registration feed consumed by the LeoX24 MyPet Plus page
 * @access  Private (LeoX24 server-to-server API key)
 */
router.get(
  '/leads',
  crmApiKeyGuard,
  asyncHandler(crmController.getCrmLeads)
);

/**
 * @route   GET /api/crm/data
 * @desc    Get comprehensive CRM data for external CRM system
 * @access  Private (ADMIN) - Note: In myDoctor, this uses API key auth
 */
router.get(
  '/data',
  authGuard(['ADMIN', 'VETERINARIAN']),
  asyncHandler(crmController.getCrmData)
);

module.exports = router;
