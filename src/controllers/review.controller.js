const asyncHandler = require('../middleware/asyncHandler');
const reviewService = require('../services/review.service');
const { sendSuccess } = require('../utils/response');

/**
 * Create review
 */
exports.create = asyncHandler(async (req, res) => {
  const reviewData = {
    ...req.body,
    petOwnerId: req.userId,
    userRole: req.userRole
  };
  const result = await reviewService.createReview(reviewData);
  return sendSuccess(res, 'Review created successfully', result, 201);
});
exports.getMyAppointmentReview = asyncHandler(async (req, res) => {
  const result = await reviewService.getMyAppointmentReview(req.params.appointmentId, req.userId, req.userRole);
  return sendSuccess(res, 'OK', result);
});

/**
 * List reviews by veterinarian
 */
exports.listByVeterinarian = asyncHandler(async (req, res) => {
  const result = await reviewService.listReviewsByVeterinarian(req.params.veterinarianId, req.query);
  return sendSuccess(res, 'OK', result);
});

/**
 * List reviews publicly (no auth)
 */
exports.listPublic = asyncHandler(async (req, res) => {
  const result = await reviewService.listReviews(req.query);
  return sendSuccess(res, 'OK', result);
});

/**
 * List all reviews (admin or general)
 */
exports.list = asyncHandler(async (req, res) => {
  const result = await reviewService.listReviews(req.query);
  return sendSuccess(res, 'OK', result);
});

/**
 * Get review by ID
 */
exports.getById = asyncHandler(async (req, res) => {
  const result = await reviewService.getReviewById(req.params.id);
  return sendSuccess(res, 'OK', result);
});

/**
 * Delete review
 */
exports.delete = asyncHandler(async (req, res) => {
  await reviewService.deleteReview(req.params.id, req.userId);
  return sendSuccess(res, 'Review deleted successfully');
});
