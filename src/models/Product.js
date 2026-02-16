const mongoose = require('mongoose');
const { PET_SPECIES } = require('../types/enums');

const productSchema = new mongoose.Schema({
  sellerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  sellerType: {
    type: String,
    enum: ['VETERINARIAN', 'PET_STORE', 'ADMIN'],
    default: null
  },
  petStoreId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PetStore',
    default: null
  },
  name: {
    type: String,
    required: true
  },
  description: {
    type: String,
    default: null
  },
  sku: {
    type: String,
    default: undefined,
    unique: true,
    sparse: true
  },
  price: {
    type: Number,
    required: true
  },
  discountPrice: {
    type: Number,
    default: null
  },
  images: {
    type: [String],
    default: []
  },
  stock: {
    type: Number,
    default: 0
  },
  category: {
    type: String,
    default: null // Food, Medication, Toys, Accessories, Grooming, Supplements, etc.
  },
  subCategory: {
    type: String,
    default: null
  },
  petType: {
    type: [String],
    enum: Object.values(PET_SPECIES),
    default: [] // Which pet types this product is for
  },
  tags: {
    type: [String],
    default: []
  },
  requiresPrescription: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Indexes
productSchema.index({ sellerId: 1, isActive: 1 });
productSchema.index({ petStoreId: 1 });
productSchema.index({ category: 1 });
productSchema.index({ petType: 1 });
productSchema.index({ isActive: 1 });

module.exports = mongoose.model('Product', productSchema);
