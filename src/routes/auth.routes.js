const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { authGuard } = require('../middleware/authGuard');
const asyncHandler = require('../middleware/asyncHandler');

// Public routes
router.post('/register', asyncHandler(authController.register));
router.post('/login', asyncHandler(authController.login));
router.post('/forgot-password', asyncHandler(authController.forgotPassword));
router.post('/verify-reset-code', asyncHandler(authController.verifyResetCode));
router.post('/reset-password', asyncHandler(authController.resetPassword));

// Protected routes
router.post('/change-password', authGuard(), asyncHandler(authController.changePassword));
router.post('/refresh-token', asyncHandler(authController.refreshToken));

router.post('/phone-otp/send', authGuard(['VETERINARIAN', 'PET_STORE', 'PARAPHARMACY']), asyncHandler(authController.sendPhoneOtp));
router.post('/phone-otp/verify', authGuard(['VETERINARIAN', 'PET_STORE', 'PARAPHARMACY']), asyncHandler(authController.verifyPhoneOtp));

// Admin routes - authGuard(['ADMIN']) both authenticates and enforces role
router.post('/approve-veterinarian', authGuard(['ADMIN']), asyncHandler(authController.approveVeterinarian));
router.post('/reject-veterinarian', authGuard(['ADMIN']), asyncHandler(authController.rejectVeterinarian));

router.post('/approve-pet-store', authGuard(['ADMIN']), asyncHandler(authController.approvePetStore));
router.post('/reject-pet-store', authGuard(['ADMIN']), asyncHandler(authController.rejectPetStore));

module.exports = router;
