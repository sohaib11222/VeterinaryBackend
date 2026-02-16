const express = require('express');
const router = express.Router();
const favoriteController = require('../controllers/favorite.controller');
const { authGuard } = require('../middleware/authGuard');
const asyncHandler = require('../middleware/asyncHandler');

/**
 * @route   POST /api/favorite
 * @desc    Add favorite veterinarian
 * @access  Private (PET_OWNER)
 */
router.post(
  '/',
  authGuard(['PET_OWNER']),
  asyncHandler(favoriteController.add)
);

/**
 * @route   GET /api/favorite/:petOwnerId
 * @desc    List favorites for pet owner
 * @access  Private
 */
router.get(
  '/:petOwnerId',
  authGuard(),
  asyncHandler(favoriteController.list)
);

/**
 * @route   DELETE /api/favorite/:id
 * @desc    Remove favorite
 * @access  Private (PET_OWNER)
 */
router.delete(
  '/:id',
  authGuard(['PET_OWNER']),
  asyncHandler(favoriteController.remove)
);

module.exports = router;
