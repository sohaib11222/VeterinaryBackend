const Review = require('../models/Review');
const VeterinarianProfile = require('../models/VeterinarianProfile');
const Appointment = require('../models/Appointment');
const { validateObjectId } = require('../utils/validation');

/**
 * Create review
 */
const createReview = async (data) => {
  const { veterinarianId, petOwnerId, petId, appointmentId, rating, reviewText, reviewType, userRole } = data;

  if (String(userRole || '').toUpperCase() !== 'PET_OWNER') {
    const err = new Error('Access denied. Only pet owners can create reviews');
    err.statusCode = 403;
    throw err;
  }

  validateObjectId(veterinarianId, 'Veterinarian ID');
  validateObjectId(petOwnerId, 'Pet Owner ID');
  if (appointmentId) validateObjectId(appointmentId, 'Appointment ID');
  if (petId) validateObjectId(petId, 'Pet ID');

  // Determine review type
  const isAppointmentReview = !!appointmentId || reviewType === 'APPOINTMENT';
  const finalReviewType = isAppointmentReview ? 'APPOINTMENT' : 'OVERALL';

  let appointment = null;
  if (appointmentId) {
    appointment = await Appointment.findById(appointmentId)
      .select('veterinarianId petOwnerId petId status')
      .lean()
      .maxTimeMS(2000);

    if (!appointment) {
      const err = new Error('Appointment not found');
      err.statusCode = 404;
      throw err;
    }

    if (String(appointment.status || '').toUpperCase() !== 'COMPLETED') {
      const err = new Error('Review can only be created after the appointment is completed');
      err.statusCode = 403;
      throw err;
    }

    if (appointment.petOwnerId?.toString() !== petOwnerId.toString()) {
      const err = new Error('Unauthorized: This appointment does not belong to you');
      err.statusCode = 403;
      throw err;
    }

    if (appointment.veterinarianId?.toString() !== veterinarianId.toString()) {
      const err = new Error('Invalid veterinarian for this appointment');
      err.statusCode = 400;
      throw err;
    }
  }

  if (isAppointmentReview) {
    if (appointmentId) {
      const existingReview = await Review.findOne({ veterinarianId, petOwnerId, appointmentId });
      if (existingReview) {
        const err = new Error('You have already reviewed this appointment');
        err.statusCode = 400;
        throw err;
      }
    }
  } else {
    // Overall review is allowed only if pet owner had at least 1 completed appointment with this veterinarian
    const hasCompleted = await Appointment.exists({ veterinarianId, petOwnerId, status: 'COMPLETED' });
    if (!hasCompleted) {
      const err = new Error('You can only leave an overall review after completing an appointment with this veterinarian');
      err.statusCode = 403;
      throw err;
    }
    const existingReview = await Review.findOne({ 
      veterinarianId, 
      petOwnerId, 
      reviewType: 'OVERALL',
      appointmentId: null 
    });
    if (existingReview) {
      const err = new Error('You have already given an overall review for this veterinarian');
      err.statusCode = 400;
      throw err;
    }
  }

  const review = await Review.create({
    veterinarianId,
    petOwnerId,
    petId: petId || appointment?.petId || null,
    appointmentId: appointmentId || null,
    rating,
    reviewText,
    reviewType: finalReviewType
  });

  // Update veterinarian rating
  await updateVeterinarianRating(veterinarianId);

  return review;
};

const getMyAppointmentReview = async (appointmentId, userId, userRole) => {
  if (String(userRole || '').toUpperCase() !== 'PET_OWNER') {
    const err = new Error('Access denied');
    err.statusCode = 403;
    throw err;
  }

  validateObjectId(appointmentId, 'Appointment ID');
  validateObjectId(userId, 'User ID');

  const appointment = await Appointment.findById(appointmentId)
    .select('petOwnerId')
    .lean()
    .maxTimeMS(2000);

  if (!appointment) {
    const err = new Error('Appointment not found');
    err.statusCode = 404;
    throw err;
  }

  if (appointment.petOwnerId?.toString() !== userId.toString()) {
    const err = new Error('Unauthorized');
    err.statusCode = 403;
    throw err;
  }

  const review = await Review.findOne({ appointmentId, petOwnerId: userId })
    .select('veterinarianId petOwnerId petId appointmentId rating reviewText reviewType createdAt')
    .lean()
    .maxTimeMS(2000);

  return review || null;
};

/**
 * List reviews by veterinarian
 */
const listReviewsByVeterinarian = async (veterinarianId, options = {}) => {
  const { page = 1, limit = 10 } = options;
  const skip = (page - 1) * limit;

  const [reviewsRaw, total] = await Promise.all([
    Review.find({ veterinarianId })
      .select('petOwnerId petId appointmentId rating reviewText reviewType createdAt')
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
  const appointmentIds = [...new Set(reviewsRaw.map(r => r.appointmentId?.toString()).filter(Boolean))];

  const [petOwners, pets, appointments] = await Promise.all([
    petOwnerIds.length > 0 ? require('../models/User').find({ _id: { $in: petOwnerIds } })
      .select('name email profileImage')
      .lean()
      .maxTimeMS(2000) : Promise.resolve([]),
    petIds.length > 0 ? require('../models/Pet').find({ _id: { $in: petIds } })
      .select('name species')
      .lean()
      .maxTimeMS(2000) : Promise.resolve([]),
    appointmentIds.length > 0 ? require('../models/Appointment').find({ _id: { $in: appointmentIds } })
      .select('appointmentNumber appointmentDate')
      .lean()
      .maxTimeMS(2000) : Promise.resolve([])
  ]);

  // Create lookup maps
  const petOwnerMap = {};
  petOwners.forEach(p => { petOwnerMap[p._id.toString()] = p; });
  const petMap = {};
  pets.forEach(p => { petMap[p._id.toString()] = p; });
  const appointmentMap = {};
  appointments.forEach(a => { appointmentMap[a._id.toString()] = a; });

  // Attach populated data
  const reviews = reviewsRaw.map(review => ({
    ...review,
    petOwnerId: review.petOwnerId ? petOwnerMap[review.petOwnerId.toString()] : null,
    petId: review.petId ? petMap[review.petId.toString()] : null,
    appointmentId: review.appointmentId ? appointmentMap[review.appointmentId.toString()] : null
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
 * Delete review
 */
const deleteReview = async (reviewId, userId) => {
  const review = await Review.findById(reviewId);
  
  if (!review) {
    throw new Error('Review not found');
  }

  // Only review owner or admin can delete
  if (review.petOwnerId.toString() !== userId) {
    const user = await require('../models/User').findById(userId);
    if (!user || user.role !== 'ADMIN') {
      throw new Error('Unauthorized: You can only delete your own reviews');
    }
  }

  const veterinarianId = review.veterinarianId;
  await Review.findByIdAndDelete(reviewId);

  // Recalculate veterinarian rating
  await updateVeterinarianRating(veterinarianId);

  return { message: 'Review deleted successfully' };
};

/**
 * List all reviews (admin or general)
 */
const listReviews = async (options = {}) => {
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
    veterinarianIds.length > 0 ? require('../models/User').find({ _id: { $in: veterinarianIds } })
      .select('name email profileImage')
      .lean()
      .maxTimeMS(2000) : Promise.resolve([]),
    petOwnerIds.length > 0 ? require('../models/User').find({ _id: { $in: petOwnerIds } })
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
 * Get review by ID
 */
const getReviewById = async (reviewId) => {
  const review = await Review.findById(reviewId)
    .select('veterinarianId petOwnerId petId rating reviewText reviewType createdAt')
    .lean()
    .maxTimeMS(2000);

  if (!review) {
    throw new Error('Review not found');
  }

  // Populate separately
  const [veterinarian, petOwner, pet] = await Promise.all([
    review.veterinarianId ? require('../models/User').findById(review.veterinarianId)
      .select('name email profileImage')
      .lean()
      .maxTimeMS(1000) : null,
    review.petOwnerId ? require('../models/User').findById(review.petOwnerId)
      .select('name email profileImage')
      .lean()
      .maxTimeMS(1000) : null,
    review.petId ? require('../models/Pet').findById(review.petId)
      .select('name species')
      .lean()
      .maxTimeMS(1000) : null
  ]);

  return {
    ...review,
    veterinarianId: veterinarian,
    petOwnerId: petOwner,
    petId: pet
  };
};

/**
 * Update veterinarian rating
 */
const updateVeterinarianRating = async (veterinarianId) => {
  const profile = await VeterinarianProfile.findOne({ userId: veterinarianId })
    .maxTimeMS(2000);
  
  if (!profile) {
    return;
  }

  const reviews = await Review.find({ veterinarianId })
    .select('rating')
    .lean()
    .maxTimeMS(2000);
  
  if (reviews.length === 0) {
    profile.ratingAvg = 0;
    profile.ratingCount = 0;
  } else {
    const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
    profile.ratingAvg = totalRating / reviews.length;
    profile.ratingCount = reviews.length;
  }

  await profile.save();
};

module.exports = {
  createReview,
  getMyAppointmentReview,
  listReviewsByVeterinarian,
  listReviews,
  getReviewById,
  deleteReview
};
