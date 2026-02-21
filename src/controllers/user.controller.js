const asyncHandler = require('../middleware/asyncHandler');
const userService = require('../services/user.service');
const { sendSuccess } = require('../utils/response');

/**
 * Get user by ID
 */
exports.getUserById = asyncHandler(async (req, res) => {
  const result = await userService.getUserById(req.params.id);
  return sendSuccess(res, 'OK', result);
});

/**
 * Update user profile
 */
exports.updateProfile = asyncHandler(async (req, res) => {
  const result = await userService.updateUserProfile(req.userId, req.body);
  return sendSuccess(res, 'Profile updated successfully', result);
});

exports.getMe = asyncHandler(async (req, res) => {
  const result = await userService.getUserById(req.userId);
  return sendSuccess(res, 'OK', result);
});

/**
 * Update user status (admin only)
 */
exports.updateStatus = asyncHandler(async (req, res) => {
  const result = await userService.updateStatus(req.params.id, req.body.status);
  return sendSuccess(res, 'User status updated successfully', result);
});

/**
 * List users with filtering
 */
exports.listUsers = asyncHandler(async (req, res) => {
  const result = await userService.listUsers(req.query);
  return sendSuccess(res, 'OK', result);
});

/**
 * List all veterinarians (admin only)
 */
exports.listVeterinarians = asyncHandler(async (req, res) => {
  const result = await userService.listVeterinarians(req.query);
  return sendSuccess(res, 'OK', result);
});

/**
 * Delete user by ID (admin only)
 */
exports.deleteUser = asyncHandler(async (req, res) => {
  const result = await userService.deleteUserById(req.params.id);
  return sendSuccess(res, 'User deleted successfully', result);
});
