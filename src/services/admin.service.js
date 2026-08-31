const User = require('../models/User');
const Appointment = require('../models/Appointment');
const Transaction = require('../models/Transaction');
const VeterinarianProfile = require('../models/VeterinarianProfile');
const Review = require('../models/Review');
const VeterinarianSubscription = require('../models/VeterinarianSubscription');
const Pet = require('../models/Pet');
const MedicalRecord = require('../models/MedicalRecord');
const PetStore = require('../models/PetStore');
const Product = require('../models/Product');
const Order = require('../models/Order');
const WithdrawalRequest = require('../models/WithdrawalRequest');
const SubscriptionPlan = require('../models/SubscriptionPlan');
const Announcement = require('../models/Announcement');
const InsuranceCompany = require('../models/InsuranceCompany');
const Specialization = require('../models/Specialization');
const Vaccine = require('../models/Vaccine');
const SupportTicket = require('../models/SupportTicket');

/**
 * Get dashboard statistics
 */
const getDashboardStats = async () => {
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);

  const [
    totalVeterinarians,
    totalPetOwners,
    totalAppointments,
    veterinariansPendingApproval,
    activeSubscriptionsCount,
    todaysAppointmentsCount,
    totalEarnings
  ] = await Promise.all([
    User.countDocuments({ role: 'VETERINARIAN' }).maxTimeMS(2000),
    User.countDocuments({ role: 'PET_OWNER' }).maxTimeMS(2000),
    Appointment.countDocuments().maxTimeMS(2000),
    User.countDocuments({ role: 'VETERINARIAN', status: 'PENDING' }).maxTimeMS(2000),
    VeterinarianSubscription.countDocuments({
      isActive: true,
      endDate: { $gt: new Date() }
    }).maxTimeMS(2000),
    Appointment.countDocuments({
      appointmentDate: {
        $gte: todayStart,
        $lte: todayEnd
      }
    }).maxTimeMS(2000),
    Transaction.aggregate([
      { $match: { status: 'SUCCESS' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]).option({ maxTimeMS: 3000 })
  ]);

  return {
    totalVeterinarians,
    totalPetOwners,
    totalAppointments,
    totalEarnings: totalEarnings[0]?.total || 0,
    veterinariansPendingApproval,
    activeSubscriptionsCount,
    todaysAppointmentsCount
  };
};

/**
 * Return compact, admin-only change markers for the sidebar.
 *
 * The client records when an individual admin has visited each section. That
 * lets it show a blue dot for records created since that visit, while pending
 * approval/workflow items remain red until they are acted on.
 */
const getSidebarIndicators = async () => {
  const latestCreatedAt = async (Model, query = {}) => {
    const latest = await Model.findOne(query)
      .select('createdAt')
      .sort({ createdAt: -1 })
      .lean()
      .maxTimeMS(2000);

    return latest?.createdAt || null;
  };
  const latestUpdatedAt = async (Model, query = {}) => {
    const latest = await Model.findOne(query)
      .select('updatedAt lastMessageAt')
      .sort({ updatedAt: -1 })
      .lean()
      .maxTimeMS(2000);
    return latest?.lastMessageAt || latest?.updatedAt || null;
  };

  const petStoreRoles = { $in: ['PET_STORE', 'PARAPHARMACY'] };
  const [
    allUsers,
    veterinarians,
    pendingVeterinarians,
    pendingPetStores,
    pets,
    medicalRecords,
    vaccines,
    appointments,
    petStores,
    products,
    orders,
    transactions,
    withdrawals,
    subscriptions,
    subscriptionPlans,
    announcements,
    reviews,
    insuranceCompanies,
    specializations,
    pendingVeterinarianCount,
    pendingPetStoreCount,
    pendingWithdrawalCount,
    supportTickets,
    unreadSupportTicketCount,
  ] = await Promise.all([
    latestCreatedAt(User),
    latestCreatedAt(User, { role: 'VETERINARIAN' }),
    latestCreatedAt(User, { role: 'VETERINARIAN', status: 'PENDING' }),
    latestCreatedAt(User, { role: petStoreRoles, status: 'PENDING' }),
    latestCreatedAt(Pet),
    latestCreatedAt(MedicalRecord),
    latestCreatedAt(Vaccine),
    latestCreatedAt(Appointment),
    latestCreatedAt(PetStore),
    latestCreatedAt(Product),
    latestCreatedAt(Order),
    latestCreatedAt(Transaction),
    latestCreatedAt(WithdrawalRequest),
    latestCreatedAt(VeterinarianSubscription),
    latestCreatedAt(SubscriptionPlan),
    latestCreatedAt(Announcement),
    latestCreatedAt(Review),
    latestCreatedAt(InsuranceCompany),
    latestCreatedAt(Specialization),
    User.countDocuments({ role: 'VETERINARIAN', status: 'PENDING' }).maxTimeMS(2000),
    User.countDocuments({ role: petStoreRoles, status: 'PENDING' }).maxTimeMS(2000),
    WithdrawalRequest.countDocuments({ status: 'PENDING' }).maxTimeMS(2000),
    latestUpdatedAt(SupportTicket),
    SupportTicket.countDocuments({ unreadForAdmin: true }).maxTimeMS(2000),
  ]);

  return {
    generatedAt: new Date(),
    sections: {
      users: { latestAt: allUsers },
      veterinarians: { latestAt: veterinarians },
      veterinarianApprovals: {
        latestAt: pendingVeterinarians,
        pendingCount: pendingVeterinarianCount,
      },
      petStoreApprovals: {
        latestAt: pendingPetStores,
        pendingCount: pendingPetStoreCount,
      },
      pets: { latestAt: pets },
      medicalRecords: { latestAt: medicalRecords },
      vaccines: { latestAt: vaccines },
      appointments: { latestAt: appointments },
      petStores: { latestAt: petStores },
      products: { latestAt: products },
      orders: { latestAt: orders },
      transactions: { latestAt: transactions },
      withdrawals: {
        latestAt: withdrawals,
        pendingCount: pendingWithdrawalCount,
      },
      subscriptions: { latestAt: subscriptions },
      subscriptionPlans: { latestAt: subscriptionPlans },
      announcements: { latestAt: announcements },
      reviews: { latestAt: reviews },
      insuranceCompanies: { latestAt: insuranceCompanies },
      specializations: { latestAt: specializations },
      supportTickets: {
        latestAt: supportTickets,
        pendingCount: unreadSupportTicketCount,
      },
    },
  };
};

/**
 * Get all users
 */
const getUsers = async (options = {}) => {
  const { role, status, search, page = 1, limit = 20 } = options;
  const skip = (page - 1) * limit;

  const query = {};
  if (role) {
    query.role = role.toUpperCase();
  }
  if (status) {
    query.status = status.toUpperCase();
  }
  if (search) {
    const q = String(search).trim();
    if (q) {
      query.$or = [
        { name: { $regex: q, $options: 'i' } },
        { email: { $regex: q, $options: 'i' } },
        { phone: { $regex: q, $options: 'i' } }
      ];
    }
  }

  const [users, total] = await Promise.all([
    User.find(query)
      .select('-password')
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 })
      .lean()
      .maxTimeMS(3000),
    User.countDocuments(query).maxTimeMS(2000)
  ]);

  return {
    users,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };
};

/**
 * Admin: list pets
 */
const getAllPets = async (options = {}) => {
  const { ownerId, species, isActive, search, page = 1, limit = 20 } = options;
  const skip = (page - 1) * limit;

  const query = {};
  if (ownerId) query.ownerId = ownerId;
  if (species) query.species = String(species).toUpperCase();
  if (isActive !== undefined && String(isActive).toLowerCase() !== 'all') {
    query.isActive = String(isActive).toLowerCase() === 'true' || isActive === true;
  }
  if (search) {
    const q = String(search).trim();
    if (q) {
      query.$or = [
        { name: { $regex: q, $options: 'i' } },
        { breed: { $regex: q, $options: 'i' } },
        { microchipNumber: { $regex: q, $options: 'i' } }
      ];
    }
  }

  const [petsRaw, total] = await Promise.all([
    Pet.find(query)
      .select('ownerId name species breed gender age weight photo microchipNumber isActive createdAt')
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 })
      .lean()
      .maxTimeMS(3000),
    Pet.countDocuments(query).maxTimeMS(2000)
  ]);

  const ownerIds = [...new Set(petsRaw.map(p => p.ownerId?.toString()).filter(Boolean))];
  const owners = ownerIds.length > 0
    ? await User.find({ _id: { $in: ownerIds } })
      .select('name email phone')
      .lean()
      .maxTimeMS(2000)
    : [];
  const ownerMap = {};
  owners.forEach(o => { ownerMap[o._id.toString()] = o; });

  const pets = petsRaw.map(p => ({
    ...p,
    ownerId: p.ownerId ? ownerMap[p.ownerId.toString()] : null,
  }));

  return {
    pets,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };
};

/**
 * Admin: list medical records
 */
const getAllMedicalRecords = async (options = {}) => {
  const { petOwnerId, petId, recordType, search, page = 1, limit = 20 } = options;
  const skip = (page - 1) * limit;

  const query = {};
  if (petOwnerId) query.petOwnerId = petOwnerId;
  if (petId) query.petId = petId;
  if (recordType) query.recordType = String(recordType).toUpperCase();
  if (search) {
    const q = String(search).trim();
    if (q) {
      query.$or = [
        { title: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } },
        { fileName: { $regex: q, $options: 'i' } }
      ];
    }
  }

  const [recordsRaw, total] = await Promise.all([
    MedicalRecord.find(query)
      .select('petId petOwnerId title description recordType fileUrl fileName fileSize uploadedDate relatedAppointmentId relatedVeterinarianId')
      .skip(skip)
      .limit(limit)
      .sort({ uploadedDate: -1 })
      .lean()
      .maxTimeMS(3000),
    MedicalRecord.countDocuments(query).maxTimeMS(2000)
  ]);

  const petIds = [...new Set(recordsRaw.map(r => r.petId?.toString()).filter(Boolean))];
  const ownerIds = [...new Set(recordsRaw.map(r => r.petOwnerId?.toString()).filter(Boolean))];
  const apptIds = [...new Set(recordsRaw.map(r => r.relatedAppointmentId?.toString()).filter(Boolean))];
  const vetIds = [...new Set(recordsRaw.map(r => r.relatedVeterinarianId?.toString()).filter(Boolean))];

  const [pets, owners, appts, vets] = await Promise.all([
    petIds.length > 0 ? Pet.find({ _id: { $in: petIds } })
      .select('name species breed photo')
      .lean()
      .maxTimeMS(2000) : Promise.resolve([]),
    ownerIds.length > 0 ? User.find({ _id: { $in: ownerIds } })
      .select('name email phone')
      .lean()
      .maxTimeMS(2000) : Promise.resolve([]),
    apptIds.length > 0 ? require('../models/Appointment').find({ _id: { $in: apptIds } })
      .select('appointmentNumber appointmentDate')
      .lean()
      .maxTimeMS(2000) : Promise.resolve([]),
    vetIds.length > 0 ? User.find({ _id: { $in: vetIds } })
      .select('name email')
      .lean()
      .maxTimeMS(2000) : Promise.resolve([]),
  ]);

  const petMap = {};
  pets.forEach(p => { petMap[p._id.toString()] = p; });
  const ownerMap = {};
  owners.forEach(o => { ownerMap[o._id.toString()] = o; });
  const apptMap = {};
  appts.forEach(a => { apptMap[a._id.toString()] = a; });
  const vetMap = {};
  vets.forEach(v => { vetMap[v._id.toString()] = v; });

  const records = recordsRaw.map(r => ({
    ...r,
    petId: r.petId ? petMap[r.petId.toString()] : null,
    petOwnerId: r.petOwnerId ? ownerMap[r.petOwnerId.toString()] : null,
    relatedAppointmentId: r.relatedAppointmentId ? apptMap[r.relatedAppointmentId.toString()] : null,
    relatedVeterinarianId: r.relatedVeterinarianId ? vetMap[r.relatedVeterinarianId.toString()] : null,
  }));

  return {
    records,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };
};

/**
 * Admin: delete medical record
 */
const deleteMedicalRecordAdmin = async (recordId) => {
  const record = await MedicalRecord.findById(recordId)
    .lean()
    .maxTimeMS(2000);
  if (!record) {
    throw new Error('Medical record not found');
  }
  await MedicalRecord.findByIdAndDelete(recordId).maxTimeMS(2000);
  return { message: 'Medical record deleted successfully' };
};

/**
 * Get all transactions
 */
const getAllTransactions = async (options = {}) => {
  const { status, fromDate, toDate, page = 1, limit = 20 } = options;
  const skip = (page - 1) * limit;

  const query = {};
  if (status) {
    query.status = status.toUpperCase();
  }
  if (fromDate || toDate) {
    query.createdAt = {};
    if (fromDate) {
      query.createdAt.$gte = new Date(fromDate);
    }
    if (toDate) {
      query.createdAt.$lte = new Date(toDate);
    }
  }

  const [transactionsRaw, total] = await Promise.all([
    Transaction.find(query)
      .select('userId relatedAppointmentId relatedOrderId amount status type createdAt')
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 })
      .lean()
      .maxTimeMS(3000),
    Transaction.countDocuments(query).maxTimeMS(2000)
  ]);

  // Populate separately
  const userIds = [...new Set(transactionsRaw.map(t => t.userId?.toString()).filter(Boolean))];
  const appointmentIds = [...new Set(transactionsRaw.map(t => t.relatedAppointmentId?.toString()).filter(Boolean))];
  const orderIds = [...new Set(transactionsRaw.map(t => t.relatedOrderId?.toString()).filter(Boolean))];

  const [users, appointments, orders] = await Promise.all([
    userIds.length > 0 ? User.find({ _id: { $in: userIds } })
      .select('name email')
      .lean()
      .maxTimeMS(2000) : Promise.resolve([]),
    appointmentIds.length > 0 ? require('../models/Appointment').find({ _id: { $in: appointmentIds } })
      .select('appointmentNumber')
      .lean()
      .maxTimeMS(2000) : Promise.resolve([]),
    orderIds.length > 0 ? require('../models/Order').find({ _id: { $in: orderIds } })
      .select('orderNumber')
      .lean()
      .maxTimeMS(2000) : Promise.resolve([])
  ]);

  // Create lookup maps
  const userMap = {};
  users.forEach(u => { userMap[u._id.toString()] = u; });
  const appointmentMap = {};
  appointments.forEach(a => { appointmentMap[a._id.toString()] = a; });
  const orderMap = {};
  orders.forEach(o => { orderMap[o._id.toString()] = o; });

  // Attach populated data
  const transactions = transactionsRaw.map(txn => ({
    ...txn,
    userId: txn.userId ? userMap[txn.userId.toString()] : null,
    relatedAppointmentId: txn.relatedAppointmentId ? appointmentMap[txn.relatedAppointmentId.toString()] : null,
    relatedOrderId: txn.relatedOrderId ? orderMap[txn.relatedOrderId.toString()] : null
  }));

  return {
    transactions,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };
};

/**
 * Get all reviews
 */
const getAllReviews = async (options = {}) => {
  const { veterinarianId, petOwnerId, rating, page = 1, limit = 20 } = options;
  const skip = (page - 1) * limit;

  const query = {};
  if (veterinarianId) {
    query.veterinarianId = veterinarianId;
  }
  if (petOwnerId) {
    query.petOwnerId = petOwnerId;
  }
  if (rating) {
    query.rating = parseInt(rating);
  }

  const [reviewsRaw, total] = await Promise.all([
    Review.find(query)
      .select('veterinarianId petOwnerId petId rating reviewText reviewType createdAt')
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 })
      .lean()
      .maxTimeMS(3000),
    Review.countDocuments(query).maxTimeMS(2000)
  ]);

  // Populate separately
  const veterinarianIds = [...new Set(reviewsRaw.map(r => r.veterinarianId?.toString()).filter(Boolean))];
  const petOwnerIds = [...new Set(reviewsRaw.map(r => r.petOwnerId?.toString()).filter(Boolean))];
  const petIds = [...new Set(reviewsRaw.map(r => r.petId?.toString()).filter(Boolean))];

  const [veterinarians, petOwners, pets] = await Promise.all([
    veterinarianIds.length > 0 ? User.find({ _id: { $in: veterinarianIds } })
      .select('name email profileImage')
      .lean()
      .maxTimeMS(2000) : Promise.resolve([]),
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
  const veterinarianMap = {};
  veterinarians.forEach(v => { veterinarianMap[v._id.toString()] = v; });
  const petOwnerMap = {};
  petOwners.forEach(p => { petOwnerMap[p._id.toString()] = p; });
  const petMap = {};
  pets.forEach(p => { petMap[p._id.toString()] = p; });

  // Attach populated data
  const reviews = reviewsRaw.map(review => ({
    ...review,
    veterinarianId: review.veterinarianId ? veterinarianMap[review.veterinarianId.toString()] : null,
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
 * Get system activity
 */
const getSystemActivity = async (options = {}) => {
  const { page = 1, limit = 50 } = options;
  const skip = (page - 1) * limit;

  const [recentAppointmentsRaw, recentTransactionsRaw] = await Promise.all([
    Appointment.find()
      .select('veterinarianId petOwnerId petId appointmentDate appointmentTime status createdAt')
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip)
      .lean()
      .maxTimeMS(3000),
    Transaction.find()
      .select('userId amount status type createdAt')
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip)
      .lean()
      .maxTimeMS(3000)
  ]);

  // Populate separately
  const vetIds = [...new Set(recentAppointmentsRaw.map(a => a.veterinarianId?.toString()).filter(Boolean))];
  const ownerIds = [...new Set(recentAppointmentsRaw.map(a => a.petOwnerId?.toString()).filter(Boolean))];
  const petIds = [...new Set(recentAppointmentsRaw.map(a => a.petId?.toString()).filter(Boolean))];
  const userIds = [...new Set(recentTransactionsRaw.map(t => t.userId?.toString()).filter(Boolean))];

  const [vets, owners, pets, users] = await Promise.all([
    vetIds.length > 0 ? User.find({ _id: { $in: vetIds } })
      .select('name email')
      .lean()
      .maxTimeMS(2000) : Promise.resolve([]),
    ownerIds.length > 0 ? User.find({ _id: { $in: ownerIds } })
      .select('name email')
      .lean()
      .maxTimeMS(2000) : Promise.resolve([]),
    petIds.length > 0 ? require('../models/Pet').find({ _id: { $in: petIds } })
      .select('name species')
      .lean()
      .maxTimeMS(2000) : Promise.resolve([]),
    userIds.length > 0 ? User.find({ _id: { $in: userIds } })
      .select('name email')
      .lean()
      .maxTimeMS(2000) : Promise.resolve([])
  ]);

  // Create lookup maps
  const vetMap = {};
  vets.forEach(v => { vetMap[v._id.toString()] = v; });
  const ownerMap = {};
  owners.forEach(o => { ownerMap[o._id.toString()] = o; });
  const petMap = {};
  pets.forEach(p => { petMap[p._id.toString()] = p; });
  const userMap = {};
  users.forEach(u => { userMap[u._id.toString()] = u; });

  // Attach populated data
  const recentAppointments = recentAppointmentsRaw.map(apt => ({
    ...apt,
    veterinarianId: apt.veterinarianId ? vetMap[apt.veterinarianId.toString()] : null,
    petOwnerId: apt.petOwnerId ? ownerMap[apt.petOwnerId.toString()] : null,
    petId: apt.petId ? petMap[apt.petId.toString()] : null
  }));

  const recentTransactions = recentTransactionsRaw.map(txn => ({
    ...txn,
    userId: txn.userId ? userMap[txn.userId.toString()] : null
  }));

  return {
    appointments: recentAppointments,
    transactions: recentTransactions,
    pagination: {
      page,
      limit,
      total: recentAppointments.length + recentTransactions.length,
      pages: Math.ceil((recentAppointments.length + recentTransactions.length) / limit)
    }
  };
};

module.exports = {
  getDashboardStats,
  getSidebarIndicators,
  getUsers,
  getAllTransactions,
  getAllReviews,
  getAllPets,
  getAllMedicalRecords,
  deleteMedicalRecordAdmin,
  getSystemActivity
};
