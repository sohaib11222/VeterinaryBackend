const asyncHandler = require('../middleware/asyncHandler');
const authService = require('../services/auth.service');
const { sendSuccess, sendError } = require('../utils/response');

/**
 * Register new user (Pet Owner or Veterinarian)
 */
exports.register = asyncHandler(async (req, res) => {
  const result = await authService.register(req.body);
  return sendSuccess(res, 'Registration successful', result, 201);
});

/**
 * Login user
 */
exports.login = asyncHandler(async (req, res) => {
  const result = await authService.login(req.body);
  return sendSuccess(res, 'Login successful', result);
});

/**
 * Forgot password - Send reset code
 */
exports.forgotPassword = asyncHandler(async (req, res) => {
  await authService.forgotPassword(req.body.email);
  return sendSuccess(res, 'Password reset code sent to email');
});

/**
 * Verify reset code
 */
exports.verifyResetCode = asyncHandler(async (req, res) => {
  const result = await authService.verifyResetCode(req.body.email, req.body.code);
  return sendSuccess(res, 'Reset code verified', result);
});

/**
 * Reset password
 */
exports.resetPassword = asyncHandler(async (req, res) => {
  await authService.resetPassword(req.body.email, req.body.code, req.body.newPassword);
  return sendSuccess(res, 'Password reset successful');
});

/**
 * Change password (authenticated user)
 */
exports.changePassword = asyncHandler(async (req, res) => {
  await authService.changePassword(req.userId, req.body.oldPassword, req.body.newPassword);
  return sendSuccess(res, 'Password changed successfully');
});

/**
 * Refresh token
 */
exports.refreshToken = asyncHandler(async (req, res) => {
  const result = await authService.refreshToken(req.body.refreshToken);
  return sendSuccess(res, 'Token refreshed', result);
});

/**
 * Approve veterinarian (Admin only)
 * Accepts veterinarianId or userId in body (e.g. { veterinarianId } or { userId })
 */
exports.approveVeterinarian = asyncHandler(async (req, res) => {
  const id = req.body.veterinarianId ?? req.body.userId;
  await authService.approveVeterinarian(id);
  return sendSuccess(res, 'Veterinarian approved successfully');
});

/**
 * Reject veterinarian (Admin only)
 * Accepts veterinarianId or userId in body (e.g. { veterinarianId, reason } or { userId, reason })
 */
exports.rejectVeterinarian = asyncHandler(async (req, res) => {
  const id = req.body.veterinarianId ?? req.body.userId;
  await authService.rejectVeterinarian(id, req.body.reason);
  return sendSuccess(res, 'Veterinarian rejected');
});

exports.approvePetStore = asyncHandler(async (req, res) => {
  const id = req.body.userId;
  await authService.approvePetStoreUser(id);
  return sendSuccess(res, 'Pet store approved successfully');
});

exports.rejectPetStore = asyncHandler(async (req, res) => {
  const id = req.body.userId;
  await authService.rejectPetStoreUser(id, req.body.reason);
  return sendSuccess(res, 'Pet store rejected');
});
