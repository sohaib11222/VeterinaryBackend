const asyncHandler = require('../middleware/asyncHandler');
const petService = require('../services/pet.service');
const { sendSuccess } = require('../utils/response');

/**
 * Create new pet
 */
exports.createPet = asyncHandler(async (req, res) => {
  const result = await petService.createPet(req.userId, req.body);
  return sendSuccess(res, 'Pet created successfully', result, 201);
});

/**
 * Get pet by ID
 */
exports.getPet = asyncHandler(async (req, res) => {
  const result = await petService.getPet(req.params.id, req.userId);
  return sendSuccess(res, 'OK', result);
});

/**
 * List pets (for pet owner)
 */
exports.listPets = asyncHandler(async (req, res) => {
  const result = await petService.listPets(req.userId, req.query);
  return sendSuccess(res, 'OK', result);
});

/**
 * Update pet
 */
exports.updatePet = asyncHandler(async (req, res) => {
  const result = await petService.updatePet(req.params.id, req.userId, req.body);
  return sendSuccess(res, 'Pet updated successfully', result);
});

/**
 * Delete pet
 */
exports.deletePet = asyncHandler(async (req, res) => {
  await petService.deletePet(req.params.id, req.userId);
  return sendSuccess(res, 'Pet deleted successfully');
});
