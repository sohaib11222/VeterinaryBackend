const PetStore = require('../models/PetStore');
const User = require('../models/User');
const PetStoreSubscription = require('../models/PetStoreSubscription');

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

const isPetStoreProfileComplete = (petStore) => Boolean(
  String(petStore?.name || '').trim()
  && String(petStore?.phone || '').trim()
  && String(petStore?.address?.line1 || '').trim()
  && String(petStore?.address?.city || '').trim()
  && String(petStore?.address?.country || '').trim()
  && String(petStore?.address?.zip || '').trim()
);

const hasActivePharmacySubscription = async (ownerId) => {
  const subscription = await PetStoreSubscription.findOne({
    petStoreOwnerId: ownerId,
    isActive: true,
    endDate: { $gt: new Date() },
  })
    .populate('subscriptionPlanId', 'planType')
    .lean()
    .maxTimeMS(2000);
  return String(subscription?.subscriptionPlanId?.planType || '').toUpperCase() === 'PET_STORE';
};

const getSetupState = async (petStore, owner = null) => {
  if (!petStore?.ownerId) throw new Error('Pet store owner is required');
  const ownerRecord = owner || await User.findById(petStore.ownerId)
    .select('role status')
    .lean()
    .maxTimeMS(1000);
  const kind = deriveKindFromOwner(ownerRecord);
  const profileCompleted = isPetStoreProfileComplete(petStore);
  const requiresSubscription = kind === 'PHARMACY';
  const hasActiveSubscription = requiresSubscription
    ? await hasActivePharmacySubscription(petStore.ownerId)
    : true;
  const isApproved = String(ownerRecord?.status || '').toUpperCase() === 'APPROVED';
  const isPublic = Boolean(petStore.isActive) && isApproved && profileCompleted && hasActiveSubscription;

  return {
    kind,
    isApproved,
    profileCompleted,
    requiresSubscription,
    hasActiveSubscription,
    isPublic,
    requirements: [
      { key: 'profile', label: `Complete your ${kind === 'PARAPHARMACY' ? 'Parapharmacy' : 'Pharmacy'} profile`, complete: profileCompleted },
      ...(requiresSubscription ? [{ key: 'subscription', label: 'Activate your Pharmacy subscription', complete: hasActiveSubscription }] : []),
    ],
  };
};

const refreshPetStoreSetup = async (petStoreId) => {
  const petStore = await PetStore.findById(petStoreId).maxTimeMS(2000);
  if (!petStore) throw new Error('Pet store not found');
  const setup = await getSetupState(petStore);
  const hasChanged = petStore.profileCompleted !== setup.profileCompleted || petStore.isPublic !== setup.isPublic;
  if (hasChanged) {
    petStore.profileCompleted = setup.profileCompleted;
    petStore.isPublic = setup.isPublic;
    petStore.setupCompletedAt = setup.isPublic ? (petStore.setupCompletedAt || new Date()) : null;
    await petStore.save();
  }
  return { ...petStore.toObject(), setup };
};

const getSetupStatusForOwner = async (ownerId) => {
  const petStore = await PetStore.findOne({ ownerId }).maxTimeMS(2000);
  if (!petStore) {
    const owner = await User.findById(ownerId).select('role').lean().maxTimeMS(1000);
    const kind = deriveKindFromOwner(owner);
    const requiresSubscription = kind === 'PHARMACY';
    return {
      hasProfile: false,
      profileCompleted: false,
      kind,
      requiresSubscription,
      hasActiveSubscription: !requiresSubscription,
      isPublic: false,
      requirements: [
        { key: 'profile', label: `Create and complete your ${kind === 'PARAPHARMACY' ? 'Parapharmacy' : 'Pharmacy'} profile`, complete: false },
        ...(requiresSubscription ? [{ key: 'subscription', label: 'Activate your Pharmacy subscription', complete: false }] : []),
      ],
    };
  }
  const refreshed = await refreshPetStoreSetup(petStore._id);
  return { hasProfile: true, ...refreshed.setup, petStoreId: petStore._id.toString() };
};

const ensurePetStoreReadyForProducts = async (ownerId) => {
  const setup = await getSetupStatusForOwner(ownerId);
  if (!setup.hasProfile || !setup.profileCompleted) {
    throw new Error('Complete your Pharmacy or Parapharmacy profile before managing products');
  }
  if (setup.requiresSubscription && !setup.hasActiveSubscription) {
    throw new Error('You must have an active subscription plan to manage Pharmacy products');
  }
  return setup;
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

  return refreshPetStoreSetup(petStore._id);
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

  return refreshPetStoreSetup(petStore._id);
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

  const refreshed = await refreshPetStoreSetup(petStore._id);
  return {
    ...refreshed,
    ownerId: petStore.ownerId,
    kind: refreshed.setup.kind,
  };
};

/**
 * Get pet store by owner ID
 * @param {string} ownerId - Owner User ID
 * @returns {Promise<Object|null>} Pet store or null if not found
 */
const getPetStoreByOwnerId = async (ownerId) => {
  const petStore = await PetStore.findOne({ ownerId })
    .maxTimeMS(2000);
  
  if (!petStore) {
    return null;
  }

  const refreshed = await refreshPetStoreSetup(petStore._id);
  // Populate separately for better performance
  const owner = petStore.ownerId ? await User.findById(petStore.ownerId)
    .select('fullName email phone profileImage role')
    .lean()
    .maxTimeMS(1000) : null;

  return {
    ...refreshed,
    ownerId: owner,
    kind: refreshed.setup.kind,
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

  const petStores = await PetStore.find(query)
    .populate('ownerId', 'fullName email phone profileImage role status')
    .sort({ createdAt: -1 })
    .maxTimeMS(3000);

  const normalizedWithSetup = await Promise.all(petStores.map(async (ps) => {
    const obj = ps?.toObject ? ps.toObject() : ps;
    const refreshed = await refreshPetStoreSetup(obj._id);
    return {
      ...refreshed,
      ownerId: obj.ownerId,
      kind: refreshed.setup.kind,
    };
  }));
  const visibleStores = includeAll
    ? normalizedWithSetup
    : normalizedWithSetup.filter((petStore) => petStore.setup.isPublic);
  const currentPage = Math.max(1, Number(page) || 1);
  const normalizedLimit = Math.min(100, Math.max(1, Number(limit) || 10));
  const total = visibleStores.length;
  const pagedStores = visibleStores.slice((currentPage - 1) * normalizedLimit, currentPage * normalizedLimit);

  return {
    petStores: pagedStores,
    pagination: {
      page: currentPage,
      limit: normalizedLimit,
      total,
      pages: Math.ceil(total / normalizedLimit)
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
  getSetupStatusForOwner,
  ensurePetStoreReadyForProducts,
  refreshPetStoreSetup,
  listPetStores,
  deletePetStore
};
