const PetStore = require('../models/PetStore');
const User = require('../models/User');

const normalizeKind = (kind) => {
  const k = String(kind || '').trim().toUpperCase();
  if (!k) return '';
  if (k === 'PARAPHARMACY') return 'PARAPHARMACY';
  if (k === 'PHARMACY' || k === 'PET_STORE') return 'PHARMACY';
  return '';
};

const deriveKindFromOwner = (owner) => {
  const role = String(owner?.role || '').trim().toUpperCase();
  return role === 'PARAPHARMACY' ? 'PARAPHARMACY' : 'PHARMACY';
};

/**
 * Create pet store
 * @param {Object} data - Pet store data
 * @returns {Promise<Object>} Created pet store
 */
const createPetStore = async (data) => {
  const { ownerId, name, logo, address, phone, location, isActive } = data;

  // Verify owner exists
  const owner = await User.findById(ownerId);
  if (!owner) {
    throw new Error('Owner not found');
  }

  const petStore = await PetStore.create({
    ownerId,
    name,
    logo,
    address: address || {},
    phone,
    location: location || {},
    isActive: isActive !== undefined ? isActive : true
  });

  return petStore;
};

/**
 * Update pet store
 * @param {string} id - Pet store ID
 * @param {Object} data - Update data
 * @returns {Promise<Object>} Updated pet store
 */
const updatePetStore = async (id, data) => {
  const petStore = await PetStore.findById(id)
    .maxTimeMS(2000);
  
  if (!petStore) {
    throw new Error('Pet store not found');
  }

  Object.keys(data).forEach(key => {
    if (data[key] !== undefined) {
      if (key === 'address' || key === 'location') {
        petStore[key] = { ...petStore[key], ...data[key] };
      } else {
        petStore[key] = data[key];
      }
    }
  });

  await petStore.save();

  return petStore;
};

/**
 * Get pet store by ID
 * @param {string} id - Pet store ID
 * @returns {Promise<Object>} Pet store
 */
const getPetStore = async (id) => {
  const petStore = await PetStore.findById(id)
    .populate('ownerId', 'fullName email phone profileImage role')
    .lean()
    .maxTimeMS(2000);
  
  if (!petStore) {
    throw new Error('Pet store not found');
  }

  return {
    ...petStore,
    kind: deriveKindFromOwner(petStore.ownerId)
  };
};

/**
 * Get pet store by owner ID
 * @param {string} ownerId - Owner User ID
 * @returns {Promise<Object|null>} Pet store or null if not found
 */
const getPetStoreByOwnerId = async (ownerId) => {
  const petStore = await PetStore.findOne({ ownerId, isActive: true })
    .lean()
    .maxTimeMS(2000);
  
  if (!petStore) {
    return null;
  }

  // Populate separately for better performance
  const owner = petStore.ownerId ? await User.findById(petStore.ownerId)
    .select('fullName email phone profileImage role')
    .lean()
    .maxTimeMS(1000) : null;

  return {
    ...petStore,
    ownerId: owner,
    kind: deriveKindFromOwner(owner)
  };
};

/**
 * List pet stores with filtering
 * @param {Object} filter - Filter criteria
 * @returns {Promise<Object>} Pet stores and pagination info
 */
const listPetStores = async (filter = {}) => {
  const {
    ownerId,
    city,
    kind,
    search,
    includeInactive,
    page = 1,
    limit = 10
  } = filter;

  const query = {};
  const includeAll = String(includeInactive || '').toLowerCase() === 'true';
  if (!includeAll) {
    query.isActive = true;
  }

  if (ownerId) {
    // Handle both single ownerId and $in operator for multiple ownerIds
    if (typeof ownerId === 'object' && ownerId.$in) {
      query.ownerId = { $in: ownerId.$in };
    } else {
      query.ownerId = ownerId;
    }
  }

  const normalizedKind = normalizeKind(kind);
  if (normalizedKind) {
    const roleFilter = normalizedKind === 'PARAPHARMACY' ? 'PARAPHARMACY' : 'PET_STORE';
    const owners = await User.find({ role: roleFilter })
      .select('_id')
      .lean()
      .maxTimeMS(2000);
    const ownerIds = owners.map(o => o._id);
    if (ownerIds.length === 0) {
      return {
        petStores: [],
        pagination: { page, limit, total: 0, pages: 0 }
      };
    }

    if (query.ownerId) {
      const current = query.ownerId;
      const currentIds = current.$in ? current.$in.map(String) : [String(current)];
      const nextIds = ownerIds.map(String).filter(id => currentIds.includes(id));
      query.ownerId = { $in: nextIds };
    } else {
      query.ownerId = { $in: ownerIds };
    }
  }

  if (city) {
    query['address.city'] = { $regex: city, $options: 'i' };
  }

  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { 'address.city': { $regex: search, $options: 'i' } }
    ];
  }

  const skip = (page - 1) * limit;

  const [petStores, total] = await Promise.all([
    PetStore.find(query)
      .populate('ownerId', 'fullName email phone profileImage role')
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 }),
    PetStore.countDocuments(query)
  ]);

  const normalized = petStores.map((ps) => {
    const obj = ps?.toObject ? ps.toObject() : ps;
    return {
      ...obj,
      kind: deriveKindFromOwner(obj.ownerId)
    };
  });

  return {
    petStores: normalized,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };
};

/**
 * Delete pet store
 * @param {string} id - Pet store ID
 * @returns {Promise<Object>} Success message
 */
const deletePetStore = async (id) => {
  const petStore = await PetStore.findById(id)
    .maxTimeMS(2000);
  
  if (!petStore) {
    throw new Error('Pet store not found');
  }

  await PetStore.findByIdAndDelete(id).maxTimeMS(2000);

  return { message: 'Pet store deleted successfully' };
};

module.exports = {
  createPetStore,
  updatePetStore,
  getPetStore,
  getPetStoreByOwnerId,
  listPetStores,
  deletePetStore
};
