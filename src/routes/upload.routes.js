const express = require('express');
const router = express.Router();
const { uploadSingleImage, uploadMultipleImages, uploadSingleChatFile, uploadMultipleChatFiles } = require('../middleware/upload.middleware');
const uploadController = require('../controllers/upload.controller');
const { authGuard } = require('../middleware/authGuard');
const asyncHandler = require('../middleware/asyncHandler');

const requireVerifiedVeterinarianPhone = (req, res, next) => {
  if (!req.user?.isPhoneVerified) {
    return res.status(403).json({
      success: false,
      message: 'Verify your phone number before uploading verification documents',
    });
  }
  return next();
};

/**
 * @route   GET /api/upload/files
 * @desc    List uploaded files (for selecting existing images)
 * @access  Private (Admin)
 */
router.get(
  '/files',
  authGuard(['ADMIN']),
  asyncHandler(uploadController.listUploadedFiles)
);

/**
 * @route   POST /api/upload/profile
 * @desc    Upload user profile image
 * @access  Private (Admin, Veterinarian, Pet Owner, Pharmacy, Parapharmacy)
 */
router.post(
  '/profile',
  authGuard(['ADMIN', 'VETERINARIAN', 'PET_OWNER', 'PET_STORE', 'PARAPHARMACY']),
  uploadSingleImage('profile'),
  asyncHandler(uploadController.uploadSingleFile)
);

/**
 * @route   POST /api/upload/veterinarian-docs
 * @desc    Upload veterinarian documents
 * @access  Private (Veterinarian)
 */
router.post(
  '/veterinarian-docs',
  authGuard(['VETERINARIAN']),
  requireVerifiedVeterinarianPhone,
  uploadMultipleImages('veterinarianDocs', 5),
  asyncHandler(uploadController.uploadMultipleFiles)
);

/**
 * @route   POST /api/upload/clinic
 * @desc    Upload clinic images
 * @access  Private (Veterinarian)
 */
router.post(
  '/clinic',
  authGuard(['VETERINARIAN']),
  uploadMultipleImages('clinic', 10),
  asyncHandler(uploadController.uploadMultipleFiles)
);

router.post(
  '/pet-store-docs',
  authGuard(['PET_STORE', 'PARAPHARMACY']),
  uploadMultipleImages('petStore', 10),
  asyncHandler(uploadController.uploadMultipleFiles)
);

/**
 * @route   POST /api/upload/product
 * @desc    Upload product images
 * @access  Private (Admin, Veterinarian, Pet Store)
 */
router.post(
  '/product',
  authGuard(['ADMIN', 'PET_STORE', 'PARAPHARMACY']),
  uploadMultipleImages('product', 10),
  asyncHandler(uploadController.uploadMultipleFiles)
);

/**
 * @route   POST /api/upload/pet
 * @desc    Upload pet images
 * @access  Private (Pet Owner)
 */
router.post(
  '/pet',
  authGuard(['PET_OWNER']),
  uploadMultipleImages('pet', 10),
  asyncHandler(uploadController.uploadMultipleFiles)
);

/**
 * @route   POST /api/upload/blog
 * @desc    Upload blog cover image
 * @access  Private (Admin, Veterinarian)
 */
router.post(
  '/blog',
  authGuard(['ADMIN', 'VETERINARIAN']),
  uploadSingleImage('blog'),
  asyncHandler(uploadController.uploadSingleFile)
);

/**
 * @route   POST /api/upload/pet-store
 * @desc    Upload pet store logo
 * @access  Private (Pet Store, Admin, Veterinarian)
 */
router.post(
  '/pet-store',
  authGuard(['PET_STORE', 'PARAPHARMACY', 'ADMIN']),
  uploadSingleImage('petStore'),
  asyncHandler(uploadController.uploadSingleFile)
);

/**
 * @route   POST /api/upload/general
 * @desc    Upload general images
 * @access  Private (Admin, Veterinarian, Pet Owner, Pharmacy, Parapharmacy)
 */
router.post(
  '/general',
  authGuard(['ADMIN', 'VETERINARIAN', 'PET_OWNER', 'PET_STORE', 'PARAPHARMACY']),
  uploadSingleImage('general'),
  asyncHandler(uploadController.uploadSingleFile)
);

/**
 * @route   POST /api/upload/medical-records
 * @desc    Upload medical record files
 * @access  Private (Veterinarian, Pet Owner)
 */
router.post(
  '/medical-records',
  authGuard(['VETERINARIAN', 'PET_OWNER']),
  uploadMultipleImages('medicalRecords', 10),
  asyncHandler(uploadController.uploadMultipleFiles)
);

/**
 * @route POST /api/upload/product-prescription
 * @desc Upload a pet owner's prescription for a prescription-only product
 * @access Private (Pet Owner)
 */
router.post(
  '/product-prescription',
  authGuard(['PET_OWNER']),
  uploadSingleChatFile('prescriptionRequest'),
  asyncHandler(uploadController.uploadSingleFile)
);

/**
 * @route   POST /api/upload/chat
 * @desc    Upload file for chat (supports all file types - images, PDFs, documents, etc.)
 * @access  Private (Admin, Veterinarian, Pet Owner)
 */
router.post(
  '/chat',
  authGuard(['ADMIN', 'VETERINARIAN', 'PET_OWNER']),
  uploadSingleChatFile('chat'),
  asyncHandler(uploadController.uploadSingleFile)
);

/**
 * @route   POST /api/upload/chat/multiple
 * @desc    Upload multiple files for chat (supports all file types)
 * @access  Private (Admin, Veterinarian, Pet Owner)
 */
router.post(
  '/chat/multiple',
  authGuard(['ADMIN', 'VETERINARIAN', 'PET_OWNER']),
  uploadMultipleChatFiles('chat', 10),
  asyncHandler(uploadController.uploadMultipleFiles)
);

module.exports = router;
