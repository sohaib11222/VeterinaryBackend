const User = require('../models/User');
const Pet = require('../models/Pet');
const Appointment = require('../models/Appointment');
const Transaction = require('../models/Transaction');
const Review = require('../models/Review');
const Notification = require('../models/Notification');
const Favorite = require('../models/Favorite');
const { validateObjectId } = require('../utils/validation');
const { withTimeout } = require('../utils/timeout');

/**
 * Get pet owner dashboard - Optimized version
 */
const getPetOwnerDashboard = async (petOwnerId) => {
  const startTime = Date.now();
  try {
    validateObjectId(petOwnerId, 'Pet Owner ID');
    
    console.log(`[Dashboard] Starting dashboard fetch for pet owner: ${petOwnerId}`);
    
    // Step 1: Get pet owner (fast)
    const petOwnerStart = Date.now();
    const petOwner = await User.findById(petOwnerId)
      .select('name email profileImage role')
      .lean()
      .maxTimeMS(2000);
    
    if (!petOwner || petOwner.role !== 'PET_OWNER') {
      throw new Error('Pet owner not found');
    }
    console.log(`[Dashboard] Step 1 - Pet owner found: ${petOwner.name} (${Date.now() - petOwnerStart}ms)`);

    const now = new Date();

    // Step 2: Get appointments - simplified, no populate
    const appointmentStart = Date.now();
    const appointmentQueries = await Promise.allSettled([
      // Upcoming appointments - minimal fields only
      Appointment.find({
        petOwnerId,
        appointmentDate: { $gte: now },
        status: { $in: ['PENDING', 'CONFIRMED'] }
      })
        .select('veterinarianId petId appointmentDate appointmentTime status')
        .sort({ appointmentDate: 1 })
        .limit(5) // Reduced limit
        .lean()
        .maxTimeMS(2000),
      // Completed appointments - minimal fields
      Appointment.find({
        petOwnerId,
        status: 'COMPLETED'
      })
        .select('veterinarianId petId appointmentDate appointmentTime status')
        .sort({ appointmentDate: -1 })
        .limit(5) // Reduced limit
        .lean()
        .maxTimeMS(2000),
      // Cancelled - skip for now to speed up
      Promise.resolve([]),
      // Unique veterinarians count - use distinct for better performance
      Appointment.distinct('veterinarianId', { petOwnerId })
        .maxTimeMS(1500)
    ]);
    console.log(`[Dashboard] Step 2 - Appointments fetched (${Date.now() - appointmentStart}ms)`);

    // Extract results
    const upcomingAppointmentsRaw = appointmentQueries[0].status === 'fulfilled' ? appointmentQueries[0].value : [];
    const completedAppointmentsRaw = appointmentQueries[1].status === 'fulfilled' ? appointmentQueries[1].value : [];
    const cancelledAppointmentsRaw = [];
    const uniqueVeterinariansList = appointmentQueries[3].status === 'fulfilled' ? appointmentQueries[3].value : [];

    // Log failures
    appointmentQueries.forEach((result, index) => {
      if (result.status === 'rejected') {
        console.error(`[Dashboard] Appointment query ${index} failed:`, result.reason?.message || result.reason);
      }
    });

    // Step 3: Get counts only (skip population for speed)
    const countsStart = Date.now();
    const countQueries = await Promise.allSettled([
      Pet.countDocuments({ ownerId: petOwnerId, isActive: true }).maxTimeMS(1500),
      Notification.countDocuments({ userId: petOwnerId, isRead: false }).maxTimeMS(1500),
      Favorite.countDocuments({ petOwnerId }).maxTimeMS(1500),
      // Skip reviews for now to speed up
      Promise.resolve([])
    ]);
    console.log(`[Dashboard] Step 3 - Counts fetched (${Date.now() - countsStart}ms)`);

    // Get unique veterinarians count from distinct query result
    const totalVeterinariansVisited = Array.isArray(uniqueVeterinariansList) ? uniqueVeterinariansList.filter(Boolean).length : 0;

    const petsCount = countQueries[0].status === 'fulfilled' ? countQueries[0].value : 0;
    const unreadNotificationsCount = countQueries[1].status === 'fulfilled' ? countQueries[1].value : 0;
    const favoriteVeterinariansCount = countQueries[2].status === 'fulfilled' ? countQueries[2].value : 0;
    const recentReviews = [];

    // Log failures
    countQueries.forEach((result, index) => {
      if (result.status === 'rejected') {
        console.error(`[Dashboard] Count query ${index} failed:`, result.reason?.message || result.reason);
      }
    });

    // Build response - minimal data for speed
    const totalTime = Date.now() - startTime;
    const result = {
      petOwner: {
        id: petOwner._id,
        name: petOwner.name,
        email: petOwner.email,
        profileImage: petOwner.profileImage
      },
      petsCount,
      upcomingAppointments: {
        count: upcomingAppointmentsRaw.length,
        appointments: upcomingAppointmentsRaw // Return raw, no population for speed
      },
      completedAppointments: {
        count: completedAppointmentsRaw.length,
        appointments: completedAppointmentsRaw // Return raw, no population for speed
      },
      cancelledAppointments: {
        count: 0,
        appointments: []
      },
      totalCompletedAppointments: completedAppointmentsRaw.length,
      totalVeterinariansVisited,
      recentReviews,
      unreadNotificationsCount,
      favoriteVeterinariansCount
    };

    console.log(`[Dashboard] ✅ Dashboard completed for ${petOwnerId} in ${totalTime}ms`);
    return result;
  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error(`[Dashboard] Error in getPetOwnerDashboard after ${totalTime}ms:`, error);
    console.error('[Dashboard] Error stack:', error.stack);
    // Re-throw with more context
    const enhancedError = new Error(`Dashboard fetch failed: ${error.message}`);
    enhancedError.originalError = error;
    throw enhancedError;
  }
};

/**
 * Get appointment history
 */
const getAppointmentHistory = async (petOwnerId, options = {}) => {
  const { status, petId, fromDate, toDate, page = 1, limit = 20 } = options;
  const skip = (page - 1) * limit;

  const query = { petOwnerId };

  if (status) {
    query.status = status.toUpperCase();
  }

  if (petId) {
    query.petId = petId;
  }

  if (fromDate || toDate) {
    query.appointmentDate = {};
    if (fromDate) {
      query.appointmentDate.$gte = new Date(fromDate);
    }
    if (toDate) {
      query.appointmentDate.$lte = new Date(toDate);
    }
  }

  const [appointmentsRaw, total] = await Promise.all([
    Appointment.find(query)
      .select('veterinarianId petId appointmentDate appointmentTime status appointmentNumber bookingType reason')
      .skip(skip)
      .limit(limit)
      .sort({ appointmentDate: -1 })
      .lean()
      .maxTimeMS(3000),
    Appointment.countDocuments(query).maxTimeMS(2000)
  ]);

  // Populate separately for better performance
  const veterinarianIds = [...new Set(appointmentsRaw.map(a => a.veterinarianId?.toString()).filter(Boolean))];
  const petIds = [...new Set(appointmentsRaw.map(a => a.petId?.toString()).filter(Boolean))];

  const [veterinarians, pets, veterinarianProfiles] = await Promise.all([
    veterinarianIds.length > 0 ? User.find({ _id: { $in: veterinarianIds } })
      .select('name email phone profileImage veterinarianProfile')
      .lean()
      .maxTimeMS(2000) : Promise.resolve([]),
    petIds.length > 0 ? Pet.find({ _id: { $in: petIds } })
      .select('name species breed photo')
      .lean()
      .maxTimeMS(2000) : Promise.resolve([]),
    veterinarianIds.length > 0 ? require('../models/VeterinarianProfile').find({ userId: { $in: veterinarianIds } })
      .select('userId title specializations')
      .lean()
      .maxTimeMS(2000) : Promise.resolve([])
  ]);

  // Create lookup maps
  const veterinarianMap = {};
  veterinarians.forEach(v => { veterinarianMap[v._id.toString()] = v; });
  const petMap = {};
  pets.forEach(p => { petMap[p._id.toString()] = p; });
  const profileMap = {};
  veterinarianProfiles.forEach(p => { profileMap[p.userId.toString()] = p; });

  // Attach populated data
  const appointments = appointmentsRaw.map(apt => {
    const vet = apt.veterinarianId ? veterinarianMap[apt.veterinarianId.toString()] : null;
    if (vet && profileMap[vet.veterinarianProfile?.toString()]) {
      vet.veterinarianProfile = profileMap[vet.veterinarianProfile.toString()];
    }
    return {
      ...apt,
      veterinarianId: vet,
      petId: apt.petId ? petMap[apt.petId.toString()] : null
    };
  });

  return {
    appointments,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };
};

/**
 * Get payment history
 */
const getPaymentHistory = async (petOwnerId, options = {}) => {
  const { status, fromDate, toDate, page = 1, limit = 20 } = options;
  const skip = (page - 1) * limit;

  const query = { userId: petOwnerId, amount: { $gt: 0 } };

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
      .select('relatedAppointmentId amount status type createdAt')
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 })
      .lean()
      .maxTimeMS(3000),
    Transaction.countDocuments(query).maxTimeMS(2000)
  ]);

  // Populate separately
  const appointmentIds = [...new Set(transactionsRaw.map(t => t.relatedAppointmentId?.toString()).filter(Boolean))];
  const [appointments, veterinarians] = await Promise.all([
    appointmentIds.length > 0 ? require('../models/Appointment').find({ _id: { $in: appointmentIds } })
      .select('appointmentNumber appointmentDate appointmentTime veterinarianId petId reason')
      .lean()
      .maxTimeMS(2000) : Promise.resolve([]),
    appointmentIds.length > 0 ? (async () => {
      const apts = await require('../models/Appointment').find({ _id: { $in: appointmentIds } })
        .select('veterinarianId petId')
        .lean()
        .maxTimeMS(2000);
      const vetIds = [...new Set(apts.map(a => a.veterinarianId?.toString()).filter(Boolean))];
      return vetIds.length > 0 ? User.find({ _id: { $in: vetIds } })
        .select('name email profileImage')
        .lean()
        .maxTimeMS(2000) : [];
    })() : Promise.resolve([])
  ]);

  const petIds = [...new Set(appointments.map(a => a.petId?.toString()).filter(Boolean))];
  const pets = petIds.length > 0 ? await Pet.find({ _id: { $in: petIds } })
    .select('name species breed photo')
    .lean()
    .maxTimeMS(2000) : [];

  // Create lookup maps
  const appointmentMap = {};
  appointments.forEach(a => { appointmentMap[a._id.toString()] = a; });
  const veterinarianMap = {};
  veterinarians.forEach(v => { veterinarianMap[v._id.toString()] = v; });
  const petMap = {};
  pets.forEach(p => { petMap[p._id.toString()] = p; });

  // Attach populated data
  const formattedTransactions = transactionsRaw.map(txn => {
    const appointment = txn.relatedAppointmentId ? appointmentMap[txn.relatedAppointmentId.toString()] : null;
    if (appointment && appointment.veterinarianId) {
      appointment.veterinarianId = veterinarianMap[appointment.veterinarianId.toString()] || appointment.veterinarianId;
    }
    if (appointment && appointment.petId) {
      appointment.petId = petMap[appointment.petId.toString()] || appointment.petId;
    }
    return {
      ...txn,
      relatedAppointmentId: appointment
    };
  });

  return {
    transactions: formattedTransactions,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };
};

module.exports = {
  getPetOwnerDashboard,
  getAppointmentHistory,
  getPaymentHistory
};
