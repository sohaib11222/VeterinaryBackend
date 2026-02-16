const asyncHandler = require('../middleware/asyncHandler');
const petStoreService = require('../services/petStore.service');
const petStoreSubscriptionService = require('../services/petStoreSubscription.service');
const { sendSuccess } = require('../utils/response');

/**
 * Create pet store
 */
exports.create = asyncHandler(async (req, res) => {
  let petStoreData = { ...req.body };
  
  if (req.userRole === 'PET_STORE' || req.userRole === 'PARAPHARMACY') {
    petStoreData.ownerId = req.userId;
  } else if (req.userRole === 'ADMIN') {
    if (!petStoreData.ownerId) {
      return res.status(400).json({ success: false, message: 'ownerId is required when admin creates a pet store' });
    }
  }
  
  const result = await petStoreService.createPetStore(petStoreData);
  return sendSuccess(res, 'Pet store created successfully', result, 201);
});

/**
 * Update pet store
 */
exports.update = asyncHandler(async (req, res) => {
  if (req.userRole === 'PET_STORE' || req.userRole === 'PARAPHARMACY') {
    const PetStore = require('../models/PetStore');
    const petStore = await PetStore.findById(req.params.id);
    
    if (!petStore) {
      return res.status(404).json({ success: false, message: 'Pet store not found' });
    }
    
    if (petStore.ownerId.toString() !== req.userId.toString()) {
      return res.status(403).json({ 
        success: false, 
        message: 'Unauthorized: You can only update your own pet store' 
      });
    }
  }
  
  const result = await petStoreService.updatePetStore(req.params.id, req.body);
  return sendSuccess(res, 'Pet store updated successfully', result);
});

/**
 * Get pet store by ID
 */
exports.getById = asyncHandler(async (req, res) => {
  const result = await petStoreService.getPetStore(req.params.id);
  return sendSuccess(res, 'OK', result);
});

/**
 * List pet stores
 */
exports.list = asyncHandler(async (req, res) => {
  const result = await petStoreService.listPetStores(req.query);
  return sendSuccess(res, 'OK', result);
});
exports.getMe = asyncHandler(async (req, res) => {
  const result = await petStoreService.getPetStoreByOwnerId(req.userId);
  return sendSuccess(res, 'OK', result);
});
exports.getMySubscription = asyncHandler(async (req, res) => {
  const result = await petStoreSubscriptionService.getMySubscription(req.userId);
  return sendSuccess(res, 'OK', result);
});
exports.buySubscription = asyncHandler(async (req, res) => {
  const result = await petStoreSubscriptionService.purchaseSubscription(req.userId, req.body?.planId);
  return sendSuccess(res, 'Subscription plan purchased successfully', result);
});

/**
 * Delete pet store
 */
exports.delete = asyncHandler(async (req, res) => {
  await petStoreService.deletePetStore(req.params.id);
  return sendSuccess(res, 'Pet store deleted successfully');
});
