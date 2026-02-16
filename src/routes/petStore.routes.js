const express = require('express');
const router = express.Router();
const petStoreController = require('../controllers/petStore.controller');
const { authGuard } = require('../middleware/authGuard');
const asyncHandler = require('../middleware/asyncHandler');

/**
 * @route   GET /api/pet-stores
 * @desc    List pet stores (public)
 * @access  Public
 */
router.get('/', asyncHandler(petStoreController.list));
router.get(
  '/me',
  authGuard(['PET_STORE', 'PARAPHARMACY', 'ADMIN']),
  asyncHandler(petStoreController.getMe)
);
router.get(
  '/my-subscription',
  authGuard(['PET_STORE']),
  asyncHandler(petStoreController.getMySubscription)
);
router.post(
  '/buy-subscription',
  authGuard(['PET_STORE']),
  asyncHandler(petStoreController.buySubscription)
);

/**
 * @route   GET /api/pet-stores/:id
 * @desc    Get pet store by ID (public)
 * @access  Public
 */
router.get('/:id', asyncHandler(petStoreController.getById));

/**
 * @route   POST /api/pet-stores
 * @desc    Create pet store
 * @access  Private (VETERINARIAN, PET_STORE, ADMIN)
 */
router.post(
  '/',
  authGuard(['PET_STORE', 'PARAPHARMACY', 'ADMIN']),
  asyncHandler(petStoreController.create)
);

/**
 * @route   PUT /api/pet-stores/:id
 * @desc    Update pet store
 * @access  Private (VETERINARIAN, PET_STORE, ADMIN)
 */
router.put(
  '/:id',
  authGuard(['PET_STORE', 'PARAPHARMACY', 'ADMIN']),
  asyncHandler(petStoreController.update)
);

/**
 * @route   DELETE /api/pet-stores/:id
 * @desc    Delete pet store
 * @access  Private (ADMIN)
 */
router.delete(
  '/:id',
  authGuard(['ADMIN']),
  asyncHandler(petStoreController.delete)
);

module.exports = router;
