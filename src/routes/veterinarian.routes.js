const express = require('express');
const router = express.Router();
const veterinarianController = require('../controllers/veterinarian.controller');
const { authGuard } = require('../middleware/authGuard');
const asyncHandler = require('../middleware/asyncHandler');

// Public routes (must come before parameterized routes)
router.get('/', asyncHandler(veterinarianController.listVeterinarians));

// Protected routes - require authentication (specific routes must come before /:id)
router.get('/profile', authGuard(['VETERINARIAN']), asyncHandler(veterinarianController.getProfile)); // Get own profile
router.put('/profile', authGuard(['VETERINARIAN']), asyncHandler(veterinarianController.upsertProfile)); // Upsert profile
router.get('/dashboard', authGuard(['VETERINARIAN']), asyncHandler(veterinarianController.getDashboard));
router.get('/reviews', authGuard(['VETERINARIAN']), asyncHandler(veterinarianController.getReviews));
router.get('/invoices', authGuard(['VETERINARIAN']), asyncHandler(veterinarianController.getInvoices));
router.get('/invoices/:transactionId', authGuard(['VETERINARIAN']), asyncHandler(veterinarianController.getInvoiceByTransactionId));
router.post('/buy-subscription', authGuard(['VETERINARIAN']), asyncHandler(veterinarianController.buySubscriptionPlan));
router.get('/my-subscription', authGuard(['VETERINARIAN']), asyncHandler(veterinarianController.getMySubscription));

// Parameterized routes must come last
router.get('/profile/:id', asyncHandler(veterinarianController.getProfileById)); // Public: Get profile by user ID
router.get('/:id', asyncHandler(veterinarianController.getProfileById)); // Public: Get profile by user ID (alternative route)

module.exports = router;
