const VeterinarianProfile = require('../models/VeterinarianProfile');
const User = require('../models/User');
const Review = require('../models/Review');
const SubscriptionPlan = require('../models/SubscriptionPlan');
const VeterinarianSubscription = require('../models/VeterinarianSubscription');
const Specialization = require('../models/Specialization');
const InsuranceCompany = require('../models/InsuranceCompany');
const Product = require('../models/Product');
const Appointment = require('../models/Appointment');
const Transaction = require('../models/Transaction');
const Conversation = require('../models/Conversation');
const Notification = require('../models/Notification');
const mongoose = require('mongoose');
const { VETERINARY_SPECIALIZATION } = require('../types/enums');
const { validateObjectId } = require('../utils/validation');

const hasText = (value) => typeof value === 'string' && value.trim().length > 0;
const escapeRegExp = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const normalizeSpecializationCode = (value) => String(value || '')
  .trim()
  .toUpperCase()
  .replace(/[^A-Z0-9]+/g, '_')
  .replace(/^_+|_+$/g, '');
const SPECIALIZATION_ALIASES = {
  SMALL_ANIMAL: ['SMALL_ANIMAL', 'SMALL_ANIMALS', 'PICCOLI_ANIMALI'],
  LARGE_ANIMAL: ['LARGE_ANIMAL', 'LARGE_ANIMALS', 'GRANDI_ANIMALI'],
  EXOTIC_ANIMALS: ['EXOTIC_ANIMALS', 'ANIMALI_ESOTICI'],
  AVIAN: ['AVIAN', 'BIRDS', 'UCCELLI'],
  REPTILE: ['REPTILE', 'REPTILES', 'RETTILI'],
  EMERGENCY: ['EMERGENCY', 'EMERGENZA'],
  SURGERY: ['SURGERY', 'SURGICAL', 'SURGEON', 'CHIRURGIA', 'CHIRURGO'],
  DERMATOLOGY: ['DERMATOLOGY', 'DERMATOLOGIA'],
  CARDIOLOGY: ['CARDIOLOGY', 'CARDIOLOGIA'],
  ONCOLOGY: ['ONCOLOGY', 'ONCOLOGIA'],
  DENTISTRY: ['DENTISTRY', 'DENTAL', 'ODONTOIATRIA'],
  OPHTHALMOLOGY: ['OPHTHALMOLOGY', 'OFTALMOLOGIA'],
  BEHAVIOR: ['BEHAVIOR', 'BEHAVIOUR', 'COMPORTAMENTO'],
  NUTRITION: ['NUTRITION', 'NUTRIZIONE'],
  INTERNAL_MEDICINE: ['INTERNAL_MEDICINE', 'INTERNAL_MEDICINE_SMALL_ANIMALS', 'SMALL_ANIMAL_INTERNAL_MEDICINE', 'MEDICINA_INTERNA', 'MEDICINA_INTERNA_DEI_PICCOLI_ANIMALI'],
  RADIOLOGY: ['RADIOLOGY', 'RADIOLOGIA'],
};
const resolveSpecializationCode = (...values) => {
  const normalizedValues = values.flat().map(normalizeSpecializationCode).filter(Boolean);
  const directCode = normalizedValues.find((value) => Object.values(VETERINARY_SPECIALIZATION).includes(value));
  if (directCode) return directCode;
  return Object.entries(SPECIALIZATION_ALIASES).find(([, aliases]) => (
    aliases.some((alias) => normalizedValues.includes(alias))
  ))?.[0] || normalizedValues[0] || '';
};
const toPositiveInteger = (value, fallback, max) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
};

const SOCIAL_LINK_KEYS = ['facebook', 'instagram', 'linkedin', 'twitter', 'website'];

// Doctors can paste either a complete URL or a normal domain such as
// "instagram.com/my-clinic". Store one safe, canonical format so public
// profile links are always clickable and never accept executable protocols.
const normalizeSocialLink = (value, label) => {
  const trimmed = String(value || '').trim();
  if (!trimmed) return null;

  const candidate = /^[a-z][a-z\d+.-]*:/i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  let url;
  try {
    url = new URL(candidate);
  } catch {
    throw new Error(`${label} must be a valid website address`);
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error(`${label} must use http or https`);
  }
  return url.toString();
};

const normalizeSocialLinks = (socialLinks) => {
  if (socialLinks === undefined) return undefined;
  if (!socialLinks || Array.isArray(socialLinks) || typeof socialLinks !== 'object') {
    throw new Error('Social links must be provided as an object');
  }

  return SOCIAL_LINK_KEYS.reduce((result, key) => {
    const label = key === 'twitter' ? 'X / Twitter' : `${key.charAt(0).toUpperCase()}${key.slice(1)}`;
    result[key] = normalizeSocialLink(socialLinks[key], label);
    return result;
  }, {});
};

const getSpecializationFilterValues = async (specialization) => {
  const rawValue = String(specialization || '').trim();
  if (!rawValue) return [];

  const normalizedValue = normalizeSpecializationCode(rawValue);
  const exactValue = new RegExp(`^${escapeRegExp(rawValue)}$`, 'i');
  const specializationRecords = await Specialization.find({
    $or: [
      { type: { $in: [rawValue, normalizedValue] } },
      { name: exactValue },
      { slug: exactValue },
      ...(mongoose.isValidObjectId(rawValue) ? [{ _id: rawValue }] : []),
    ],
  })
    .select('type name slug')
    .lean()
    .maxTimeMS(2000);

  return [...new Set([
    rawValue,
    normalizedValue,
    resolveSpecializationCode(rawValue),
    ...specializationRecords.flatMap((record) => [
      record.type,
      normalizeSpecializationCode(record.type),
      normalizeSpecializationCode(record.name),
      normalizeSpecializationCode(record.slug),
      resolveSpecializationCode(record.type, record.name, record.slug),
    ]),
  ].filter(Boolean))];
};

/**
 * Keep onboarding based on the actual profile data instead of trusting an
 * old persisted boolean. Existing veterinarian profiles may have been saved
 * before profileCompleted was introduced or recalculated.
 */
const isVeterinarianProfileComplete = (profile) => Boolean(
  profile &&
  hasText(profile.title) &&
  hasText(profile.biography) &&
  Array.isArray(profile.specializations) && profile.specializations.length > 0 &&
  Array.isArray(profile.clinics) && profile.clinics.length > 0 &&
  Array.isArray(profile.services) && profile.services.some((service) => hasText(service?.name))
);

/**
 * Upsert veterinarian profile
 */
const upsertVeterinarianProfile = async (userId, profileData) => {
  validateObjectId(userId, 'User ID');
  
  const user = await User.findById(userId);
  if (!user) {
    throw new Error('User not found');
  }
  if (user.role !== 'VETERINARIAN') {
    throw new Error('User is not a veterinarian');
  }

  if (Object.prototype.hasOwnProperty.call(profileData, 'socialLinks')) {
    profileData.socialLinks = normalizeSocialLinks(profileData.socialLinks);
  }

  // Handle specializations
  const specializationCodes = profileData.specializations || [];
  if (specializationCodes.length > 0) {
    const validCodes = Object.values(VETERINARY_SPECIALIZATION);
    const invalid = specializationCodes.filter((code) => !validCodes.includes(code));
    if (invalid.length > 0) {
      throw new Error('One or more specializations are invalid');
    }
    // Store enum codes directly on the profile
    profileData.specializations = specializationCodes;
  }

  // Handle insurance companies
  if (profileData.insuranceCompanies && Array.isArray(profileData.insuranceCompanies) && profileData.insuranceCompanies.length > 0) {
    const insuranceIds = profileData.insuranceCompanies.filter(id => id);
    if (insuranceIds.length > 0) {
      const validInsurances = await InsuranceCompany.find({
        _id: { $in: insuranceIds },
        isActive: true
      });
      if (validInsurances.length !== insuranceIds.length) {
        throw new Error('One or more insurance companies are invalid or inactive');
      }
      profileData.insuranceCompanies = insuranceIds;
    }
  }

  // Handle services specifically to prevent CastError
  if (profileData.services) {
    if (Array.isArray(profileData.services)) {
      profileData.services = profileData.services.map(service => {
        if (typeof service === 'string') {
          return { name: service };
        }
        return service;
      });
    } else if (typeof profileData.services === 'string') {
      profileData.services = [{ name: profileData.services }];
    }
  }

  // Find or create profile
  let profile = await VeterinarianProfile.findOne({ userId });

  // Handle nested objects and arrays correctly
  const updateData = { ...profileData };
  delete updateData.userId; // Don't update userId

  if (!profile) {
    profile = await VeterinarianProfile.create({
      userId,
      ...updateData
    });
    // Link profile to user
    user.veterinarianProfile = profile._id;
    await user.save();
  } else {
    // Update existing profile
    Object.keys(updateData).forEach(key => {
      // Empty social-link inputs deliberately become null. Treat them as a
      // replacement object so a doctor can remove an already-saved link.
      if (key === 'socialLinks' && updateData.socialLinks !== undefined) {
        profile.set('socialLinks', {
          ...(profile.socialLinks?.toObject?.() || profile.socialLinks || {}),
          ...updateData.socialLinks,
        });
        return;
      }
      if (updateData[key] !== undefined && updateData[key] !== null) {
        if (Array.isArray(updateData[key])) {
          // For arrays (services, clinics, education, etc.), replace the entire array
          profile[key] = updateData[key];
        } else if (typeof updateData[key] === 'object' && !Array.isArray(updateData[key])) {
          // For nested objects (consultationFees, socialLinks), merge them
          profile[key] = { ...profile[key], ...updateData[key] };
        } else {
          // For simple fields (title, biography, etc.)
          profile[key] = updateData[key];
        }
      }
    });
    await profile.save();
  }

  // Calculate profileCompleted flag
  const isProfileCompleted = isVeterinarianProfileComplete(profile);
  
  profile.profileCompleted = isProfileCompleted;
  await profile.save();

  // Ensure user has veterinarianProfile reference
  if (!user.veterinarianProfile || user.veterinarianProfile.toString() !== profile._id.toString()) {
    user.veterinarianProfile = profile._id;
    await user.save();
  }

  return profile;
};

/**
 * Get veterinarian profile by user ID
 */
const getVeterinarianProfile = async (userId) => {
  validateObjectId(userId, 'User ID');
  
  const profile = await VeterinarianProfile.findOne({ userId })
    .select(
      [
        'userId',
        'title',
        'biography',
        'specializations',
        'insuranceCompanies',
        'ratingAvg',
        'ratingCount',
        'consultationFees',
        'clinics',
        'education',
        'experience',
        'awards',
        'memberships',
        'services',
        'acceptsInsurance',
        'isAvailableOnline',
        'isVerified',
        'isFeatured',
        'canSellProducts',
        'socialLinks',
        'profileCompleted',
        'convenzionato',
        'createdAt',
        'updatedAt',
      ].join(' ')
    )
    .lean()
    .maxTimeMS(2000);
  
  if (!profile) {
    throw new Error('Veterinarian profile not found');
  }

  // Get all related data separately
  const [user, specializations, insuranceCompanies, products] = await Promise.all([
    User.findById(userId)
      .select('name email phone profileImage status')
      .lean()
      .maxTimeMS(1000),
    // Profile stores enum codes; map them to Specialization docs via the \"type\" field
    profile.specializations?.length > 0
      ? Specialization.find({ type: { $in: profile.specializations } })
      .lean()
      .maxTimeMS(2000) : Promise.resolve([]),
    profile.insuranceCompanies?.length > 0 ? InsuranceCompany.find({ _id: { $in: profile.insuranceCompanies } })
      .lean()
      .maxTimeMS(2000) : Promise.resolve([]),
    Product.find({
      sellerId: userId,
      sellerType: 'VETERINARIAN',
      isActive: true
    })
      .select('name price discountPrice images category stock')
      .sort({ createdAt: -1 })
      .limit(20)
      .lean()
      .maxTimeMS(2000)
  ]);

  // When no Specialization docs match (e.g. type not set in DB), return stored enum codes as { type, name }
  // so the profile response and frontend still show the saved specializations
  const specializationList = (specializations && specializations.length > 0)
    ? specializations
    : (profile.specializations || []).map((code) => ({ type: code, name: code }));

  return {
    ...profile,
    userId: user,
    specializations: specializationList,
    insuranceCompanies: insuranceCompanies || [],
    products: products || []
  };
};

/**
 * List veterinarians with filtering
 */
const listVeterinarians = async (filter = {}) => {
  const {
    specialization,
    city,
    isFeatured,
    isAvailableOnline,
    search,
    page = 1,
    limit = 10
  } = filter;

  const query = {};
  const currentPage = toPositiveInteger(page, 1, Number.MAX_SAFE_INTEGER);
  const pageSize = toPositiveInteger(limit, 10, 100);

  if (specialization) {
    const specializationValues = await getSpecializationFilterValues(specialization);
    if (specializationValues.length > 0) {
      query.specializations = { $in: specializationValues };
    }
  }

  if (hasText(city)) {
    query['clinics.city'] = { $regex: escapeRegExp(city.trim()), $options: 'i' };
  }

  if (isFeatured !== undefined) {
    query.isFeatured = isFeatured === true || isFeatured === 'true';
  }

  if (isAvailableOnline !== undefined) {
    query.isAvailableOnline = isAvailableOnline === true || isAvailableOnline === 'true';
  }

  // Only show APPROVED veterinarians
  let approvedVeterinarianIds = null;
  const approvedVeterinarians = await User.find({
    role: 'VETERINARIAN',
    status: 'APPROVED'
  })
    .select('_id name fullName email')
    .lean()
    .maxTimeMS(2000);

  approvedVeterinarianIds = approvedVeterinarians.map(vet => vet._id);

  // Keep an explicit empty match set. Previously a failed search returned every
  // approved veterinarian because the user-id filter was left unchanged.
  if (search && typeof search === 'string' && search.trim()) {
    const searchRegex = new RegExp(escapeRegExp(search.trim()), 'i');
    const matchingIds = approvedVeterinarians
      .filter((v) => [v.name, v.fullName, v.email].some((value) => value && searchRegex.test(value)))
      .map(v => v._id);
    approvedVeterinarianIds = matchingIds;
  }

  query.userId = { $in: approvedVeterinarianIds };

  const skip = (currentPage - 1) * pageSize;

  // Same profile fields as getVeterinarianProfile (parity with doctor profile: ratingAvg, isVerified, isFeatured, canSellProducts, convenzionato, timestamps, etc.)
  const profileSelect = [
    'userId',
    'title',
    'biography',
    'specializations',
    'insuranceCompanies',
    'ratingAvg',
    'ratingCount',
    'consultationFees',
    'clinics',
    'education',
    'experience',
    'awards',
    'memberships',
    'services',
    'acceptsInsurance',
    'isAvailableOnline',
    'isVerified',
    'isFeatured',
    'canSellProducts',
    'socialLinks',
    'profileCompleted',
    'convenzionato',
    'createdAt',
    'updatedAt',
  ].join(' ');

  const [veterinariansRaw, total] = await Promise.all([
    VeterinarianProfile.find(query)
      .select(profileSelect)
      .skip(skip)
      .limit(pageSize)
      .sort({ ratingAvg: -1, createdAt: -1 })
      .lean()
      .maxTimeMS(3000),
    VeterinarianProfile.countDocuments(query).maxTimeMS(2000)
  ]);

  // Get all related data separately
  const userIds = [...new Set(veterinariansRaw.map(v => v.userId?.toString()).filter(Boolean))];
  // Profile specializations are enum CODES (strings), not Specialization _ids
  const specializationCodes = [...new Set(veterinariansRaw.flatMap(v => v.specializations || []).filter(Boolean))];
  const insuranceIds = [...new Set(veterinariansRaw.flatMap(v => v.insuranceCompanies || []).filter(Boolean))];

  const [users, specializations, insuranceCompanies] = await Promise.all([
    userIds.length > 0 ? User.find({ _id: { $in: userIds }, status: 'APPROVED' })
      .select('name fullName email phone profileImage status')
      .lean()
      .maxTimeMS(2000) : Promise.resolve([]),
    specializationCodes.length > 0 ? Specialization.find({ type: { $in: specializationCodes } })
      .lean()
      .maxTimeMS(2000) : Promise.resolve([]),
    insuranceIds.length > 0 ? InsuranceCompany.find({ _id: { $in: insuranceIds } })
      .lean()
      .maxTimeMS(2000) : Promise.resolve([])
  ]);

  // Create lookup maps
  const userMap = {};
  users.forEach(u => { userMap[u._id.toString()] = u; });
  const specializationMap = {};
  specializations.forEach(s => { specializationMap[s.type || s._id.toString()] = s; });
  const insuranceMap = {};
  insuranceCompanies.forEach(i => { insuranceMap[i._id.toString()] = i; });

  // Attach populated data (vet.specializations are enum codes, not _ids)
  const filteredVeterinarians = veterinariansRaw
    .filter(v => userMap[v.userId?.toString()])
    .map(vet => ({
      ...vet,
      userId: userMap[vet.userId?.toString()] || null,
      specializations: (vet.specializations || [])
        .map((code) => specializationMap[code] || { type: code, name: code })
        .filter(Boolean),
      insuranceCompanies: (vet.insuranceCompanies || []).map(id => insuranceMap[id?.toString()]).filter(Boolean)
    }));

  // Get products for each veterinarian (limit 3 per vet)
  const veterinariansWithProducts = await Promise.all(
    filteredVeterinarians.map(async (vet) => {
      if (!vet.userId) return vet;
      try {
        const products = await Product.find({
          sellerId: vet.userId._id,
          sellerType: 'VETERINARIAN',
          isActive: true
        })
          .select('name price discountPrice images category stock')
          .sort({ createdAt: -1 })
          .limit(3)
          .lean()
          .maxTimeMS(1000);
        return { ...vet, products };
      } catch (error) {
        return { ...vet, products: [] };
      }
    })
  );

  return {
    veterinarians: veterinariansWithProducts,
    pagination: {
      page: currentPage,
      limit: pageSize,
      total,
      pages: Math.ceil(Math.max(0, total) / pageSize)
    }
  };
};

/**
 * Get veterinarian dashboard
 */
const getVeterinarianDashboard = async (veterinarianId) => {
  try {
    const veterinarian = await User.findById(veterinarianId)
      .populate('veterinarianProfile')
      .lean();
    
    if (!veterinarian || veterinarian.role !== 'VETERINARIAN') {
      throw new Error('Veterinarian not found');
    }

  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);

  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay() + 1);
  weekStart.setHours(0, 0, 0, 0);

  const [
    todayAppointmentsRaw,
    weeklyAppointmentsRaw,
    upcomingAppointmentsRaw,
    allAppointmentsIds
  ] = await Promise.all([
    Appointment.find({
      veterinarianId,
      appointmentDate: {
        $gte: todayStart,
        $lte: todayEnd
      }
    })
      .select('petOwnerId petId appointmentDate appointmentTime status')
      .sort({ appointmentTime: 1 })
      .lean()
      .maxTimeMS(2000),
    Appointment.find({
      veterinarianId,
      appointmentDate: { $gte: weekStart }
    })
      .select('_id')
      .lean()
      .maxTimeMS(2000),
    Appointment.find({
      veterinarianId,
      appointmentDate: { $gte: now },
      status: { $in: ['PENDING', 'CONFIRMED'] }
    })
      .select('petOwnerId petId appointmentDate appointmentTime status')
      .sort({ appointmentDate: 1, appointmentTime: 1 })
      .limit(10)
      .lean()
      .maxTimeMS(2000),
    // Only get IDs for counting - much faster
    Appointment.find({ veterinarianId })
      .select('petOwnerId _id')
      .lean()
      .maxTimeMS(2000)
  ]);

  // Populate separately
  const petOwnerIds = [...new Set([
    ...todayAppointmentsRaw.map(a => a.petOwnerId?.toString()),
    ...upcomingAppointmentsRaw.map(a => a.petOwnerId?.toString())
  ].filter(Boolean))];
  const petIds = [...new Set([
    ...todayAppointmentsRaw.map(a => a.petId?.toString()),
    ...upcomingAppointmentsRaw.map(a => a.petId?.toString())
  ].filter(Boolean))];

  const [petOwners, pets] = await Promise.all([
    petOwnerIds.length > 0 ? User.find({ _id: { $in: petOwnerIds } })
      .select('name email phone profileImage')
      .lean()
      .maxTimeMS(2000) : Promise.resolve([]),
    petIds.length > 0 ? require('../models/Pet').find({ _id: { $in: petIds } })
      .select('name species breed')
      .lean()
      .maxTimeMS(2000) : Promise.resolve([])
  ]);

  // Create lookup maps
  const petOwnerMap = {};
  petOwners.forEach(p => { petOwnerMap[p._id.toString()] = p; });
  const petMap = {};
  pets.forEach(p => { petMap[p._id.toString()] = p; });

  // Attach populated data
  const todayAppointments = todayAppointmentsRaw.map(apt => ({
    ...apt,
    petOwnerId: apt.petOwnerId ? petOwnerMap[apt.petOwnerId.toString()] : null,
    petId: apt.petId ? petMap[apt.petId.toString()] : null
  }));

  const upcomingAppointments = upcomingAppointmentsRaw.map(apt => ({
    ...apt,
    petOwnerId: apt.petOwnerId ? petOwnerMap[apt.petOwnerId.toString()] : null,
    petId: apt.petId ? petMap[apt.petId.toString()] : null
  }));

  // Get unique pet owners (optimized)
  const uniquePetOwners = new Set();
  allAppointmentsIds.forEach(apt => {
    if (apt.petOwnerId) {
      uniquePetOwners.add(apt.petOwnerId.toString());
    }
  });
  const totalPetOwnersCount = uniquePetOwners.size;

  // Get earnings from appointments (optimized - only get appointment IDs)
  const appointmentIds = allAppointmentsIds.map(a => a._id);
  const appointmentTransactions = await Transaction.find({
    relatedAppointmentId: { $in: appointmentIds },
    status: 'SUCCESS'
  })
    .select('amount')
    .lean()
    .maxTimeMS(2000);
  const earningsFromAppointments = appointmentTransactions.reduce(
    (sum, txn) => sum + (txn.amount || 0), 0
  );

  // Get unread messages count
  const unreadMessagesCount = await Conversation.countDocuments({
    $or: [
      { veterinarianId, 'lastMessage.readBy': { $ne: veterinarianId } },
      { adminId: veterinarianId, 'lastMessage.readBy': { $ne: veterinarianId } }
    ],
    lastMessage: { $exists: true }
  }).maxTimeMS(2000);

  // Get unread notifications count
  const unreadNotificationsCount = await Notification.countDocuments({
    userId: veterinarianId,
    isRead: false
  }).maxTimeMS(2000);

  // Calculate profile strength
  const profile = veterinarian.veterinarianProfile || await VeterinarianProfile.findOne({ userId: veterinarianId });
  let profileStrength = 0;
  if (profile) {
    if (profile.title) profileStrength += 10;
    if (profile.biography) profileStrength += 10;
    if (profile.specializations && profile.specializations.length > 0) profileStrength += 10;
    if (profile.experienceYears) profileStrength += 10;
    if (profile.services && profile.services.length > 0) profileStrength += 15;
    if (profile.clinics && profile.clinics.length > 0) profileStrength += 15;
    if (profile.education && profile.education.length > 0) profileStrength += 10;
    if (profile.experience && profile.experience.length > 0) profileStrength += 10;
    if (profile.consultationFees && (profile.consultationFees.clinic || profile.consultationFees.online)) profileStrength += 10;
  }

  // Reconcile legacy profileCompleted values on every dashboard request so a
  // fully completed doctor account stops seeing the onboarding modal.
  const profileCompleted = isVeterinarianProfileComplete(profile);
  if (profile && profile.profileCompleted !== profileCompleted) {
    await VeterinarianProfile.updateOne(
      { _id: profile._id },
      { $set: { profileCompleted } }
    ).maxTimeMS(2000);
  }

  // Subscription status
  const subscription = await VeterinarianSubscription.findOne({
    veterinarianId,
    isActive: true,
    endDate: { $gt: now }
  })
    .lean()
    .maxTimeMS(2000);
  const hasActiveSubscription = !!subscription;
  const subscriptionExpiresIn = subscription && subscription.endDate
    ? Math.ceil((new Date(subscription.endDate) - now) / (1000 * 60 * 60 * 24))
    : null;

  // Get subscription plan if exists
  const subscriptionPlan = subscription && subscription.subscriptionPlanId
    ? await SubscriptionPlan.findById(subscription.subscriptionPlanId)
        .lean()
        .maxTimeMS(1000)
    : null;

  return {
    veterinarian: {
      id: veterinarian._id,
      name: veterinarian.name,
      email: veterinarian.email,
      status: veterinarian.status,
      profileImage: veterinarian.profileImage
    },
    todayAppointments: {
      count: todayAppointments.length,
      appointments: todayAppointments
    },
    weeklyAppointments: {
      count: weeklyAppointmentsRaw.length
    },
    upcomingAppointments: {
      count: upcomingAppointments.length,
      appointments: upcomingAppointments
    },
    totalPetOwners: totalPetOwnersCount,
    earningsFromAppointments,
    unreadMessagesCount,
    unreadNotificationsCount,
    profileStrength: Math.min(profileStrength, 100),
    profileCompleted,
    subscription: {
      plan: subscriptionPlan,
      expiresAt: subscription ? subscription.endDate : null,
      hasActiveSubscription,
      expiresInDays: subscriptionExpiresIn
    },
    rating: profile ? {
      average: profile.ratingAvg || 0,
      count: profile.ratingCount || 0
    } : { average: 0, count: 0 }
  };
  } catch (error) {
    console.error('Error in getVeterinarianDashboard:', error);
    throw error;
  }
};

/**
 * Get veterinarian's reviews
 */
const getVeterinarianReviews = async (veterinarianId, options = {}) => {
  const { page = 1, limit = 10 } = options;
  const skip = (page - 1) * limit;
  
  const [reviewsRaw, total] = await Promise.all([
    Review.find({ veterinarianId })
      .select('petOwnerId petId rating reviewText reviewType createdAt')
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 })
      .lean()
      .maxTimeMS(3000),
    Review.countDocuments({ veterinarianId }).maxTimeMS(2000)
  ]);

  // Populate separately
  const petOwnerIds = [...new Set(reviewsRaw.map(r => r.petOwnerId?.toString()).filter(Boolean))];
  const petIds = [...new Set(reviewsRaw.map(r => r.petId?.toString()).filter(Boolean))];

  const [petOwners, pets] = await Promise.all([
    petOwnerIds.length > 0 ? User.find({ _id: { $in: petOwnerIds } })
      .select('name email profileImage')
      .lean()
      .maxTimeMS(2000) : Promise.resolve([]),
    petIds.length > 0 ? require('../models/Pet').find({ _id: { $in: petIds } })
      .select('name species')
      .lean()
      .maxTimeMS(2000) : Promise.resolve([])
  ]);

  // Create lookup maps
  const petOwnerMap = {};
  petOwners.forEach(p => { petOwnerMap[p._id.toString()] = p; });
  const petMap = {};
  pets.forEach(p => { petMap[p._id.toString()] = p; });

  // Attach populated data
  const reviews = reviewsRaw.map(review => ({
    ...review,
    petOwnerId: review.petOwnerId ? petOwnerMap[review.petOwnerId.toString()] : null,
    petId: review.petId ? petMap[review.petId.toString()] : null
  }));

  return {
    reviews,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };
};

/**
 * Buy subscription plan
 */
const buySubscriptionPlan = async (veterinarianId, planId) => {
  const veterinarian = await User.findById(veterinarianId);
  
  if (!veterinarian || veterinarian.role !== 'VETERINARIAN') {
    throw new Error('Veterinarian not found');
  }

  const plan = await SubscriptionPlan.findById(planId);
  if (!plan) {
    throw new Error('Subscription plan not found');
  }

  if (plan.status !== 'ACTIVE') {
    throw new Error('Subscription plan is not active');
  }

  // Calculate expiration date
  const startDate = new Date();
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + plan.durationInDays);

  // Create or update subscription
  let subscription = await VeterinarianSubscription.findOne({
    veterinarianId,
    isActive: true
  });

  if (subscription) {
    subscription.subscriptionPlanId = planId;
    subscription.startDate = startDate;
    subscription.endDate = endDate;
    subscription.isActive = true;
    await subscription.save();
  } else {
    subscription = await VeterinarianSubscription.create({
      veterinarianId,
      subscriptionPlanId: planId,
      startDate,
      endDate,
      isActive: true
    });
  }

  // Create transaction record
  try {
    await Transaction.create({
      userId: veterinarianId,
      relatedSubscriptionId: planId,
      amount: plan.price,
      currency: 'EUR',
      status: 'SUCCESS',
      provider: 'DUMMY',
      providerReference: `SUB-${Date.now()}-${veterinarianId}`
    });
  } catch (error) {
    console.error('Failed to create transaction record:', error);
  }

  await subscription.populate('subscriptionPlanId', 'name price durationInDays features status');

  return {
    subscription,
    subscriptionExpiresAt: subscription.endDate
  };
};

/**
 * Get current subscription
 */
const getMySubscription = async (veterinarianId) => {
  const veterinarian = await User.findById(veterinarianId);
  
  if (!veterinarian || veterinarian.role !== 'VETERINARIAN') {
    throw new Error('Veterinarian not found');
  }

  const subscription = await VeterinarianSubscription.findOne({
    veterinarianId,
    isActive: true,
    endDate: { $gt: new Date() }
  }).populate('subscriptionPlanId', 'name price durationInDays features status');

  return {
    subscription: subscription ? subscription.subscriptionPlanId : null,
    expiresAt: subscription ? subscription.endDate : null,
    hasActiveSubscription: !!subscription
  };
};

const getVeterinarianInvoices = async (veterinarianId, options = {}) => {
  validateObjectId(veterinarianId, 'Veterinarian ID');

  const {
    status,
    fromDate,
    toDate,
    search,
    page = 1,
    limit = 20
  } = options;

  const matchStage = {
    relatedAppointmentId: { $ne: null }
  };

  if (status) {
    matchStage.status = status.toUpperCase();
  }

  if (fromDate || toDate) {
    matchStage.createdAt = {};
    if (fromDate) {
      matchStage.createdAt.$gte = new Date(fromDate);
    }
    if (toDate) {
      matchStage.createdAt.$lte = new Date(toDate);
    }
  }

  const skip = (Number(page) - 1) * Number(limit);
  const veterinarianObjectId = new mongoose.Types.ObjectId(veterinarianId);
  const searchTerm = String(search || '').trim();
  const escapedSearch = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const appointmentCollection = Appointment.collection.name;
  const userCollection = User.collection.name;
  const petCollection = require('../models/Pet').collection.name;

  const pipeline = [
    { $match: matchStage },
    {
      $lookup: {
        from: appointmentCollection,
        localField: 'relatedAppointmentId',
        foreignField: '_id',
        as: 'appointment'
      }
    },
    { $unwind: '$appointment' },
    { $match: { 'appointment.veterinarianId': veterinarianObjectId } },
    {
      $lookup: {
        from: userCollection,
        localField: 'appointment.petOwnerId',
        foreignField: '_id',
        as: 'petOwner'
      }
    },
    { $unwind: { path: '$petOwner', preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: petCollection,
        localField: 'appointment.petId',
        foreignField: '_id',
        as: 'pet'
      }
    },
    { $unwind: { path: '$pet', preserveNullAndEmptyArrays: true } },
    ...(searchTerm ? [{
      $match: {
        $or: [
          { 'appointment.appointmentNumber': { $regex: escapedSearch, $options: 'i' } },
          { 'petOwner.name': { $regex: escapedSearch, $options: 'i' } },
          { 'petOwner.fullName': { $regex: escapedSearch, $options: 'i' } },
          { 'petOwner.email': { $regex: escapedSearch, $options: 'i' } },
          { 'pet.name': { $regex: escapedSearch, $options: 'i' } },
          { 'pet.species': { $regex: escapedSearch, $options: 'i' } },
          { provider: { $regex: escapedSearch, $options: 'i' } },
          { status: { $regex: escapedSearch, $options: 'i' } }
        ]
      }
    }] : []),
    {
      $addFields: {
        relatedAppointmentId: {
          _id: '$appointment._id',
          appointmentNumber: '$appointment.appointmentNumber',
          appointmentDate: '$appointment.appointmentDate',
          appointmentTime: '$appointment.appointmentTime',
          petOwnerId: {
            _id: '$petOwner._id',
            name: '$petOwner.name',
            email: '$petOwner.email',
            profileImage: '$petOwner.profileImage'
          },
          petId: {
            _id: '$pet._id',
            name: '$pet.name',
            species: '$pet.species',
            breed: '$pet.breed',
            photo: '$pet.photo'
          }
        },
        userId: {
          _id: '$petOwner._id',
          name: '$petOwner.name',
          email: '$petOwner.email',
          profileImage: '$petOwner.profileImage'
        }
      }
    },
    {
      $project: {
        appointment: 0,
        petOwner: 0,
        pet: 0
      }
    },
    {
      $facet: {
        data: [
          { $sort: { createdAt: -1 } },
          { $skip: skip },
          { $limit: Number(limit) }
        ],
        totalCount: [
          { $count: 'count' }
        ]
      }
    }
  ];

  const [result] = await Transaction.aggregate(pipeline).allowDiskUse(true);
  const transactions = result?.data || [];
  const total = result?.totalCount?.[0]?.count || 0;

  return {
    transactions,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      pages: Math.ceil(total / Number(limit))
    }
  };
};

const getVeterinarianInvoiceByTransactionId = async (veterinarianId, transactionId) => {
  validateObjectId(veterinarianId, 'Veterinarian ID');
  validateObjectId(transactionId, 'Transaction ID');

  const veterinarianObjectId = new mongoose.Types.ObjectId(veterinarianId);
  const transactionObjectId = new mongoose.Types.ObjectId(transactionId);

  const appointmentCollection = Appointment.collection.name;
  const userCollection = User.collection.name;
  const petCollection = require('../models/Pet').collection.name;

  const pipeline = [
    { $match: { _id: transactionObjectId, relatedAppointmentId: { $ne: null } } },
    {
      $lookup: {
        from: appointmentCollection,
        localField: 'relatedAppointmentId',
        foreignField: '_id',
        as: 'appointment'
      }
    },
    { $unwind: '$appointment' },
    { $match: { 'appointment.veterinarianId': veterinarianObjectId } },
    {
      $lookup: {
        from: userCollection,
        localField: 'appointment.petOwnerId',
        foreignField: '_id',
        as: 'petOwner'
      }
    },
    { $unwind: { path: '$petOwner', preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: petCollection,
        localField: 'appointment.petId',
        foreignField: '_id',
        as: 'pet'
      }
    },
    { $unwind: { path: '$pet', preserveNullAndEmptyArrays: true } },
    {
      $addFields: {
        relatedAppointmentId: {
          _id: '$appointment._id',
          appointmentNumber: '$appointment.appointmentNumber',
          appointmentDate: '$appointment.appointmentDate',
          appointmentTime: '$appointment.appointmentTime',
          petOwnerId: {
            _id: '$petOwner._id',
            name: '$petOwner.name',
            email: '$petOwner.email',
            profileImage: '$petOwner.profileImage'
          },
          petId: {
            _id: '$pet._id',
            name: '$pet.name',
            species: '$pet.species',
            breed: '$pet.breed',
            photo: '$pet.photo'
          }
        },
        userId: {
          _id: '$petOwner._id',
          name: '$petOwner.name',
          email: '$petOwner.email',
          profileImage: '$petOwner.profileImage'
        }
      }
    },
    {
      $project: {
        appointment: 0,
        petOwner: 0,
        pet: 0
      }
    }
  ];

  const [invoice] = await Transaction.aggregate(pipeline);
  if (!invoice) {
    throw new Error('Invoice not found');
  }

  return invoice;
};

module.exports = {
  upsertVeterinarianProfile,
  getVeterinarianProfile,
  listVeterinarians,
  getVeterinarianDashboard,
  getVeterinarianReviews,
  buySubscriptionPlan,
  getMySubscription,
  getVeterinarianInvoices,
  getVeterinarianInvoiceByTransactionId
};
