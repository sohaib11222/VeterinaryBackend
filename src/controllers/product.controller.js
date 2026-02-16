const asyncHandler = require('../middleware/asyncHandler');
const productService = require('../services/product.service');
const { sendSuccess } = require('../utils/response');

/**
 * Create product
 */
exports.create = asyncHandler(async (req, res) => {
  let sellerId = req.userId;
  let sellerType = req.userRole;
  const petStoreService = require('../services/petStore.service');
  
  // Handle pharmacyId for linking to pet store
  let petStoreId = null;
  const rawPetStoreId = req.body.petStoreId;
  
  if (rawPetStoreId !== undefined && rawPetStoreId !== null) {
    const petStoreIdStr = String(rawPetStoreId).trim();
    if (petStoreIdStr && petStoreIdStr !== '' && petStoreIdStr !== 'null' && petStoreIdStr !== 'undefined') {
      petStoreId = petStoreIdStr;
    }
  }
  
  if ((req.userRole === 'PET_STORE' || req.userRole === 'PARAPHARMACY') && !petStoreId) {
    const myStore = await petStoreService.getPetStoreByOwnerId(req.userId);
    if (myStore) {
      petStoreId = myStore._id;
      sellerType = 'PET_STORE';
      sellerId = myStore.ownerId?._id || myStore.ownerId || req.userId;
    }
  } else if (req.userRole === 'ADMIN' && petStoreId) {
    const petStore = await petStoreService.getPetStore(petStoreId);
    if (!petStore) {
      return res.status(404).json({ 
        success: false, 
        message: 'Pet store not found' 
      });
    }
    sellerId = petStore.ownerId?._id || petStore.ownerId;
    sellerType = 'PET_STORE';
  }
  
  const { petStoreId: _, sellerId: __, sellerType: ___, ...productBody } = req.body;
  
  const productData = {
    ...productBody,
    sellerId: sellerId,
    sellerType: sellerType,
    petStoreId: petStoreId || null
  };
  
  const result = await productService.createProduct(productData);
  return sendSuccess(res, 'Product created successfully', result, 201);
});

/**
 * Update product
 */
exports.update = asyncHandler(async (req, res) => {
  const result = await productService.updateProduct(req.params.id, req.body, req.userId);
  return sendSuccess(res, 'Product updated successfully', result);
});

/**
 * Get product by ID
 */
exports.getById = asyncHandler(async (req, res) => {
  const result = await productService.getProduct(req.params.id);
  return sendSuccess(res, 'OK', result);
});

/**
 * List products with filtering
 */
exports.list = asyncHandler(async (req, res) => {
  const result = await productService.listProducts(req.query);
  return sendSuccess(res, 'OK', result);
});

exports.listMine = asyncHandler(async (req, res) => {
  const params = { ...req.query, sellerId: req.userId, sellerType: 'PET_STORE', isActive: req.query?.isActive ?? 'all' };
  const result = await productService.listProducts(params);
  return sendSuccess(res, 'OK', result);
});

/**
 * Delete product
 */
exports.delete = asyncHandler(async (req, res) => {
  await productService.deleteProduct(req.params.id, req.userId);
  return sendSuccess(res, 'Product deleted successfully');
});
