const User = require('../models/User');
const Appointment = require('../models/Appointment');
const Order = require('../models/Order');
const VeterinarianProfile = require('../models/VeterinarianProfile');
const PetStore = require('../models/PetStore');
const VeterinarianSubscription = require('../models/VeterinarianSubscription');
const PetStoreSubscription = require('../models/PetStoreSubscription');
const SubscriptionPlan = require('../models/SubscriptionPlan');
const Transaction = require('../models/Transaction');
const { USER_ROLES } = require('../types/enums');

const MAX_LEAD_PAGE_SIZE = 100;

const text = (value) => String(value || '').trim();
const escapeRegex = (value) => text(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const contains = (value) => new RegExp(escapeRegex(value), 'i');

const parsePositiveInt = (value, fallback, max) => {
  const parsed = Number.parseInt(String(value || ''), 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
};

const createAddressConditions = (prefix, filters) => {
  const conditions = [];
  if (filters.city) conditions.push({ [`${prefix}city`]: contains(filters.city) });
  if (filters.country) conditions.push({ [`${prefix}country`]: contains(filters.country) });
  if (filters.region) conditions.push({ [`${prefix}state`]: contains(filters.region) });
  if (filters.area) {
    conditions.push({
      $or: [
        { [`${prefix}line1`]: contains(filters.area) },
        { [`${prefix}line2`]: contains(filters.area) },
      ],
    });
  }
  return conditions;
};

const uniqueSorted = (values) => [...new Set(values.map((value) => text(value)).filter(Boolean))]
  .sort((a, b) => a.localeCompare(b));

const mapSubscription = (subscription, plansById) => {
  if (!subscription) return null;
  const planId = subscription.subscriptionPlanId?.toString();
  const plan = planId ? plansById.get(planId) : null;
  return {
    id: subscription._id?.toString() || null,
    planName: plan?.name || null,
    planType: plan?.planType || null,
    planPrice: Number(plan?.price || 0),
    currency: 'EUR',
    durationInDays: Number(plan?.durationInDays || 0) || null,
    features: Array.isArray(plan?.features) ? plan.features : [],
    status: subscription.isActive && new Date(subscription.endDate) > new Date() ? 'ACTIVE' : 'EXPIRED',
    startDate: subscription.startDate || null,
    endDate: subscription.endDate || null,
  };
};

/**
 * Revenue is calculated from successful subscription-payment transactions,
 * never from plan prices or the platform's general earnings total. This keeps
 * appointment and product/order revenue out of the CRM metric.
 */
const getSubscriptionRevenueSummary = async () => {
  const [summary] = await Transaction.aggregate([
    {
      $match: {
        status: 'SUCCESS',
        relatedSubscriptionId: { $ne: null },
      },
    },
    {
      $lookup: {
        from: User.collection.name,
        localField: 'userId',
        foreignField: '_id',
        as: 'subscriber',
      },
    },
    { $unwind: '$subscriber' },
    {
      $match: {
        'subscriber.role': { $in: [USER_ROLES.VETERINARIAN, USER_ROLES.PET_STORE] },
      },
    },
    {
      $group: {
        _id: null,
        totalRevenue: { $sum: '$amount' },
        totalPayments: { $sum: 1 },
        veterinarianRevenue: {
          $sum: {
            $cond: [
              { $eq: ['$subscriber.role', USER_ROLES.VETERINARIAN] },
              '$amount',
              0,
            ],
          },
        },
        pharmacyRevenue: {
          $sum: {
            $cond: [
              { $eq: ['$subscriber.role', USER_ROLES.PET_STORE] },
              '$amount',
              0,
            ],
          },
        },
      },
    },
  ]).option({ maxTimeMS: 5000 });

  return {
    totalRevenue: Number(summary?.totalRevenue || 0),
    totalPayments: Number(summary?.totalPayments || 0),
    veterinarianRevenue: Number(summary?.veterinarianRevenue || 0),
    pharmacyRevenue: Number(summary?.pharmacyRevenue || 0),
    currency: 'EUR',
  };
};

/**
 * Filterable, safe registration feed for the LeoX24 MyPet Plus Leads page.
 * It keeps the legacy getCrmData endpoint unchanged and returns only the
 * registration/business fields that the CRM needs to display and filter leads.
 */
const getCrmLeads = async (filters = {}) => {
  const page = parsePositiveInt(filters.page, 1, Number.MAX_SAFE_INTEGER);
  const limit = parsePositiveInt(filters.limit, 25, MAX_LEAD_PAGE_SIZE);
  const normalized = {
    search: text(filters.search),
    name: text(filters.name),
    email: text(filters.email).toLowerCase(),
    role: text(filters.role).toUpperCase(),
    status: text(filters.status).toUpperCase(),
    specialization: text(filters.specialization),
    city: text(filters.city),
    country: text(filters.country),
    area: text(filters.area),
    region: text(filters.region),
    documentType: text(filters.documentType).toUpperCase(),
  };

  const queryParts = [];
  if (normalized.role && Object.values(USER_ROLES).includes(normalized.role)) {
    queryParts.push({ role: normalized.role });
  }
  if (normalized.status) queryParts.push({ status: normalized.status });
  if (normalized.name) {
    queryParts.push({
      $or: [
        { name: contains(normalized.name) },
        { fullName: contains(normalized.name) },
      ],
    });
  }
  if (normalized.email) queryParts.push({ email: contains(normalized.email) });

  if (normalized.specialization) {
    const matchingProfiles = await VeterinarianProfile.find({
      specializations: contains(normalized.specialization),
    }).select('userId').lean().maxTimeMS(3000);
    queryParts.push({ _id: { $in: matchingProfiles.map((profile) => profile.userId) } });
  }

  if (normalized.documentType) {
    const documentMatches = [{ 'documentUploads.type': normalized.documentType }];
    if (normalized.documentType === 'LICENSE_DOCUMENT') {
      const licensedProfiles = await VeterinarianProfile.find({
        licenseDocument: { $exists: true, $nin: [null, ''] },
      }).select('userId').lean().maxTimeMS(3000);
      if (licensedProfiles.length > 0) {
        documentMatches.push({ _id: { $in: licensedProfiles.map((profile) => profile.userId) } });
      }
    }
    queryParts.push({ $or: documentMatches });
  }

  const locationFiltersPresent = [normalized.city, normalized.country, normalized.region, normalized.area]
    .some(Boolean);
  if (locationFiltersPresent) {
    const userAddressConditions = createAddressConditions('address.', normalized);
    const storeAddressConditions = createAddressConditions('address.', normalized);
    const matchingStores = await PetStore.find(
      storeAddressConditions.length === 1 ? storeAddressConditions[0] : { $and: storeAddressConditions }
    ).select('ownerId').lean().maxTimeMS(3000);

    const alternatives = [];
    if (userAddressConditions.length > 0) {
      alternatives.push(userAddressConditions.length === 1 ? userAddressConditions[0] : { $and: userAddressConditions });
    }
    if (matchingStores.length > 0) {
      alternatives.push({ _id: { $in: matchingStores.map((store) => store.ownerId) } });
    }
    queryParts.push(alternatives.length === 1 ? alternatives[0] : { $or: alternatives });
  }

  if (normalized.search) {
    const matchingStores = await PetStore.find({
      $or: [
        { name: contains(normalized.search) },
        { phone: contains(normalized.search) },
      ],
    }).select('ownerId').lean().maxTimeMS(3000);
    queryParts.push({
      $or: [
        { name: contains(normalized.search) },
        { fullName: contains(normalized.search) },
        { email: contains(normalized.search) },
        { phone: contains(normalized.search) },
        ...(matchingStores.length > 0 ? [{ _id: { $in: matchingStores.map((store) => store.ownerId) } }] : []),
      ],
    });
  }

  const userQuery = queryParts.length === 0 ? {} : { $and: queryParts };
  const users = await User.find(userQuery)
    .select('name fullName email phone role status address isEmailVerified isPhoneVerified documentUploads createdAt updatedAt')
    .sort({ createdAt: -1 })
    .lean()
    .maxTimeMS(10000);

  const userIds = users.map((user) => user._id);
  const [profiles, petStores, veterinarianSubscriptions, petStoreSubscriptions, subscriptionRevenue] = userIds.length > 0
    ? await Promise.all([
      VeterinarianProfile.find({ userId: { $in: userIds } })
        .select('userId specializations experienceYears licenseDocument isVerified profileCompleted clinics')
        .lean().maxTimeMS(5000),
      PetStore.find({ ownerId: { $in: userIds } })
        .select('ownerId name phone address isActive profileCompleted isPublic')
        .lean().maxTimeMS(5000),
      VeterinarianSubscription.find({ veterinarianId: { $in: userIds }, isActive: true })
        .sort({ endDate: -1, createdAt: -1 }).lean().maxTimeMS(5000),
      PetStoreSubscription.find({ petStoreOwnerId: { $in: userIds }, isActive: true })
        .sort({ endDate: -1, createdAt: -1 }).lean().maxTimeMS(5000),
      getSubscriptionRevenueSummary(),
    ])
    : [[], [], [], [], await getSubscriptionRevenueSummary()];

  const profilesByUserId = new Map(profiles.map((profile) => [profile.userId.toString(), profile]));
  const storesByOwnerId = new Map(petStores.map((store) => [store.ownerId?.toString(), store]));
  const veterinarianSubscriptionsByUserId = new Map();
  veterinarianSubscriptions.forEach((subscription) => {
    const id = subscription.veterinarianId?.toString();
    if (id && !veterinarianSubscriptionsByUserId.has(id)) veterinarianSubscriptionsByUserId.set(id, subscription);
  });
  const petStoreSubscriptionsByUserId = new Map();
  petStoreSubscriptions.forEach((subscription) => {
    const id = subscription.petStoreOwnerId?.toString();
    if (id && !petStoreSubscriptionsByUserId.has(id)) petStoreSubscriptionsByUserId.set(id, subscription);
  });

  const subscriptionPlanIds = uniqueSorted([
    ...veterinarianSubscriptions.map((subscription) => subscription.subscriptionPlanId?.toString()),
    ...petStoreSubscriptions.map((subscription) => subscription.subscriptionPlanId?.toString()),
  ]);
  const plans = subscriptionPlanIds.length > 0
    ? await SubscriptionPlan.find({ _id: { $in: subscriptionPlanIds } })
      .select('name planType price durationInDays features status').lean().maxTimeMS(3000)
    : [];
  const plansById = new Map(plans.map((plan) => [plan._id.toString(), plan]));

  const leads = users.map((user) => {
    const userId = user._id.toString();
    const veterinarian = profilesByUserId.get(userId) || null;
    const petStore = storesByOwnerId.get(userId) || null;
    const documents = (Array.isArray(user.documentUploads) ? user.documentUploads : [])
      .map((document) => text(document?.type).toUpperCase())
      .filter(Boolean);
    if (veterinarian?.licenseDocument && !documents.includes('LICENSE_DOCUMENT')) {
      documents.push('LICENSE_DOCUMENT');
    }

    const address = petStore?.address || user.address || {};
    const subscription = user.role === USER_ROLES.VETERINARIAN
      ? mapSubscription(veterinarianSubscriptionsByUserId.get(userId), plansById)
      : mapSubscription(petStoreSubscriptionsByUserId.get(userId), plansById);

    return {
      id: userId,
      name: user.fullName || user.name || null,
      email: user.email || null,
      phone: user.phone || petStore?.phone || null,
      role: user.role,
      status: user.status,
      registrationType: user.role,
      emailVerified: Boolean(user.isEmailVerified),
      phoneVerified: Boolean(user.isPhoneVerified),
      city: address?.city || null,
      country: address?.country || null,
      region: address?.state || null,
      area: address?.line2 || address?.line1 || null,
      specializations: veterinarian?.specializations || [],
      veterinarian: veterinarian ? {
        experienceYears: veterinarian.experienceYears || null,
        isVerified: Boolean(veterinarian.isVerified),
        profileCompleted: Boolean(veterinarian.profileCompleted),
      } : null,
      business: petStore ? {
        name: petStore.name || null,
        isActive: Boolean(petStore.isActive),
        profileCompleted: Boolean(petStore.profileCompleted),
        isPublic: Boolean(petStore.isPublic),
      } : null,
      documentTypes: uniqueSorted(documents),
      subscription,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  });

  const filterOptions = {
    roles: uniqueSorted(leads.map((lead) => lead.role)),
    statuses: uniqueSorted(leads.map((lead) => lead.status)),
    specializations: uniqueSorted(leads.flatMap((lead) => lead.specializations || [])),
    cities: uniqueSorted(leads.map((lead) => lead.city)),
    countries: uniqueSorted(leads.map((lead) => lead.country)),
    regions: uniqueSorted(leads.map((lead) => lead.region)),
    areas: uniqueSorted(leads.map((lead) => lead.area)),
    documentTypes: uniqueSorted(leads.flatMap((lead) => lead.documentTypes || [])),
  };

  const total = leads.length;
  const start = (page - 1) * limit;
  return {
    users: leads.slice(start, start + limit),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
    filterOptions,
    stats: {
      subscriptionRevenue,
    },
    generatedAt: new Date().toISOString(),
  };
};

/**
 * Get comprehensive CRM data for external CRM system
 * Returns all pet owners, appointments, orders, and statistics
 */
const getCrmData = async (filters = {}) => {
  try {
    // Extract filters
    const {
      startDate,
      endDate,
      petOwnerId,
      veterinarianId,
      orderStatus,
      appointmentStatus
    } = filters;

    // Build date filter
    const dateFilter = {};
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
      if (endDate) dateFilter.createdAt.$lte = new Date(endDate);
    }

    // Get all appointments with populated veterinarian and pet owner
    const appointmentFilter = { ...dateFilter };
    if (veterinarianId) appointmentFilter.veterinarianId = veterinarianId;
    if (petOwnerId) appointmentFilter.petOwnerId = petOwnerId;
    if (appointmentStatus) appointmentFilter.status = appointmentStatus;

    const appointments = await Appointment.find(appointmentFilter)
      .populate('veterinarianId', 'name email phone profileImage fullName')
      .populate('petOwnerId', 'name email phone profileImage fullName')
      .populate('petId', 'name species breed')
      .sort({ createdAt: -1 })
      .lean();

    const scopedPetOwnerIds = veterinarianId
      ? [...new Set(appointments.map((a) => a?.petOwnerId?._id?.toString?.() || a?.petOwnerId?.toString?.()).filter(Boolean))]
      : [];

    // Get all pet owners
    const petOwnerFilter = { role: 'PET_OWNER' };
    if (petOwnerId) {
      petOwnerFilter._id = petOwnerId;
    } else if (veterinarianId) {
      petOwnerFilter._id = { $in: scopedPetOwnerIds };
    }
    
    const petOwners = await User.find(petOwnerFilter)
      .select('-password')
      .sort({ createdAt: -1 })
      .lean();

    // Get all orders with populated pet owner, pet store, and owner
    const orderFilter = { ...dateFilter };
    if (petOwnerId) {
      orderFilter.petOwnerId = petOwnerId;
    } else if (veterinarianId) {
      orderFilter.petOwnerId = { $in: scopedPetOwnerIds };
    }
    if (orderStatus) orderFilter.status = orderStatus;

    const orders = await Order.find(orderFilter)
      .populate('petOwnerId', 'name email phone fullName')
      .populate('petStoreId', 'name logo')
      .populate('ownerId', 'name email fullName')
      .populate('items.productId', 'name images price discountPrice')
      .sort({ createdAt: -1 })
      .lean();

    // Calculate statistics
    const stats = {
      petOwners: {
        total: petOwners.length,
        active: petOwners.filter(p => p.status === 'APPROVED').length,
        pending: petOwners.filter(p => p.status === 'PENDING').length,
        blocked: petOwners.filter(p => p.status === 'BLOCKED').length
      },
      appointments: {
        total: appointments.length,
        pending: appointments.filter(a => a.status === 'PENDING').length,
        confirmed: appointments.filter(a => a.status === 'CONFIRMED').length,
        completed: appointments.filter(a => a.status === 'COMPLETED').length,
        cancelled: appointments.filter(a => a.status === 'CANCELLED').length,
        byType: {
          visit: appointments.filter(a => a.bookingType === 'VISIT').length,
          online: appointments.filter(a => a.bookingType === 'ONLINE').length
        },
        byPaymentStatus: {
          unpaid: appointments.filter(a => a.paymentStatus === 'UNPAID').length,
          paid: appointments.filter(a => a.paymentStatus === 'PAID').length,
          refunded: appointments.filter(a => a.paymentStatus === 'REFUNDED').length
        }
      },
      orders: {
        total: orders.length,
        totalRevenue: orders
          .filter(o => o.paymentStatus === 'PAID')
          .reduce((sum, o) => sum + (o.total || 0), 0),
        byStatus: {
          pending: orders.filter(o => o.status === 'PENDING').length,
          confirmed: orders.filter(o => o.status === 'CONFIRMED').length,
          processing: orders.filter(o => o.status === 'PROCESSING').length,
          shipped: orders.filter(o => o.status === 'SHIPPED').length,
          delivered: orders.filter(o => o.status === 'DELIVERED').length,
          cancelled: orders.filter(o => o.status === 'CANCELLED').length,
          refunded: orders.filter(o => o.status === 'REFUNDED').length
        },
        byPaymentStatus: {
          unpaid: orders.filter(o => o.paymentStatus === 'UNPAID').length,
          paid: orders.filter(o => o.paymentStatus === 'PAID').length,
          partial: orders.filter(o => o.paymentStatus === 'PARTIAL').length,
          refunded: orders.filter(o => o.paymentStatus === 'REFUNDED').length
        },
        averageOrderValue: orders.length > 0
          ? orders.reduce((sum, o) => sum + (o.total || 0), 0) / orders.length
          : 0
      },
      recentActivity: {
        newPetOwnersLast30Days: petOwners.filter(p => {
          const daysAgo = (Date.now() - new Date(p.createdAt).getTime()) / (1000 * 60 * 60 * 24);
          return daysAgo <= 30;
        }).length,
        newAppointmentsLast30Days: appointments.filter(a => {
          const daysAgo = (Date.now() - new Date(a.createdAt).getTime()) / (1000 * 60 * 60 * 24);
          return daysAgo <= 30;
        }).length,
        newOrdersLast30Days: orders.filter(o => {
          const daysAgo = (Date.now() - new Date(o.createdAt).getTime()) / (1000 * 60 * 60 * 24);
          return daysAgo <= 30;
        }).length
      }
    };

    return {
      petOwners,
      appointments,
      orders,
      stats,
      generatedAt: new Date().toISOString(),
      filters: filters
    };
  } catch (error) {
    console.error('Error fetching CRM data:', error);
    throw error;
  }
};

module.exports = {
  getCrmData,
  getCrmLeads,
};
