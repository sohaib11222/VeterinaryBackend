const Pet = require('../models/Pet');
const User = require('../models/User');
const { PET_SPECIES, PET_GENDER } = require('../types/enums');

// Values treated as "no microchip" – we omit the field so sparse unique index allows multiple pets.
const NO_MICROCHIP_VALUES = new Set(['', 'n/a', 'na', 'n.a.', 'none', '-', 'null', 'no', 'x', '—', '–']);

function normalizeMicrochip(value) {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim().toLowerCase();
  if (trimmed === '' || NO_MICROCHIP_VALUES.has(trimmed)) return null;
  return String(value).trim(); // return original trimmed (with original case)
}

/**
 * Create new pet
 */
const createPet = async (ownerId, data) => {
  // Handle weight specifically to prevent CastError
  if (data.weight && (typeof data.weight === 'number' || typeof data.weight === 'string')) {
    data.weight = {
      value: Number(data.weight),
      unit: 'kg' // Default unit
    };
  }

  // Handle microchipNumber: sparse unique index allows multiple docs only when field is OMITTED.
  const microchip = normalizeMicrochip(data.microchipNumber);
  if (microchip === null) {
    delete data.microchipNumber;
  } else {
    data.microchipNumber = microchip;
    const existingPet = await Pet.findOne({ microchipNumber: microchip }).maxTimeMS(2000);
    if (existingPet) {
      throw new Error('A pet with this microchip number already exists');
    }
  }

  const pet = await Pet.create({
    ownerId,
    ...data
  });

  const createdPet = await Pet.findById(pet._id)
    .select('name species breed gender age weight photo microchipNumber isActive ownerId')
    .lean()
    .maxTimeMS(2000);

  const owner = await User.findById(createdPet.ownerId)
    .select('name email phone')
    .lean()
    .maxTimeMS(1000);

  return {
    ...createdPet,
    ownerId: owner
  };
};

/**
 * Get pet by ID
 */
const getPet = async (petId, ownerId) => {
  const pet = await Pet.findOne({ _id: petId, ownerId, isActive: true })
    .select('name species breed gender age weight photo microchipNumber isActive ownerId')
    .lean()
    .maxTimeMS(2000);

  if (!pet) {
    throw new Error('Pet not found');
  }

  const owner = await User.findById(pet.ownerId)
    .select('name email phone')
    .lean()
    .maxTimeMS(1000);

  return {
    ...pet,
    ownerId: owner
  };
};

/**
 * List pets for owner
 */
const listPets = async (ownerId, query = {}) => {
  const { species, isActive = true, page = 1, limit = 50 } = query;
  const skip = (page - 1) * limit;

  const filter = { ownerId, isActive };

  if (species) {
    filter.species = species;
  }

  const pets = await Pet.find(filter)
    .select('name species breed gender age weight photo microchipNumber isActive createdAt')
    .skip(skip)
    .limit(limit)
    .sort({ createdAt: -1 })
    .lean()
    .maxTimeMS(2000);

  // Get owner info separately if needed
  const owner = await User.findById(ownerId)
    .select('name email phone')
    .lean()
    .maxTimeMS(1000);

  return pets.map(pet => ({
    ...pet,
    ownerId: owner
  }));
};

/**
 * Update pet
 */
const updatePet = async (petId, ownerId, data) => {
  // Handle weight specifically to prevent CastError
  if (data.weight && (typeof data.weight === 'number' || typeof data.weight === 'string')) {
    data.weight = {
      value: Number(data.weight),
      unit: 'kg' // Default unit
    };
  }

  // Handle microchipNumber – same "no microchip" normalization as create
  const microchip = normalizeMicrochip(data.microchipNumber);
  if (microchip === null) {
    delete data.microchipNumber;
  } else {
    data.microchipNumber = microchip;
    const existingPet = await Pet.findOne({
      microchipNumber: microchip,
      _id: { $ne: petId }
    }).maxTimeMS(2000);
    if (existingPet) {
      throw new Error('A pet with this microchip number already exists');
    }
  }

  const pet = await Pet.findOne({ _id: petId, ownerId })
    .maxTimeMS(2000);

  if (!pet) {
    throw new Error('Pet not found');
  }

  Object.assign(pet, data);
  await pet.save();

  const updatedPet = await Pet.findById(pet._id)
    .select('name species breed gender age weight photo microchipNumber isActive ownerId')
    .lean()
    .maxTimeMS(2000);

  const owner = await User.findById(updatedPet.ownerId)
    .select('name email phone')
    .lean()
    .maxTimeMS(1000);

  return {
    ...updatedPet,
    ownerId: owner
  };
};

/**
 * Delete pet (soft delete)
 */
const deletePet = async (petId, ownerId) => {
  const pet = await Pet.findOne({ _id: petId, ownerId })
    .maxTimeMS(2000);

  if (!pet) {
    throw new Error('Pet not found');
  }

  pet.isActive = false;
  await pet.save();
};

module.exports = {
  createPet,
  getPet,
  listPets,
  updatePet,
  deletePet
};
