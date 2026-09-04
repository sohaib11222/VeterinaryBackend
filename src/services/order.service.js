const Order = require('../models/Order');
const Product = require('../models/Product');
const PetStore = require('../models/PetStore');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const { ORDER_STATUS, PAYMENT_STATUS } = require('../types/enums');
const { sendNewOrderEmail, sendShippingFeeSetEmail } = require('./email.service');
const {
  DELIVERY_DAY_OPTIONS,
  DELIVERY_STATUS,
  DELIVERY_PERFORMANCE,
  isValidDeliveryDays,
  calculateExpectedDeliveryDate,
  deriveDeliveryMonitoring,
} = require('../utils/deliveryMonitoring');

const logEmailFailure = (event, error) => {
  console.error(`[email] Failed to send ${event} email:`, error?.message || error);
};

const DELIVERY_SELECT_FIELDS = 'requestedAt pharmacyAcceptedAt shippingFeeAddedAt customerPaidAt promisedDeliveryDays expectedDeliveryDate actualDeliveredAt totalActualDeliveryDays deliveryStatus deliveryPerformance deliveredAt';

// A late delivery is derived every time an order is read, so no scheduled job
// is required. The latest derived state is also persisted for reporting.
const refreshDeliveryMonitoring = async (orders) => {
  if (!Array.isArray(orders) || orders.length === 0) return orders || [];

  const now = new Date();
  const operations = [];
  const monitoredOrders = orders.map((order) => {
    const monitoring = deriveDeliveryMonitoring(order, now);
    const changed =
      order.deliveryStatus !== monitoring.deliveryStatus ||
      order.deliveryPerformance !== monitoring.deliveryPerformance ||
      order.totalActualDeliveryDays !== monitoring.totalActualDeliveryDays;

    if (changed && order?._id) {
      operations.push({
        updateOne: {
          filter: { _id: order._id },
          update: {
            $set: {
              deliveryStatus: monitoring.deliveryStatus,
              deliveryPerformance: monitoring.deliveryPerformance,
              totalActualDeliveryDays: monitoring.totalActualDeliveryDays,
            },
          },
        },
      });
    }

    return { ...order, ...monitoring };
  });

  if (operations.length) {
    await Order.bulkWrite(operations, { ordered: false });
  }

  return monitoredOrders;
};

const resolveVariant = (product, variantId) => {
  const variants = Array.isArray(product?.variants) ? product.variants : [];
  if (!variants.length) return null;

  if (variantId) {
    return variants.find((variant) => String(variant?._id) === String(variantId)) || null;
  }

  return variants.find((variant) => variant?.isDefault) || variants[0] || null;
};

const getVariantSnapshot = (variant) => {
  if (!variant) return null;
  return {
    strengthValue: variant.strengthValue ?? null,
    strengthUnit: variant.strengthUnit || null,
    dosageForm: variant.dosageForm || null,
    packageType: variant.packageType || null,
    unitsPerPack: variant.unitsPerPack ?? null,
    unitLabel: variant.unitLabel || null,
    packageDescription: variant.packageDescription || null,
    sku: variant.sku || null
  };
};

const syncProductStockFromVariants = (product) => {
  if (!Array.isArray(product?.variants) || !product.variants.length) return;
  product.stock = product.variants.reduce((total, variant) => total + Number(variant?.stock || 0), 0);
  const defaultVariant = product.variants.find((variant) => variant?.isDefault) || product.variants[0];
  if (defaultVariant) {
    product.price = Number(defaultVariant.price || 0);
    product.discountPrice = defaultVariant.discountPrice ?? null;
  }
};

const normalizeShippingAddress = (address = {}) => ({
  line1: String(address?.line1 || '').trim(),
  line2: String(address?.line2 || '').trim(),
  city: String(address?.city || '').trim(),
  state: String(address?.state || '').trim(),
  country: String(address?.country || 'Italy').trim() || 'Italy',
  zip: String(address?.zip || '').trim()
});

const hasCompleteShippingAddress = (address) => Boolean(
  address?.line1 && address?.city && address?.state && address?.zip && address?.country
);

/**
 * Create order
 */
const createOrder = async (petOwnerId, items, shippingAddress, paymentMethod = null) => {
  if (!items || items.length === 0) {
    throw new Error('Order items are required');
  }

  const petOwner = await User.findById(petOwnerId)
    .maxTimeMS(2000);
  if (!petOwner || petOwner.role !== 'PET_OWNER') {
    throw new Error('Pet owner not found');
  }

  // An address is a snapshot of the delivery destination for this order. If a
  // client does not supply a different address, use the owner's saved profile
  // address rather than creating an order the seller cannot ship.
  const requestedShippingAddress = normalizeShippingAddress(shippingAddress);
  const hasRequestedShippingAddress = ['line1', 'line2', 'city', 'state', 'country', 'zip']
    .some((field) => Boolean(String(shippingAddress?.[field] || '').trim()));
  const resolvedShippingAddress = hasRequestedShippingAddress
    ? requestedShippingAddress
    : normalizeShippingAddress(petOwner.address);

  if (!hasCompleteShippingAddress(resolvedShippingAddress)) {
    throw new Error('A complete shipping address is required. Please save an address in your profile or provide a different delivery address.');
  }

  const productIds = items.map(item => item.productId);
  const products = await Product.find({ _id: { $in: productIds } })
    .lean()
    .maxTimeMS(3000);

  if (products.length !== productIds.length) {
    throw new Error('One or more products not found');
  }

  // Group products by pet store
  const petStoreMap = new Map();
  const sellerStoreCache = new Map();

  for (const item of items) {
    const product = products.find(p => p._id.toString() === item.productId.toString());
    if (!product) {
      throw new Error(`Product ${item.productId} not found`);
    }

    const hasVariants = Array.isArray(product.variants) && product.variants.length > 0;
    const variant = resolveVariant(product, item.variantId);
    if (hasVariants && !variant) {
      throw new Error(`Selected variant is no longer available for ${product.name}`);
    }
    if (variant?.isActive === false) {
      throw new Error(`Selected variant is inactive for ${product.name}`);
    }

    if (product.requiresPrescription) {
      const prescriptionRequestService = require('./productPrescriptionRequest.service');
      const isApproved = await prescriptionRequestService.hasApprovedPrescription(
        petOwnerId,
        product._id,
        variant?._id || null
      );
      if (!isApproved) {
        const error = new Error(`An approved prescription is required before purchasing ${product.name}`);
        error.statusCode = 403;
        throw error;
      }
    }

    const availableStock = variant ? Number(variant.stock || 0) : Number(product.stock || 0);
    if (availableStock < item.quantity) {
      throw new Error(`Insufficient stock for product ${product.name}. Available: ${availableStock}, Requested: ${item.quantity}`);
    }

    const sellerKey = product.sellerId?.toString();
    let petStore = sellerKey ? sellerStoreCache.get(sellerKey) : null;
    if (!petStore) {
      petStore = await PetStore.findOne({ ownerId: product.sellerId })
        .lean()
        .maxTimeMS(2000);
      if (sellerKey) {
        sellerStoreCache.set(sellerKey, petStore);
      }
    }
    if (!petStore) {
      throw new Error(`Pet store not found for product ${product.name}`);
    }

    const storeId = petStore._id.toString();
    if (!petStoreMap.has(storeId)) {
      petStoreMap.set(storeId, {
        petStoreId: petStore._id,
        ownerId: petStore.ownerId,
        name: petStore.name,
        items: []
      });
    }

    const itemPrice = variant?.discountPrice ?? variant?.price ?? product.discountPrice ?? product.price;
    const itemTotal = itemPrice * item.quantity;
    petStoreMap.get(storeId).items.push({
      productId: product._id,
      variantId: variant?._id || null,
      variantName: variant?.name || null,
      variantSnapshot: getVariantSnapshot(variant),
      quantity: item.quantity,
      price: variant?.price ?? product.price,
      discountPrice: variant?.discountPrice ?? product.discountPrice,
      total: itemTotal
    });
  }

  const createdOrders = [];
  for (const petStoreData of Array.from(petStoreMap.values())) {
    const requestedAt = new Date();
    const orderItems = petStoreData.items;
    const orderSubtotal = orderItems.reduce((sum, i) => sum + (Number(i.total) || 0), 0);
    const tax = 0;
    const initialShipping = 0;
    const initialTotal = orderSubtotal + initialShipping;

    const order = await Order.create({
      petOwnerId,
      petStoreId: petStoreData.petStoreId,
      ownerId: petStoreData.ownerId,
      items: orderItems,
      subtotal: orderSubtotal,
      tax,
      shipping: initialShipping,
      initialShipping: initialShipping,
      finalShipping: null,
      total: initialTotal,
      initialTotal: initialTotal,
      shippingAddress: resolvedShippingAddress,
      paymentMethod: null,
      status: ORDER_STATUS.PENDING,
      paymentStatus: PAYMENT_STATUS.UNPAID,
      requestedAt,
    });

    const pharmacy = await User.findById(petStoreData.ownerId)
      .select('name email')
      .lean()
      .maxTimeMS(1000);
    const orderedProducts = orderItems.map((orderItem) => {
      const product = products.find((item) => String(item._id) === String(orderItem.productId));
      return {
        name: product?.name || 'Product',
        variantName: orderItem.variantName,
        quantity: orderItem.quantity,
        total: orderItem.total,
      };
    });

    // Order creation must succeed even if SMTP is temporarily unavailable.
    if (pharmacy?.email) {
      await sendNewOrderEmail({
        pharmacy: { ...pharmacy, name: petStoreData.name || pharmacy.name },
        customer: petOwner,
        order,
        products: orderedProducts,
      }).catch((error) => logEmailFailure('new order', error));
    }

    createdOrders.push(order);
  }

  return createdOrders.length === 1 ? createdOrders[0] : { orders: createdOrders };
};

/**
 * Get order by ID
 */
const getOrderById = async (orderId, userId, userRole) => {
  let order = await Order.findById(orderId)
    .select(`petOwnerId petStoreId ownerId items transactionId status paymentStatus total subtotal tax shipping initialShipping finalShipping initialTotal shippingUpdatedAt requiresPaymentUpdate createdAt shippingAddress notes ${DELIVERY_SELECT_FIELDS}`)
    .lean()
    .maxTimeMS(2000);

  if (!order) {
    throw new Error('Order not found');
  }

  // Check authorization first
  if (userRole === 'PET_OWNER' && order.petOwnerId?.toString() !== userId.toString()) {
    throw new Error('Unauthorized: You can only view your own orders');
  }

  if ((userRole === 'PET_STORE' || userRole === 'PARAPHARMACY') && order.ownerId?.toString() !== userId.toString()) {
    throw new Error('Unauthorized: You can only view orders for your pet store');
  }

  [order] = await refreshDeliveryMonitoring([order]);

  // Populate separately
  const [petOwner, petStore, owner, products, transaction] = await Promise.all([
    order.petOwnerId ? User.findById(order.petOwnerId)
      .select('name email phone')
      .lean()
      .maxTimeMS(1000) : null,
    order.petStoreId ? PetStore.findById(order.petStoreId)
      .lean()
      .maxTimeMS(1000) : null,
    order.ownerId ? User.findById(order.ownerId)
      .select('name email')
      .lean()
      .maxTimeMS(1000) : null,
    order.items?.length > 0 ? Product.find({ _id: { $in: order.items.map(i => i.productId).filter(Boolean) } })
      .lean()
      .maxTimeMS(2000) : Promise.resolve([]),
    order.transactionId ? Transaction.findById(order.transactionId)
      .lean()
      .maxTimeMS(1000) : null
  ]);

  // Create product map
  const productMap = {};
  products.forEach(p => { productMap[p._id.toString()] = p; });

  return {
    ...order,
    petOwnerId: petOwner,
    petStoreId: petStore,
    ownerId: owner,
    transactionId: transaction,
    items: order.items?.map(item => ({
      ...item,
      productId: item.productId ? productMap[item.productId.toString()] : null
    })) || []
  };
};

/**
 * Get pet owner orders
 */
const getPetOwnerOrders = async (petOwnerId, options = {}) => {
  const { status, paymentStatus, page = 1, limit = 10 } = options;
  const skip = (page - 1) * limit;

  const query = { petOwnerId };
  if (status) {
    query.status = status.toUpperCase();
  }
  if (paymentStatus) {
    query.paymentStatus = paymentStatus.toUpperCase();
  }

  let [ordersRaw, total] = await Promise.all([
    Order.find(query)
      .select(`petStoreId ownerId items status paymentStatus total subtotal tax shipping initialShipping finalShipping initialTotal shippingUpdatedAt requiresPaymentUpdate createdAt ${DELIVERY_SELECT_FIELDS}`)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean()
      .maxTimeMS(3000),
    Order.countDocuments(query).maxTimeMS(2000)
  ]);

  ordersRaw = await refreshDeliveryMonitoring(ordersRaw);

  // Populate separately
  const storeIds = [...new Set(ordersRaw.map(o => o.petStoreId?.toString()).filter(Boolean))];
  const ownerIds = [...new Set(ordersRaw.map(o => o.ownerId?.toString()).filter(Boolean))];
  const productIds = [...new Set(ordersRaw.flatMap(o => o.items?.map(i => i.productId?.toString()) || []).filter(Boolean))];

  const [stores, owners, products] = await Promise.all([
    storeIds.length > 0 ? PetStore.find({ _id: { $in: storeIds } })
      .select('name logo')
      .lean()
      .maxTimeMS(2000) : Promise.resolve([]),
    ownerIds.length > 0 ? User.find({ _id: { $in: ownerIds } })
      .select('name')
      .lean()
      .maxTimeMS(2000) : Promise.resolve([]),
    productIds.length > 0 ? Product.find({ _id: { $in: productIds } })
      .select('name images price discountPrice')
      .lean()
      .maxTimeMS(2000) : Promise.resolve([])
  ]);

  // Create lookup maps
  const storeMap = {};
  stores.forEach(s => { storeMap[s._id.toString()] = s; });
  const ownerMap = {};
  owners.forEach(o => { ownerMap[o._id.toString()] = o; });
  const productMap = {};
  products.forEach(p => { productMap[p._id.toString()] = p; });

  // Attach populated data
  const orders = ordersRaw.map(order => ({
    ...order,
    petStoreId: order.petStoreId ? storeMap[order.petStoreId.toString()] : null,
    ownerId: order.ownerId ? ownerMap[order.ownerId.toString()] : null,
    items: order.items?.map(item => ({
      ...item,
      productId: item.productId ? productMap[item.productId.toString()] : null
    })) || []
  }));

  return {
    orders,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };
};

/**
 * Get pet store orders
 */
const getPetStoreOrders = async (ownerId, options = {}) => {
  const { status, paymentStatus, page = 1, limit = 10 } = options;
  const skip = (page - 1) * limit;

  const query = { ownerId };
  if (status) {
    query.status = status.toUpperCase();
  }
  if (paymentStatus) {
    query.paymentStatus = paymentStatus.toUpperCase();
  }

  let [ordersRaw, total] = await Promise.all([
    Order.find(query)
      .select(`petOwnerId petStoreId ownerId items status paymentStatus total subtotal tax shipping initialShipping finalShipping initialTotal shippingUpdatedAt requiresPaymentUpdate createdAt ${DELIVERY_SELECT_FIELDS}`)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean()
      .maxTimeMS(3000),
    Order.countDocuments(query).maxTimeMS(2000)
  ]);

  ordersRaw = await refreshDeliveryMonitoring(ordersRaw);

  // Populate separately
  const petOwnerIds = [...new Set(ordersRaw.map(o => o.petOwnerId?.toString()).filter(Boolean))];
  const storeIds = [...new Set(ordersRaw.map(o => o.petStoreId?.toString()).filter(Boolean))];
  const productIds = [...new Set(ordersRaw.flatMap(o => o.items?.map(i => i.productId?.toString()) || []).filter(Boolean))];

  const [petOwners, stores, products] = await Promise.all([
    petOwnerIds.length > 0 ? User.find({ _id: { $in: petOwnerIds } })
      .select('name email phone')
      .lean()
      .maxTimeMS(2000) : Promise.resolve([]),
    storeIds.length > 0 ? PetStore.find({ _id: { $in: storeIds } })
      .select('name')
      .lean()
      .maxTimeMS(2000) : Promise.resolve([]),
    productIds.length > 0 ? Product.find({ _id: { $in: productIds } })
      .select('name images price discountPrice')
      .lean()
      .maxTimeMS(2000) : Promise.resolve([])
  ]);

  // Create lookup maps
  const petOwnerMap = {};
  petOwners.forEach(p => { petOwnerMap[p._id.toString()] = p; });
  const storeMap = {};
  stores.forEach(s => { storeMap[s._id.toString()] = s; });
  const productMap = {};
  products.forEach(p => { productMap[p._id.toString()] = p; });

  // Attach populated data
  const orders = ordersRaw.map(order => ({
    ...order,
    petOwnerId: order.petOwnerId ? petOwnerMap[order.petOwnerId.toString()] : null,
    petStoreId: order.petStoreId ? storeMap[order.petStoreId.toString()] : null,
    items: order.items?.map(item => ({
      ...item,
      productId: item.productId ? productMap[item.productId.toString()] : null
    })) || []
  }));

  return {
    orders,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };
};

/**
 * Get all orders (admin only)
 */
const getAllOrders = async (options = {}) => {
  const { status, paymentStatus, petStoreId, petOwnerId, page = 1, limit = 10 } = options;
  const skip = (page - 1) * limit;

  const query = {};
  if (status) {
    query.status = status.toUpperCase();
  }
  if (petStoreId) {
    query.petStoreId = petStoreId;
  }
  if (petOwnerId) {
    query.petOwnerId = petOwnerId;
  }
  if (paymentStatus) {
    query.paymentStatus = paymentStatus.toUpperCase();
  }

  let [ordersRaw, total] = await Promise.all([
    Order.find(query)
      .select(`petOwnerId petStoreId ownerId items status paymentStatus total subtotal tax shipping initialShipping finalShipping initialTotal shippingUpdatedAt requiresPaymentUpdate createdAt ${DELIVERY_SELECT_FIELDS}`)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean()
      .maxTimeMS(3000),
    Order.countDocuments(query).maxTimeMS(2000)
  ]);

  ordersRaw = await refreshDeliveryMonitoring(ordersRaw);

  // Populate separately
  const petOwnerIds = [...new Set(ordersRaw.map(o => o.petOwnerId?.toString()).filter(Boolean))];
  const storeIds = [...new Set(ordersRaw.map(o => o.petStoreId?.toString()).filter(Boolean))];
  const ownerIds = [...new Set(ordersRaw.map(o => o.ownerId?.toString()).filter(Boolean))];
  const productIds = [...new Set(ordersRaw.flatMap(o => o.items?.map(i => i.productId?.toString()) || []).filter(Boolean))];

  const [petOwners, stores, owners, products] = await Promise.all([
    petOwnerIds.length > 0 ? User.find({ _id: { $in: petOwnerIds } })
      .select('name email phone')
      .lean()
      .maxTimeMS(2000) : Promise.resolve([]),
    storeIds.length > 0 ? PetStore.find({ _id: { $in: storeIds } })
      .select('name logo')
      .lean()
      .maxTimeMS(2000) : Promise.resolve([]),
    ownerIds.length > 0 ? User.find({ _id: { $in: ownerIds } })
      .select('name email')
      .lean()
      .maxTimeMS(2000) : Promise.resolve([]),
    productIds.length > 0 ? Product.find({ _id: { $in: productIds } })
      .select('name images price discountPrice')
      .lean()
      .maxTimeMS(2000) : Promise.resolve([])
  ]);

  // Create lookup maps
  const petOwnerMap = {};
  petOwners.forEach(p => { petOwnerMap[p._id.toString()] = p; });
  const storeMap = {};
  stores.forEach(s => { storeMap[s._id.toString()] = s; });
  const ownerMap = {};
  owners.forEach(o => { ownerMap[o._id.toString()] = o; });
  const productMap = {};
  products.forEach(p => { productMap[p._id.toString()] = p; });

  // Attach populated data
  const orders = ordersRaw.map(order => ({
    ...order,
    petOwnerId: order.petOwnerId ? petOwnerMap[order.petOwnerId.toString()] : null,
    petStoreId: order.petStoreId ? storeMap[order.petStoreId.toString()] : null,
    ownerId: order.ownerId ? ownerMap[order.ownerId.toString()] : null,
    items: order.items?.map(item => ({
      ...item,
      productId: item.productId ? productMap[item.productId.toString()] : null
    })) || []
  }));

  return {
    orders,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };
};

/**
 * Delivery commitment report for Pet Admin. A late, undelivered order is
 * included as late immediately after its saved expected delivery date.
 */
const getDeliveryPerformance = async () => {
  let orders = await Order.find({})
    .select(`petStoreId ownerId status ${DELIVERY_SELECT_FIELDS}`)
    .lean()
    .maxTimeMS(10000);

  orders = await refreshDeliveryMonitoring(orders);

  const storeIds = [...new Set(orders.map((order) => order.petStoreId?.toString()).filter(Boolean))];
  const ownerIds = [...new Set(orders.map((order) => order.ownerId?.toString()).filter(Boolean))];
  const [stores, owners] = await Promise.all([
    storeIds.length
      ? PetStore.find({ _id: { $in: storeIds } }).select('name ownerId').lean().maxTimeMS(3000)
      : Promise.resolve([]),
    ownerIds.length
      ? User.find({ _id: { $in: ownerIds } }).select('name role').lean().maxTimeMS(3000)
      : Promise.resolve([]),
  ]);

  const storeMap = new Map(stores.map((store) => [String(store._id), store]));
  const ownerMap = new Map(owners.map((owner) => [String(owner._id), owner]));
  const reportByStore = new Map();

  orders.forEach((order) => {
    if (['CANCELLED', 'REFUNDED'].includes(String(order.status || '').toUpperCase())) return;

    const storeId = String(order.petStoreId || order.ownerId || 'unknown');
    const store = storeMap.get(storeId);
    const owner = ownerMap.get(String(order.ownerId || store?.ownerId || ''));
    const current = reportByStore.get(storeId) || {
      petStoreId: storeId === 'unknown' ? null : storeId,
      pharmacyName: store?.name || owner?.name || 'Unassigned pharmacy',
      storeType: String(owner?.role || '').toUpperCase() === 'PARAPHARMACY' ? 'Parapharmacy' : 'Pharmacy',
      totalOrders: 0,
      onTimeOrders: 0,
      lateOrders: 0,
      awaitingDeliveryOrders: 0,
      deliveredOrders: 0,
      deliveryDays: [],
    };

    current.totalOrders += 1;
    if (order.actualDeliveredAt || order.deliveredAt) {
      current.deliveredOrders += 1;
      if (Number.isFinite(Number(order.totalActualDeliveryDays))) {
        current.deliveryDays.push(Number(order.totalActualDeliveryDays));
      }
    }

    if (order.deliveryPerformance === DELIVERY_PERFORMANCE.ON_TIME) {
      current.onTimeOrders += 1;
    } else if (order.deliveryStatus === DELIVERY_STATUS.LATE) {
      current.lateOrders += 1;
    } else if (order.expectedDeliveryDate) {
      current.awaitingDeliveryOrders += 1;
    }

    reportByStore.set(storeId, current);
  });

  const pharmacies = Array.from(reportByStore.values())
    .map(({ deliveryDays, ...report }) => {
      const completedForPerformance = report.onTimeOrders + report.lateOrders;
      return {
        ...report,
        averageDeliveryTime: deliveryDays.length
          ? Number((deliveryDays.reduce((sum, days) => sum + days, 0) / deliveryDays.length).toFixed(1))
          : null,
        onTimeDeliveryPercentage: completedForPerformance
          ? Number(((report.onTimeOrders / completedForPerformance) * 100).toFixed(1))
          : null,
      };
    })
    .sort((a, b) => b.lateOrders - a.lateOrders || b.totalOrders - a.totalOrders || a.pharmacyName.localeCompare(b.pharmacyName));

  return {
    pharmacies,
    summary: {
      totalOrders: pharmacies.reduce((sum, pharmacy) => sum + pharmacy.totalOrders, 0),
      onTimeOrders: pharmacies.reduce((sum, pharmacy) => sum + pharmacy.onTimeOrders, 0),
      lateOrders: pharmacies.reduce((sum, pharmacy) => sum + pharmacy.lateOrders, 0),
      awaitingDeliveryOrders: pharmacies.reduce((sum, pharmacy) => sum + pharmacy.awaitingDeliveryOrders, 0),
    },
  };
};

/**
 * Update order status
 */
const updateOrderStatus = async (orderId, status, userId, userRole) => {
  const order = await Order.findById(orderId);

  if (!order) {
    throw new Error('Order not found');
  }

  if ((userRole === 'PET_STORE' || userRole === 'PARAPHARMACY') && order.ownerId.toString() !== userId.toString()) {
    throw new Error('Unauthorized: You can only update orders for your pet store');
  }

  if (userRole !== 'ADMIN' && userRole !== 'PET_STORE' && userRole !== 'PARAPHARMACY') {
    throw new Error('Unauthorized: Only pet store owners and admins can update order status');
  }

  if (order.paymentStatus !== 'PAID' && status.toUpperCase() !== 'CANCELLED') {
    throw new Error('Cannot update order status until the order has been paid');
  }

  const validStatuses = ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED'];
  if (!validStatuses.includes(status.toUpperCase())) {
    throw new Error(`Invalid status. Valid statuses: ${validStatuses.join(', ')}`);
  }

  order.status = status.toUpperCase();

  if (status.toUpperCase() === 'DELIVERED') {
    const deliveredAt = new Date();
    order.deliveredAt = deliveredAt;
    order.actualDeliveredAt = deliveredAt;

    const monitoring = deriveDeliveryMonitoring(order, deliveredAt);
    order.deliveryStatus = monitoring.deliveryStatus;
    order.deliveryPerformance = monitoring.deliveryPerformance;
    order.totalActualDeliveryDays = monitoring.totalActualDeliveryDays;
  }

  await order.save();
  return order;
};

/**
 * Update shipping fee
 */
const updateShippingFee = async (orderId, shippingFee, deliveryDays, userId, userRole) => {
  const order = await Order.findById(orderId);

  if (!order) {
    throw new Error('Order not found');
  }

  if (userRole !== 'PET_STORE' && userRole !== 'PARAPHARMACY' || order.ownerId.toString() !== userId.toString()) {
    throw new Error('Unauthorized: Only the pet store owner can update shipping fee');
  }

  if (order.paymentStatus === 'PAID') {
    throw new Error('Cannot update shipping fee for an order that has already been paid');
  }

  if (typeof shippingFee !== 'number' || shippingFee < 0) {
    throw new Error('Shipping fee must be a non-negative number');
  }

  if (!isValidDeliveryDays(deliveryDays)) {
    throw new Error(`Expected delivery time is required and must be one of: ${DELIVERY_DAY_OPTIONS.join(', ')} days`);
  }

  const finalShipping = shippingFee;
  const finalTotal = (Number(order.subtotal) || 0) + finalShipping;
  const shippingFeeAddedAt = new Date();

  order.tax = 0;
  order.shipping = finalShipping;
  order.finalShipping = finalShipping;
  order.total = finalTotal;
  order.shippingUpdatedAt = shippingFeeAddedAt;
  order.pharmacyAcceptedAt = order.pharmacyAcceptedAt || shippingFeeAddedAt;
  order.shippingFeeAddedAt = shippingFeeAddedAt;
  order.promisedDeliveryDays = Number(deliveryDays);
  order.expectedDeliveryDate = calculateExpectedDeliveryDate(shippingFeeAddedAt, deliveryDays);
  order.deliveryStatus = DELIVERY_STATUS.ON_TIME;
  order.deliveryPerformance = DELIVERY_PERFORMANCE.PENDING;
  order.totalActualDeliveryDays = null;
  order.requiresPaymentUpdate = false;

  await order.save();

  const [petOwner, pharmacy, petStore] = await Promise.all([
    User.findById(order.petOwnerId)
      .select('name email')
      .lean()
      .maxTimeMS(1000),
    User.findById(order.ownerId)
      .select('name email')
      .lean()
      .maxTimeMS(1000),
    PetStore.findById(order.petStoreId)
      .select('name')
      .lean()
      .maxTimeMS(1000),
  ]);

  // The fee is saved even if a transient SMTP failure occurs; the patient can
  // still see and pay the updated total in the order panel.
  if (petOwner?.email) {
    await sendShippingFeeSetEmail({
      petOwner,
      pharmacy: { ...pharmacy, name: petStore?.name || pharmacy?.name },
      order,
    }).catch((error) => logEmailFailure('shipping fee update', error));
  }

  return order;
};

/**
 * Pay for order
 */
const payForOrder = async (orderId, userId, userRole, paymentMethod = 'DUMMY') => {
  const balanceService = require('./balance.service');
  
  // Fetch order WITHOUT .lean() so we can call .save() later
  const order = await Order.findById(orderId)
    .maxTimeMS(2000);

  if (!order) {
    throw new Error('Order not found');
  }

  if (userRole !== 'PET_OWNER') {
    throw new Error('Unauthorized: Only pet owners can pay for orders');
  }

  if (order.petOwnerId.toString() !== userId.toString()) {
    throw new Error('Unauthorized: You can only pay for your own orders');
  }

  if (order.paymentStatus === 'PAID') {
    throw new Error('Order is already paid');
  }

  if (order.finalShipping === null || order.finalShipping === undefined) {
    throw new Error('Shipping fee must be set by the pet store owner before payment');
  }

  if (paymentMethod && !['DUMMY', 'STRIPE'].includes(String(paymentMethod).toUpperCase())) {
    throw new Error('Unsupported payment method');
  }

  // Get product IDs for stock checking
  const productIds = [...new Set(order.items.map(item => item.productId?.toString()).filter(Boolean))];
  
  // Fetch products WITHOUT .lean() so we can call .save() later
  const products = productIds.length > 0 ? await Product.find({ _id: { $in: productIds } })
    .maxTimeMS(2000) : [];

  // Check stock before creating transaction
  for (const item of order.items) {
    const product = products.find(p => p._id.toString() === item.productId?.toString());
    if (product) {
      const hasVariants = Array.isArray(product.variants) && product.variants.length > 0;
      const variant = resolveVariant(product, item.variantId);
      if (hasVariants && !variant) {
        throw new Error(`Selected variant is no longer available for ${product.name}`);
      }
      const availableStock = variant ? Number(variant.stock || 0) : Number(product.stock || 0);
      if (availableStock < item.quantity) {
        throw new Error(`Insufficient stock for product ${product.name}. Available: ${availableStock}, Requested: ${item.quantity}`);
      }
    }
  }

  // Create transaction
  const transaction = await Transaction.create({
    userId: order.petOwnerId,
    amount: order.total,
    currency: 'EUR',
    relatedOrderId: orderId,
    status: 'SUCCESS',
    provider: paymentMethod,
    providerReference: `ORD-${Date.now()}-${orderId}`
  });

  // Update order
  order.paymentStatus = 'PAID';
  order.status = 'CONFIRMED';
  order.paymentMethod = paymentMethod;
  order.transactionId = transaction._id;
  order.customerPaidAt = new Date();
  await order.save();

  // Reduce product stock
  for (const item of order.items) {
    const product = products.find(p => p._id.toString() === item.productId?.toString());
    if (product) {
      const variant = resolveVariant(product, item.variantId);
      if (variant) {
        variant.stock = Math.max(0, Number(variant.stock || 0) - Number(item.quantity || 0));
        syncProductStockFromVariants(product);
      } else {
        product.stock -= item.quantity;
      }
      await product.save();
    }
  }

  // Credit seller balance
  try {
    await balanceService.creditBalance(
      order.ownerId.toString(),
      order.total,
      'PRODUCT',
      {
        orderId: order._id.toString(),
        orderNumber: order.orderNumber,
        transactionId: transaction._id.toString()
      }
    );
  } catch (error) {
    console.error('Error crediting seller balance:', error);
  }

  return order;
};

/**
 * Cancel order
 */
const cancelOrder = async (orderId, userId, userRole) => {
  // Fetch order WITHOUT .lean() so we can call .save() later
  const order = await Order.findById(orderId)
    .maxTimeMS(2000);

  if (!order) {
    throw new Error('Order not found');
  }

  if (userRole === 'PET_OWNER' && order.petOwnerId.toString() !== userId.toString()) {
    throw new Error('Unauthorized: You can only cancel your own orders');
  }

  if ((userRole === 'PET_STORE' || userRole === 'PARAPHARMACY') && order.ownerId.toString() !== userId.toString()) {
    throw new Error('Unauthorized: You can only cancel orders for your pet store');
  }

  if (!['PENDING', 'CONFIRMED'].includes(order.status)) {
    throw new Error(`Cannot cancel order with status: ${order.status}`);
  }

  if (order.paymentStatus === 'PAID') {
    throw new Error('Cannot cancel an order that has already been paid');
  }

  // Stock is reduced only once payment succeeds. An unpaid order therefore has
  // nothing to restore when it is cancelled.

  order.status = 'CANCELLED';
  await order.save();

  return order;
};

module.exports = {
  createOrder,
  getOrderById,
  getPetOwnerOrders,
  getPetStoreOrders,
  getAllOrders,
  getDeliveryPerformance,
  updateOrderStatus,
  updateShippingFee,
  payForOrder,
  cancelOrder
};
