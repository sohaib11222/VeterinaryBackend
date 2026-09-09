const mongoose = require('mongoose');

const PET_SITTER_PET_TYPES = [
  'DOG', 'CAT', 'BIRD', 'RABBIT', 'SMALL_PETS', 'REPTILE', 'FISH', 'OTHER',
];

const PET_SITTER_SERVICES = [
  'DOG_SITTING', 'CAT_SITTING', 'HOME_BOARDING', 'HOME_VISITS',
  'DOG_WALKING', 'MEDICATION_ADMINISTRATION', 'PET_TAXI', 'OTHER',
];

const availabilitySchema = new mongoose.Schema({
  day: { type: String, required: true, uppercase: true, trim: true },
  isAvailable: { type: Boolean, default: true },
  startTime: { type: String, default: null, trim: true },
  endTime: { type: String, default: null, trim: true },
}, { _id: false });

const documentSchema = new mongoose.Schema({
  fileUrl: { type: String, required: true },
  name: { type: String, default: null },
  type: { type: String, default: 'CERTIFICATION' },
  uploadedAt: { type: Date, default: Date.now },
}, { _id: false });

const petSitterProfileSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
  bio: { type: String, default: '', trim: true, maxlength: 3000 },
  experienceYears: { type: Number, default: 0, min: 0, max: 80 },
  petSittingExperience: { type: String, default: '', trim: true, maxlength: 3000 },
  servicesOffered: [{ type: String, enum: PET_SITTER_SERVICES }],
  petTypes: [{ type: String, enum: PET_SITTER_PET_TYPES }],
  availability: { type: [availabilitySchema], default: [] },
  certifications: [{ type: String, trim: true, maxlength: 180 }],
  documents: { type: [documentSchema], default: [] },
  isAvailable: { type: Boolean, default: true },
  profileCompleted: { type: Boolean, default: false },
}, { timestamps: true });

petSitterProfileSchema.index({ petTypes: 1, isAvailable: 1 });

module.exports = mongoose.model('PetSitterProfile', petSitterProfileSchema);
module.exports.PET_SITTER_PET_TYPES = PET_SITTER_PET_TYPES;
module.exports.PET_SITTER_SERVICES = PET_SITTER_SERVICES;
