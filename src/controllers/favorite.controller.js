const asyncHandler = require('../middleware/asyncHandler');
const favoriteService = require('../services/favorite.service');
const { sendSuccess } = require('../utils/response');

/**
 * Add favorite veterinarian
 */
exports.add = asyncHandler(async (req, res) => {
  const favoriteData = {
    ...req.body,
    petOwnerId: req.userId
  };
  const result = await favoriteService.addFavorite(favoriteData);
  return sendSuccess(res, 'OK', result);
});

/**
 * List favorites for pet owner
 */
exports.list = asyncHandler(async (req, res) => {
  const petOwnerId = req.params.petOwnerId || req.userId;
  const result = await favoriteService.listFavorites(petOwnerId, req.query);
  return sendSuccess(res, 'OK', result);
});

/**
 * Remove favorite
 */
exports.remove = asyncHandler(async (req, res) => {
  const result = await favoriteService.removeFavorite(req.params.id);
  return sendSuccess(res, 'OK', result);
});
