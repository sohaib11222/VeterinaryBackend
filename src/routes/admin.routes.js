const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');
const { authGuard, requireRole } = require('../middleware/authGuard');
const asyncHandler = require('../middleware/asyncHandler');

// All admin routes require authentication and ADMIN role
router.use(authGuard());
router.use(requireRole('ADMIN'));

/**
 * Get admin dashboard
 */
router.get('/dashboard', asyncHandler(adminController.getDashboard));

/**
 * Sidebar notification markers and pending-work counts
 */
router.get('/sidebar-indicators', asyncHandler(adminController.getSidebarIndicators));

/**
 * Get all users
 */
router.get('/users', asyncHandler(adminController.getUsers));

/**
 * Get all appointments
 */
router.get('/appointments', asyncHandler(adminController.getAppointments));

/**
 * Get all transactions
 */
router.get('/transactions', asyncHandler(adminController.getTransactions));

/**
 * Get all reviews
 */
router.get('/reviews', asyncHandler(adminController.getReviews));

/**
 * Get all pets
 */
router.get('/pets', asyncHandler(adminController.getPets));

/**
 * Get all medical records
 */
router.get('/medical-records', asyncHandler(adminController.getMedicalRecords));

/**
 * Delete medical record
 */
router.delete('/medical-records/:id', asyncHandler(adminController.deleteMedicalRecord));

/**
 * Get system activity
 */
router.get('/activity', asyncHandler(adminController.getSystemActivity));

module.exports = router;
