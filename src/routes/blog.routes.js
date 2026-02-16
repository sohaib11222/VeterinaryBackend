const express = require('express');
const router = express.Router();
const blogController = require('../controllers/blog.controller');
const { authGuard } = require('../middleware/authGuard');
const asyncHandler = require('../middleware/asyncHandler');

/**
 * @route   POST /api/blog
 * @desc    Create blog post
 * @access  Private (VETERINARIAN, ADMIN)
 */
router.post(
  '/',
  authGuard(['VETERINARIAN', 'ADMIN']),
  asyncHandler(blogController.create)
);

/**
 * @route   PUT /api/blog/:id
 * @desc    Update blog post
 * @access  Private (VETERINARIAN, ADMIN)
 */
router.put(
  '/:id',
  authGuard(['VETERINARIAN', 'ADMIN']),
  asyncHandler(blogController.update)
);

/**
 * @route   GET /api/blog
 * @desc    List blog posts with filtering
 * @access  Public
 */
router.get(
  '/',
  asyncHandler(blogController.list)
);

/**
 * @route   GET /api/blog/:id
 * @desc    Get blog post by ID
 * @access  Public
 */
router.get(
  '/:id',
  asyncHandler(blogController.getById)
);

/**
 * @route   DELETE /api/blog/:id
 * @desc    Delete blog post
 * @access  Private (VETERINARIAN, ADMIN)
 */
router.delete(
  '/:id',
  authGuard(['VETERINARIAN', 'ADMIN']),
  asyncHandler(blogController.delete)
);

module.exports = router;
