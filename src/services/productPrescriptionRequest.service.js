const ProductPrescriptionRequest = require('../models/ProductPrescriptionRequest');
const Product = require('../models/Product');
const PetStore = require('../models/PetStore');
const User = require('../models/User');
const notificationService = require('./notification.service');
const { validateObjectId } = require('../utils/validation');

const resolveVariant = (product, requestedVariantId) => {
  const variants = Array.isArray(product?.variants) ? product.variants : [];
  if (!variants.length) return null;

  if (requestedVariantId) {
    return variants.find((variant) => String(variant?._id) === String(requestedVariantId)) || null;
  }

  return variants.find((variant) => variant?.isDefault) || variants[0] || null;
};

const getPrescriptionProduct = async (productId) => {
  validateObjectId(productId, 'Product ID');
  const product = await Product.findById(productId).lean().maxTimeMS(2000);
  if (!product) throw new Error('Product not found');
  if (!product.requiresPrescription) throw new Error('This product does not require a prescription');
  if (String(product.sellerType || '').toUpperCase() !== 'PET_STORE') {
    throw new Error('Prescription requests can only be sent to a pharmacy');
  }
  return product;
};

const getPharmacyForProduct = async (product) => {
  const query = product.petStoreId ? { _id: product.petStoreId } : { ownerId: product.sellerId };
  const pharmacy = await PetStore.findOne(query).lean().maxTimeMS(2000);
  if (!pharmacy || !pharmacy.ownerId) throw new Error('Pharmacy for this product is not available');
  if (pharmacy.isPublic === false) throw new Error('This pharmacy is not currently available');
  return pharmacy;
};

const submitRequest = async (petOwnerId, data) => {
  const { productId, variantId, prescriptionUrl, originalName, mimeType } = data || {};
  if (!prescriptionUrl || !String(prescriptionUrl).trim()) throw new Error('Prescription file is required');

  const [petOwner, product] = await Promise.all([
    User.findById(petOwnerId).select('role').lean().maxTimeMS(1000),
    getPrescriptionProduct(productId),
  ]);
  if (!petOwner || String(petOwner.role || '').toUpperCase() !== 'PET_OWNER') throw new Error('Pet owner not found');

  const selectedVariant = resolveVariant(product, variantId);
  if (Array.isArray(product.variants) && product.variants.length > 0 && !selectedVariant) {
    throw new Error('Selected product variant is no longer available');
  }
  if (selectedVariant?.isActive === false) throw new Error('Selected product variant is inactive');

  const pharmacy = await getPharmacyForProduct(product);
  const existingPending = await ProductPrescriptionRequest.findOne({
    petOwnerId,
    productId: product._id,
    variantId: selectedVariant?._id || null,
    status: 'PENDING',
  }).lean().maxTimeMS(2000);
  if (existingPending) {
    const error = new Error('Your prescription for this product is already under review');
    error.statusCode = 409;
    throw error;
  }

  const request = await ProductPrescriptionRequest.create({
    petOwnerId,
    productId: product._id,
    variantId: selectedVariant?._id || null,
    pharmacyId: pharmacy._id,
    pharmacyOwnerId: pharmacy.ownerId,
    prescriptionUrl: String(prescriptionUrl).trim(),
    originalName: String(originalName || '').trim() || null,
    mimeType: String(mimeType || '').trim() || null,
  });

  await notificationService.createNotification({
    userId: pharmacy.ownerId,
    title: 'New prescription request',
    body: `A customer submitted a prescription for ${product.name}.`,
    type: 'PRESCRIPTION_REQUEST',
    data: { prescriptionRequestId: request._id.toString(), productId: product._id.toString() },
  });

  return request.toObject();
};

const getEligibility = async (petOwnerId, productId, variantId) => {
  const product = await getPrescriptionProduct(productId);
  const selectedVariant = resolveVariant(product, variantId);
  if (Array.isArray(product.variants) && product.variants.length > 0 && !selectedVariant) {
    throw new Error('Selected product variant is no longer available');
  }

  const request = await ProductPrescriptionRequest.findOne({
    petOwnerId,
    productId: product._id,
    variantId: selectedVariant?._id || null,
  })
    .sort({ createdAt: -1 })
    .lean()
    .maxTimeMS(2000);

  return {
    requiresPrescription: true,
    canPurchase: request?.status === 'APPROVED',
    status: request?.status || 'NOT_SUBMITTED',
    request: request || null,
  };
};

const listMine = async (petOwnerId, options = {}) => {
  const { page = 1, limit = 30 } = options;
  const skip = (Math.max(1, Number(page) || 1) - 1) * Math.max(1, Number(limit) || 30);
  const normalizedLimit = Math.min(100, Math.max(1, Number(limit) || 30));
  const [requests, total] = await Promise.all([
    ProductPrescriptionRequest.find({ petOwnerId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(normalizedLimit)
      .lean()
      .maxTimeMS(2000),
    ProductPrescriptionRequest.countDocuments({ petOwnerId }).maxTimeMS(2000),
  ]);
  return hydrateRequests(requests, { page, limit: normalizedLimit, total });
};

const listForPharmacy = async (pharmacyOwnerId, options = {}) => {
  const { status, page = 1, limit = 30 } = options;
  const query = { pharmacyOwnerId };
  if (status && String(status).toUpperCase() !== 'ALL') query.status = String(status).toUpperCase();
  const normalizedLimit = Math.min(100, Math.max(1, Number(limit) || 30));
  const currentPage = Math.max(1, Number(page) || 1);
  const skip = (currentPage - 1) * normalizedLimit;
  const [requests, total] = await Promise.all([
    ProductPrescriptionRequest.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(normalizedLimit)
      .lean()
      .maxTimeMS(2000),
    ProductPrescriptionRequest.countDocuments(query).maxTimeMS(2000),
  ]);
  return hydrateRequests(requests, { page: currentPage, limit: normalizedLimit, total });
};

const hydrateRequests = async (requests, pagination) => {
  const ownerIds = [...new Set(requests.map((request) => request.petOwnerId?.toString()).filter(Boolean))];
  const productIds = [...new Set(requests.map((request) => request.productId?.toString()).filter(Boolean))];
  const [owners, products] = await Promise.all([
    ownerIds.length ? User.find({ _id: { $in: ownerIds } }).select('name fullName email phone').lean().maxTimeMS(2000) : [],
    productIds.length ? Product.find({ _id: { $in: productIds } }).select('name images variants').lean().maxTimeMS(2000) : [],
  ]);
  const ownerMap = Object.fromEntries(owners.map((owner) => [owner._id.toString(), owner]));
  const productMap = Object.fromEntries(products.map((product) => [product._id.toString(), product]));

  return {
    requests: requests.map((request) => {
      const product = productMap[request.productId?.toString()] || null;
      const variant = product?.variants?.find((item) => String(item?._id) === String(request.variantId)) || null;
      return {
        ...request,
        petOwnerId: ownerMap[request.petOwnerId?.toString()] || null,
        productId: product ? { ...product, selectedVariant: variant } : null,
      };
    }),
    pagination: {
      ...pagination,
      pages: Math.ceil(pagination.total / pagination.limit),
    },
  };
};

const reviewRequest = async (pharmacyOwnerId, requestId, data) => {
  validateObjectId(requestId, 'Prescription request ID');
  const status = String(data?.status || '').toUpperCase();
  if (!['APPROVED', 'REJECTED'].includes(status)) throw new Error('Review status must be APPROVED or REJECTED');

  const request = await ProductPrescriptionRequest.findById(requestId).maxTimeMS(2000);
  if (!request) throw new Error('Prescription request not found');
  if (String(request.pharmacyOwnerId) !== String(pharmacyOwnerId)) {
    const error = new Error('You can only review prescriptions sent to your pharmacy');
    error.statusCode = 403;
    throw error;
  }
  if (request.status !== 'PENDING') throw new Error('This prescription request has already been reviewed');

  request.status = status;
  request.reviewNotes = String(data?.reviewNotes || '').trim() || null;
  request.reviewedBy = pharmacyOwnerId;
  request.reviewedAt = new Date();
  request.approvedAt = status === 'APPROVED' ? new Date() : null;
  await request.save();

  const product = await Product.findById(request.productId).select('name').lean().maxTimeMS(1000);
  const approved = status === 'APPROVED';
  await notificationService.createNotification({
    userId: request.petOwnerId,
    title: approved ? 'Prescription approved' : 'Prescription needs attention',
    body: approved
      ? `Your prescription for ${product?.name || 'this medicine'} has been approved. You can now purchase it.`
      : `Your prescription for ${product?.name || 'this medicine'} was not approved. ${request.reviewNotes || 'Please upload a new prescription and try again.'}`,
    type: approved ? 'PRESCRIPTION_APPROVED' : 'PRESCRIPTION_REJECTED',
    data: { prescriptionRequestId: request._id.toString(), productId: request.productId.toString(), variantId: request.variantId?.toString() || null },
  });

  return request.toObject();
};

const countPendingForPharmacy = async (pharmacyOwnerId) => {
  const pendingCount = await ProductPrescriptionRequest.countDocuments({ pharmacyOwnerId, status: 'PENDING' }).maxTimeMS(2000);
  return { pendingCount };
};

const hasApprovedPrescription = async (petOwnerId, productId, variantId) => ProductPrescriptionRequest.exists({
  petOwnerId,
  productId,
  variantId: variantId || null,
  status: 'APPROVED',
});

module.exports = {
  submitRequest,
  getEligibility,
  listMine,
  listForPharmacy,
  reviewRequest,
  countPendingForPharmacy,
  hasApprovedPrescription,
};
