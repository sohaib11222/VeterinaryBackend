const Product = require('../models/Product');
const User = require('../models/User');
const SubscriptionPlan = require('../models/SubscriptionPlan');
const VeterinarianSubscription = require('../models/VeterinarianSubscription');

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
    petStoreId
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

  if (sellerType === 'PET_STORE') {
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

  const createDoc = {
    sellerId,
    sellerType: sellerType.toUpperCase(),
    petStoreId: petStoreId || null,
    name,
    price,
    stock: stock || 0,
    description,
    discountPrice,
    images: Array.isArray(images) ? images : [],
    category,
    subCategory,
    petType: petType || [],
    tags: tags || [],
    requiresPrescription: requiresPrescription || false,
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
