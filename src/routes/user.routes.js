const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const { authGuard } = require('../middleware/authGuard');
const asyncHandler = require('../middleware/asyncHandler');

/**
 * @route   PUT /api/users/profile
 * @desc    Update user profile
 * @access  Private
 */
router.put(
  '/profile',
  authGuard(),
  asyncHandler(userController.updateProfile)
);

router.get(
  '/me',
  authGuard(),
  asyncHandler(userController.getMe)
);

/**
 * @route   PUT /api/users/status/:id
 * @desc    Update user status (admin only)
 * @access  Private (ADMIN)
 */
router.put(
  '/status/:id',
  authGuard(['ADMIN']),
  asyncHandler(userController.updateStatus)
);

/**
 * @route   GET /api/users
 * @desc    List users with filtering
 * @access  Private (ADMIN)
 */
router.get(
  '/',
  authGuard(['ADMIN']),
  asyncHandler(userController.listUsers)
);

/**
 * @route   GET /api/users/veterinarians
 * @desc    List all veterinarians
 * @access  Private (ADMIN)
 */
router.get(
  '/veterinarians',
  authGuard(['ADMIN']),
  asyncHandler(userController.listVeterinarians)
);

/**
 * @route   DELETE /api/users/:id
 * @desc    Delete user (admin only)
 * @access  Private (ADMIN)
 */
router.delete(
  '/:id',
  authGuard(['ADMIN']),
  asyncHandler(userController.deleteUser)
);

/**
 * @route   GET /api/users/:id
 * @desc    Get user by ID
 * @access  Private
 */
router.get(
  '/:id',
  authGuard(),
  asyncHandler(userController.getUserById)
);

module.exports = router;
