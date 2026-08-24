const Product = require('../models/Product');
const User = require('../models/User');
const SubscriptionPlan = require('../models/SubscriptionPlan');
const VeterinarianSubscription = require('../models/VeterinarianSubscription');

const nullableNumber = (value) => {
  if (value === '' || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const normalizeVariants = (variants, fallback = {}) => {
  const source = Array.isArray(variants) && variants.length
    ? variants
    : [{
        name: fallback.name || 'Default option',
        sku: fallback.sku,
        barcode: fallback.barcode,
        price: fallback.price,
        discountPrice: fallback.discountPrice,
        stock: fallback.stock
      }];

  const normalized = source.map((variant, index) => {
    const price = nullableNumber(variant?.price);
    const discountPrice = nullableNumber(variant?.discountPrice);
    const stock = nullableNumber(variant?.stock);

    if (price === null || price < 0) {
      throw new Error(`A valid price is required for variant ${index + 1}`);
    }
    if (discountPrice !== null && (discountPrice < 0 || discountPrice >= price)) {
      throw new Error(`Sale price must be lower than the regular price for variant ${index + 1}`);
    }
    if (stock === null || stock < 0) {
      throw new Error(`A valid stock quantity is required for variant ${index + 1}`);
    }

    return {
      ...(variant?._id ? { _id: variant._id } : {}),
      name: String(variant?.name || `Option ${index + 1}`).trim(),
      sku: String(variant?.sku || '').trim() || null,
      barcode: String(variant?.barcode || '').trim() || null,
      strengthValue: nullableNumber(variant?.strengthValue),
      strengthUnit: String(variant?.strengthUnit || '').trim() || null,
      dosageForm: String(variant?.dosageForm || '').trim() || null,
      packageType: String(variant?.packageType || '').trim() || null,
      unitsPerPack: nullableNumber(variant?.unitsPerPack),
      unitLabel: String(variant?.unitLabel || '').trim() || null,
      packageDescription: String(variant?.packageDescription || '').trim() || null,
      price,
      discountPrice,
      stock,
      isDefault: Boolean(variant?.isDefault),
      isActive: variant?.isActive !== false
    };
  });

  const defaultIndex = normalized.findIndex((variant) => variant.isDefault);
  normalized.forEach((variant, index) => {
    variant.isDefault = index === (defaultIndex >= 0 ? defaultIndex : 0);
  });

  return normalized;
};

const getVariantSummary = (variants) => {
  const defaultVariant = variants.find((variant) => variant.isDefault) || variants[0];
  return {
    price: defaultVariant.price,
    discountPrice: defaultVariant.discountPrice,
    stock: variants.reduce((total, variant) => total + Number(variant.stock || 0), 0)
  };
};

/**
 * Create product
 */
const createProduct = async (data) => {
  const {
    sellerId,
    sellerType,
    name,
    price,
    stock,
    description,
    sku,
    discountPrice,
    images,
    category,
    subCategory,
    petType,
    tags,
    requiresPrescription,
    isActive,
    petStoreId,
    productType,
    brand,
    manufacturer,
    barcode,
    medicineDetails,
    parapharmacyDetails,
    variants
  } = data;

  if (!sellerId) {
    throw new Error('Seller ID is required');
  }
  
  const seller = await User.findById(sellerId)
    .maxTimeMS(2000);
  if (!seller) {
    throw new Error(`Seller not found with ID: ${sellerId}`);
  }

  // Verify seller type matches user role
  if (sellerType === 'VETERINARIAN' && seller.role !== 'VETERINARIAN') {
    throw new Error('Seller must be a veterinarian');
  }

  if (sellerType === 'PET_STORE' || sellerType === 'PARAPHARMACY') {
    const role = String(seller.role || '').toUpperCase();
    if (role !== 'PET_STORE' && role !== 'PARAPHARMACY') {
      throw new Error('Only pet store users can create pet store products');
    }
    if (seller.status !== 'APPROVED') {
      throw new Error('Pet store account is not approved');
    }
    if (role === 'PET_STORE') {
      const PetStoreSubscription = require('../models/PetStoreSubscription');
      const SubscriptionPlan = require('../models/SubscriptionPlan');
      const now = new Date();
      const subscription = await PetStoreSubscription.findOne({
        petStoreOwnerId: sellerId,
        isActive: true,
        endDate: { $gt: now }
      })
        .populate('subscriptionPlanId', 'planType')
        .lean()
        .maxTimeMS(2000);

      const planType = subscription?.subscriptionPlanId?.planType;

      if (!subscription || String(planType || '').toUpperCase() !== 'PET_STORE') {
        throw new Error('You must have an active subscription plan to create products');
      }
    }
  }

  if (sellerType === 'VETERINARIAN') {
    const subscription = await VeterinarianSubscription.findOne({
      veterinarianId: sellerId,
      isActive: true,
      endDate: { $gt: new Date() }
    })
      .lean()
      .maxTimeMS(2000);

    if (subscription && subscription.subscriptionPlanId) {
      const plan = await SubscriptionPlan.findById(subscription.subscriptionPlanId)
        .lean()
        .maxTimeMS(1000);
      subscription.subscriptionPlanId = plan;
    }

    if (!subscription || !subscription.subscriptionPlanId) {
      throw new Error('You must have an active subscription plan to create products');
    }

    if (subscription.subscriptionPlanId.name.toUpperCase() !== 'FULL') {
      throw new Error('Only veterinarians with FULL subscription plan can create products. Please upgrade to FULL plan.');
    }
  }

  const skuValue = typeof sku === 'string' ? sku.trim() : '';
  const normalizedVariants = normalizeVariants(variants, {
    name,
    sku: skuValue,
    barcode,
    price,
    discountPrice,
    stock
  });
  const variantSummary = getVariantSummary(normalizedVariants);
  const normalizedProductType = ['PHARMACY_MEDICINE', 'PARAPHARMACY_PRODUCT', 'GENERAL_PRODUCT'].includes(productType)
    ? productType
    : 'GENERAL_PRODUCT';
  const normalizedMedicineDetails = medicineDetails && typeof medicineDetails === 'object' ? medicineDetails : {};
  const normalizedParapharmacyDetails = parapharmacyDetails && typeof parapharmacyDetails === 'object' ? parapharmacyDetails : {};

  const createDoc = {
    sellerId,
    sellerType: sellerType.toUpperCase(),
    petStoreId: petStoreId || null,
    name,
    price: variantSummary.price,
    stock: variantSummary.stock,
    description,
    discountPrice: variantSummary.discountPrice,
    productType: normalizedProductType,
    brand: String(brand || '').trim() || null,
    manufacturer: String(manufacturer || normalizedMedicineDetails.manufacturer || normalizedParapharmacyDetails.manufacturer || '').trim() || null,
    barcode: String(barcode || '').trim() || null,
    images: Array.isArray(images) ? images : [],
    category,
    subCategory,
    petType: petType || normalizedMedicineDetails.targetSpecies || normalizedParapharmacyDetails.targetSpecies || [],
    tags: tags || [],
    requiresPrescription: requiresPrescription || false,
    medicineDetails: normalizedMedicineDetails,
    parapharmacyDetails: normalizedParapharmacyDetails,
    variants: normalizedVariants,
    isActive: isActive !== undefined ? isActive : true
  };

  if (skuValue) {
    createDoc.sku = skuValue;
  }

  const product = await Product.create(createDoc);

  return product;
};

/**
 * Update product
 */
const updateProduct = async (id, data, userId) => {
  const product = await Product.findById(id)
    .maxTimeMS(2000);
  
  if (!product) {
    throw new Error('Product not found');
  }

  const currentUser = await User.findById(userId)
    .maxTimeMS(2000);
  
  if (currentUser.role !== 'ADMIN' && product.sellerId.toString() !== userId) {
    throw new Error('You do not have permission to update this product');
  }

  if (currentUser.role === 'PET_STORE') {
    const PetStoreSubscription = require('../models/PetStoreSubscription');
    const now = new Date();
    const subscription = await PetStoreSubscription.findOne({
      petStoreOwnerId: userId,
      isActive: true,
      endDate: { $gt: now }
    })
      .lean()
      .maxTimeMS(2000);

    if (!subscription) {
      throw new Error('You must have an active subscription plan to update products');
    }
  }

  // For veterinarians: Verify they still have FULL subscription
  if (product.sellerType === 'VETERINARIAN' && currentUser.role !== 'ADMIN') {
    const subscription = await VeterinarianSubscription.findOne({
      veterinarianId: product.sellerId,
      isActive: true,
      endDate: { $gt: new Date() }
    })
      .lean()
      .maxTimeMS(2000);
    
    if (subscription && subscription.subscriptionPlanId) {
      const plan = await SubscriptionPlan.findById(subscription.subscriptionPlanId)
        .lean()
        .maxTimeMS(1000);
      subscription.subscriptionPlanId = plan;
    }

    if (!subscription || !subscription.subscriptionPlanId || subscription.subscriptionPlanId.name.toUpperCase() !== 'FULL') {
      throw new Error('Only veterinarians with FULL subscription plan can update products');
    }
  }

  const { sellerId, sellerType, petStoreId, ...updateData } = data;

  if (Object.prototype.hasOwnProperty.call(updateData, 'sku')) {
    const nextSku = typeof updateData.sku === 'string' ? updateData.sku.trim() : '';
    updateData.sku = nextSku || undefined;
  }

  if (Object.prototype.hasOwnProperty.call(updateData, 'variants')) {
    const normalizedVariants = normalizeVariants(updateData.variants, {
      name: updateData.name || product.name,
      sku: updateData.sku || product.sku,
      barcode: updateData.barcode || product.barcode,
      price: updateData.price ?? product.price,
      discountPrice: updateData.discountPrice ?? product.discountPrice,
      stock: updateData.stock ?? product.stock
    });
    Object.assign(updateData, getVariantSummary(normalizedVariants), { variants: normalizedVariants });
  }

  if (updateData.medicineDetails?.targetSpecies && !updateData.petType) {
    updateData.petType = updateData.medicineDetails.targetSpecies;
  }
  if (updateData.parapharmacyDetails?.targetSpecies && !updateData.petType) {
    updateData.petType = updateData.parapharmacyDetails.targetSpecies;
  }

  Object.keys(updateData).forEach(key => {
    if (updateData[key] !== undefined) {
      product[key] = updateData[key];
    }
  });

  await product.save();
  return product;
};

/**
 * Get product by ID
 */
const getProduct = async (id) => {
  const product = await Product.findById(id)
    .lean()
    .maxTimeMS(2000);
  
  if (!product) {
    throw new Error('Product not found');
  }

  // Populate separately for better performance
  const [seller, petStore] = await Promise.all([
    product.sellerId ? User.findById(product.sellerId)
      .select('name email phone profileImage')
      .lean()
      .maxTimeMS(1000) : Promise.resolve(null),
    product.petStoreId ? require('../models/PetStore').findById(product.petStoreId)
      .select('name logo')
      .lean()
      .maxTimeMS(1000) : Promise.resolve(null)
  ]);

  return {
    ...product,
    sellerId: seller,
    petStoreId: petStore
  };
};

/**
 * List products with filtering
 */
const listProducts = async (filter = {}) => {
  const {
    sellerId,
    sellerType,
    category,
    subCategory,
    petType,
    minPrice,
    maxPrice,
    tags,
    search,
    isActive,
    page = 1,
    limit = 10
  } = filter;

  const query = {};
  if (String(isActive || '').toLowerCase() === 'all') {
    // no isActive filter
  } else if (isActive !== undefined) {
    query.isActive = isActive === true || String(isActive).toLowerCase() === 'true';
  } else {
    query.isActive = true;
  }

  if (sellerId) {
    query.sellerId = sellerId;
  }

  if (sellerType) {
    query.sellerType = sellerType.toUpperCase();
  }

  if (category) {
    query.category = category;
  }

  if (subCategory) {
    query.subCategory = subCategory;
  }

  if (petType) {
    query.petType = { $in: Array.isArray(petType) ? petType : [petType] };
  }

  if (minPrice || maxPrice) {
    query.price = {};
    if (minPrice) query.price.$gte = Number(minPrice);
    if (maxPrice) query.price.$lte = Number(maxPrice);
  }

  if (tags && tags.length > 0) {
    query.tags = { $in: Array.isArray(tags) ? tags : [tags] };
  }

  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } }
    ];
  }

  const skip = (page - 1) * limit;

  const [productsRaw, total] = await Promise.all([
    Product.find(query)
      .lean()
      .maxTimeMS(3000)
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 }),
    Product.countDocuments(query).maxTimeMS(2000)
  ]);

  // Populate separately for better performance
  const sellerIds = [...new Set(productsRaw.map(p => p.sellerId?.toString()).filter(Boolean))];
  const petStoreIds = [...new Set(productsRaw.map(p => p.petStoreId?.toString()).filter(Boolean))];

  const [sellers, petStores] = await Promise.all([
    sellerIds.length > 0 ? User.find({ _id: { $in: sellerIds } })
      .select('name email phone profileImage')
      .lean()
      .maxTimeMS(2000) : Promise.resolve([]),
    petStoreIds.length > 0 ? require('../models/PetStore').find({ _id: { $in: petStoreIds } })
      .select('name logo')
      .lean()
      .maxTimeMS(2000) : Promise.resolve([])
  ]);

  const sellerMap = {};
  sellers.forEach(s => { sellerMap[s._id.toString()] = s; });
  const petStoreMap = {};
  petStores.forEach(ps => { petStoreMap[ps._id.toString()] = ps; });

  const products = productsRaw.map(p => ({
    ...p,
    sellerId: p.sellerId ? sellerMap[p.sellerId.toString()] : null,
    petStoreId: p.petStoreId ? petStoreMap[p.petStoreId.toString()] : null
  }));

  return {
    products,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };
};

/**
 * Delete product
 */
const deleteProduct = async (id, userId) => {
  const product = await Product.findById(id)
    .maxTimeMS(2000);
  
  if (!product) {
    throw new Error('Product not found');
  }

  const currentUser = await User.findById(userId)
    .maxTimeMS(2000);
  
  if (currentUser.role !== 'ADMIN' && product.sellerId.toString() !== userId) {
    throw new Error('You do not have permission to delete this product');
  }

  if (currentUser.role === 'PET_STORE') {
    const PetStoreSubscription = require('../models/PetStoreSubscription');
    const now = new Date();
    const subscription = await PetStoreSubscription.findOne({
      petStoreOwnerId: userId,
      isActive: true,
      endDate: { $gt: now }
    })
      .lean()
      .maxTimeMS(2000);

    if (!subscription) {
      throw new Error('You must have an active subscription plan to delete products');
    }
  }

  await Product.findByIdAndDelete(id).maxTimeMS(2000);
  return { message: 'Product deleted successfully' };
};

module.exports = {
  createProduct,
  updateProduct,
  getProduct,
  listProducts,
  deleteProduct
};
