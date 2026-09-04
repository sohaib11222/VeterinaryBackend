const mongoose = require('mongoose');
const { ORDER_STATUS, PAYMENT_STATUS } = require('../types/enums');

const orderItemSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  variantId: {
    type: mongoose.Schema.Types.ObjectId,
    default: null
  },
  variantName: {
    type: String,
    default: null
  },
  variantSnapshot: {
    strengthValue: { type: Number, default: null },
    strengthUnit: { type: String, default: null },
    dosageForm: { type: String, default: null },
    packageType: { type: String, default: null },
    unitsPerPack: { type: Number, default: null },
    unitLabel: { type: String, default: null },
    packageDescription: { type: String, default: null },
    sku: { type: String, default: null }
  },
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  price: {
    type: Number,
    required: true
  },
  discountPrice: {
    type: Number,
    default: null
  },
  total: {
    type: Number,
    required: true
  }
}, { _id: true });

const orderSchema = new mongoose.Schema({
  orderNumber: {
    type: String,
    unique: true,
    required: false
  },
  petOwnerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  petStoreId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PetStore',
    required: true
  },
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true // Pet store owner
  },
  items: [orderItemSchema],
  subtotal: {
    type: Number,
    required: true
  },
  tax: {
    type: Number,
    default: 0
  },
  shipping: {
    type: Number,
    default: 0
  },
  initialShipping: {
    type: Number,
    default: 0
  },
  finalShipping: {
    type: Number,
    default: null
  },
  shippingUpdatedAt: {
    type: Date,
    default: null
  },
  // Delivery commitment audit trail. These fields are kept independently from
  // the general order status so delivery performance can be measured reliably.
  requestedAt: {
    type: Date,
    default: Date.now
  },
  pharmacyAcceptedAt: {
    type: Date,
    default: null
  },
  shippingFeeAddedAt: {
    type: Date,
    default: null
  },
  customerPaidAt: {
    type: Date,
    default: null
  },
  promisedDeliveryDays: {
    type: Number,
    enum: [2, 3, 4, 5],
    default: null
  },
  expectedDeliveryDate: {
    type: Date,
    default: null
  },
  actualDeliveredAt: {
    type: Date,
    default: null
  },
  totalActualDeliveryDays: {
    type: Number,
    default: null
  },
  deliveryStatus: {
    type: String,
    enum: ['AWAITING_DELIVERY', 'ON_TIME', 'DELIVERED', 'LATE'],
    default: 'AWAITING_DELIVERY'
  },
  deliveryPerformance: {
    type: String,
    enum: ['PENDING', 'ON_TIME', 'LATE'],
    default: 'PENDING'
  },
  total: {
    type: Number,
    required: true
  },
  initialTotal: {
    type: Number,
    default: null
  },
  status: {
    type: String,
    enum: Object.values(ORDER_STATUS),
    default: ORDER_STATUS.PENDING
  },
  paymentStatus: {
    type: String,
    enum: Object.values(PAYMENT_STATUS),
    default: PAYMENT_STATUS.UNPAID
  },
  requiresPaymentUpdate: {
    type: Boolean,
    default: false
  },
  paymentMethod: {
    type: String,
    default: null
  },
  transactionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Transaction',
    default: null
  },
  shippingAddress: {
    line1: { type: String, default: null },
    line2: { type: String, default: null },
    city: { type: String, default: null },
    state: { type: String, default: null },
    country: { type: String, default: null },
    zip: { type: String, default: null }
  },
  notes: {
    type: String,
    default: null
  },
  deliveredAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Generate unique order number before saving
orderSchema.pre('save', async function(next) {
  if (!this.orderNumber || this.orderNumber.trim() === '') {
    let orderNumber;
    let isUnique = false;
    let attempts = 0;
    const maxAttempts = 10;
    
    while (!isUnique && attempts < maxAttempts) {
      const timestamp = Date.now();
      const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
      orderNumber = `ORD-${timestamp}-${random}`;
      
      const existingOrder = await this.constructor.findOne({ orderNumber });
      if (!existingOrder) {
        isUnique = true;
      }
      attempts++;
    }
    
    if (!isUnique) {
      const timestamp = Date.now();
      const random1 = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
      const random2 = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
      orderNumber = `ORD-${timestamp}-${random1}-${random2}`;
    }
    
    this.orderNumber = orderNumber;
  }
  next();
});

// Indexes
orderSchema.index({ petOwnerId: 1, createdAt: -1 });
orderSchema.index({ ownerId: 1, createdAt: -1 });
orderSchema.index({ petStoreId: 1, createdAt: -1 });
orderSchema.index({ status: 1 });
orderSchema.index({ orderNumber: 1 });
orderSchema.index({ ownerId: 1, expectedDeliveryDate: 1 });
orderSchema.index({ petStoreId: 1, expectedDeliveryDate: 1 });
orderSchema.index({ deliveryStatus: 1, expectedDeliveryDate: 1 });

module.exports = mongoose.model('Order', orderSchema);
