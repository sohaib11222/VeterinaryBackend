const express = require('express');
const router = express.Router();
const reviewController = require('../controllers/review.controller');
const { authGuard } = require('../middleware/authGuard');
const asyncHandler = require('../middleware/asyncHandler');

// Public routes
router.get('/veterinarian/:veterinarianId', asyncHandler(reviewController.listByVeterinarian));
router.get('/public', asyncHandler(reviewController.listPublic));

// Protected routes
router.use(authGuard());
router.get('/appointment/:appointmentId/mine', asyncHandler(reviewController.getMyAppointmentReview));

/**
 * Create review
 */
router.post('/', asyncHandler(reviewController.create));

/**
 * List all reviews (for admin or general listing)
 */
router.get('/', asyncHandler(reviewController.list));

/**
 * Get review by ID
 */
router.get('/:id', asyncHandler(reviewController.getById));

/**
 * Delete review
 */
router.delete('/:id', asyncHandler(reviewController.delete));

module.exports = router;
