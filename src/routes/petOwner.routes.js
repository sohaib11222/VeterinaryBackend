const express = require('express');
const router = express.Router();
const petOwnerController = require('../controllers/petOwner.controller');
const { authGuard, requireRole } = require('../middleware/authGuard');
const asyncHandler = require('../middleware/asyncHandler');

// All routes require authentication and PET_OWNER role
router.use(authGuard());
router.use(requireRole('PET_OWNER'));

/**
 * Get pet owner dashboard
 */
router.get('/dashboard', asyncHandler(petOwnerController.getDashboard));

/**
 * Get appointment history
 */
router.get('/appointments', asyncHandler(petOwnerController.getAppointmentHistory));

/**
 * Get payment history
 */
router.get('/payments', asyncHandler(petOwnerController.getPaymentHistory));

module.exports = router;
