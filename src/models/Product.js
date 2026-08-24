const mongoose = require('mongoose');
const { PET_SPECIES } = require('../types/enums');

const productVariantSchema = new mongoose.Schema({
  name: { type: String, required: true },
  sku: { type: String, default: null },
  barcode: { type: String, default: null },
  strengthValue: { type: Number, default: null },
  strengthUnit: { type: String, default: null },
  dosageForm: { type: String, default: null },
  packageType: { type: String, default: null },
  unitsPerPack: { type: Number, default: null },
  unitLabel: { type: String, default: null },
  packageDescription: { type: String, default: null },
  price: { type: Number, required: true, min: 0 },
  discountPrice: { type: Number, default: null, min: 0 },
  stock: { type: Number, default: 0, min: 0 },
  isDefault: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true }
}, { _id: true });

const medicineDetailsSchema = new mongoose.Schema({
  activeIngredients: { type: String, default: null },
  administrationRoute: { type: String, default: null },
  targetSpecies: { type: [String], enum: Object.values(PET_SPECIES), default: [] },
  indications: { type: String, default: null },
  dosageInstructions: { type: String, default: null },
  warnings: { type: String, default: null },
  storageInstructions: { type: String, default: null },
  manufacturer: { type: String, default: null },
  authorizationHolder: { type: String, default: null },
  aicNumber: { type: String, default: null },
  leafletUrl: { type: String, default: null }
}, { _id: false });

const parapharmacyDetailsSchema = new mongoose.Schema({
  productClass: { type: String, default: null },
  ingredients: { type: String, default: null },
  allergens: { type: String, default: null },
  targetSpecies: { type: [String], enum: Object.values(PET_SPECIES), default: [] },
  lifeStage: { type: String, default: null },
  usageInstructions: { type: String, default: null },
  warnings: { type: String, default: null },
  storageInstructions: { type: String, default: null },
  manufacturer: { type: String, default: null }
}, { _id: false });

const productSchema = new mongoose.Schema({
  sellerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  sellerType: {
    type: String,
    enum: ['VETERINARIAN', 'PET_STORE', 'PARAPHARMACY', 'ADMIN'],
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
  productType: {
    type: String,
    enum: ['PHARMACY_MEDICINE', 'PARAPHARMACY_PRODUCT', 'GENERAL_PRODUCT'],
    default: 'GENERAL_PRODUCT'
  },
  brand: {
    type: String,
    default: null
  },
  manufacturer: {
    type: String,
    default: null
  },
  barcode: {
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
  medicineDetails: {
    type: medicineDetailsSchema,
    default: () => ({})
  },
  parapharmacyDetails: {
    type: parapharmacyDetailsSchema,
    default: () => ({})
  },
  variants: {
    type: [productVariantSchema],
    default: []
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
productSchema.index({ productType: 1, isActive: 1 });
productSchema.index({ isActive: 1 });

module.exports = mongoose.model('Product', productSchema);
