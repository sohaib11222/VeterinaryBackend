const RescheduleRequest = require('../models/RescheduleRequest');
const Appointment = require('../models/Appointment');
const VideoSession = require('../models/VideoSession');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const notificationService = require('./notification.service');
const appointmentService = require('./appointment.service');
const paymentService = require('./payment.service');
const config = require('../config/env');

/**
 * Check if pet owner joined the video call
 * @param {string} appointmentId - Appointment ID
 * @param {string} petOwnerId - Pet owner ID
 * @returns {Promise<boolean>} True if pet owner joined, false otherwise
 */
const didPetOwnerJoinVideoCall = async (appointmentId, petOwnerId) => {
  const session = await VideoSession.findOne({
    appointmentId: appointmentId,
    petOwnerId: petOwnerId,
    startedAt: { $exists: true, $ne: null }
  });
  
  return !!session;
};

/**
 * Get appointments eligible for reschedule
 * @param {string} petOwnerId - Pet owner ID
 * @returns {Promise<Array>} List of eligible appointments
 */
const getEligibleAppointmentsForReschedule = async (petOwnerId) => {
  const now = new Date();
  
  // Find confirmed appointments that have passed
  const appointments = await Appointment.find({
    petOwnerId: petOwnerId,
    status: 'CONFIRMED',
    bookingType: 'ONLINE', // Only online appointments
    paymentStatus: 'PAID'
  })
  .populate('veterinarianId', 'name email profileImage fullName')
  .populate('petOwnerId', 'name email fullName')
  .populate('petId', 'name species')
  .sort({ appointmentDate: -1, appointmentTime: -1 });
  
  if (appointments.length === 0) {
    return [];
  }
  
  // Filter appointments that have passed (date and time)
  const passedAppointments = appointments.filter(apt => {
    const appointmentDate = new Date(apt.appointmentDate);
    const [hours, minutes] = (apt.appointmentTime || '00:00').split(':').map(Number);
    appointmentDate.setHours(hours, minutes, 0, 0);
    return appointmentDate < now;
  });
  
  if (passedAppointments.length === 0) {
    return [];
  }
  
  // Filter out appointments where pet owner joined video call
  const appointmentIds = passedAppointments.map(apt => apt._id);
  const sessionsWithPetOwner = await VideoSession.find({
    petOwnerId: petOwnerId,
    appointmentId: { $in: appointmentIds },
    startedAt: { $exists: true, $ne: null }
  });
  
  const appointmentsWithVideo = new Set(
    sessionsWithPetOwner.map(session => session.appointmentId.toString())
  );
  
  // Filter out appointments with existing active requests
  const activeRequests = await RescheduleRequest.find({
    appointmentId: { $in: appointmentIds },
    status: { $in: ['PENDING', 'APPROVED'] }
  });
  
  const appointmentsWithRequests = new Set(
    activeRequests.map(req => req.appointmentId.toString())
  );
  
  // Get truly eligible appointments
  const eligibleAppointments = passedAppointments.filter(apt => {
    const aptId = apt._id.toString();
    const hasVideo = appointmentsWithVideo.has(aptId);
    const hasRequest = appointmentsWithRequests.has(aptId);
    return !hasVideo && !hasRequest;
  });
  
  return eligibleAppointments;
};

/**
 * Create reschedule request
 * @param {Object} data - Reschedule request data
 * @returns {Promise<Object>} Created reschedule request
 */
const createRescheduleRequest = async (data) => {
  const { appointmentId, petOwnerId, reason } = data;
  const requestedDate = data?.preferredDate || data?.requestedDate;
  const requestedTime = data?.preferredTime || data?.requestedTime;
  
  // Get appointment
  const appointment = await Appointment.findById(appointmentId)
    .populate('veterinarianId', 'name email fullName')
    .populate('petOwnerId', 'name email fullName')
    .populate('petId', 'name species');
  
  if (!appointment) {
    throw new Error('Appointment not found');
  }
  
  // Verify pet owner ownership
  const petOwnerIdStr = appointment.petOwnerId._id ? appointment.petOwnerId._id.toString() : appointment.petOwnerId.toString();
  if (petOwnerIdStr !== petOwnerId) {
    throw new Error('Unauthorized: This appointment does not belong to you');
  }
  
  // Check eligibility
  if (appointment.status !== 'CONFIRMED') {
    throw new Error('Only confirmed appointments can be rescheduled');
  }
  
  if (appointment.paymentStatus !== 'PAID') {
    throw new Error('Only paid appointments can be rescheduled');
  }
  
  if (appointment.bookingType !== 'ONLINE') {
    throw new Error('Only online appointments can be rescheduled');
  }
  
  // Check if appointment time has passed
  const appointmentDate = new Date(appointment.appointmentDate);
  const [hours, minutes] = (appointment.appointmentTime || '00:00').split(':').map(Number);
  appointmentDate.setHours(hours, minutes, 0, 0);
  
  if (appointmentDate > new Date()) {
    throw new Error('Cannot reschedule appointment that has not yet occurred');
  }
  
  // Check if pet owner joined video call
  const petOwnerJoined = await didPetOwnerJoinVideoCall(appointmentId, petOwnerId);
  if (petOwnerJoined) {
    throw new Error('Cannot reschedule: You already joined the video call');
  }
  
  // Check for existing active request
  const existingRequest = await RescheduleRequest.findOne({
    appointmentId: appointmentId,
    status: { $in: ['PENDING', 'APPROVED'] }
  });
  
  if (existingRequest) {
    throw new Error('A reschedule request already exists for this appointment');
  }
  
  // Get original appointment fee
  const originalTransaction = await Transaction.findOne({
    relatedAppointmentId: appointmentId,
    status: 'SUCCESS'
  }).sort({ createdAt: -1 });
  
  if (!originalTransaction) {
    throw new Error('Original payment transaction not found');
  }
  
  // Calculate expiration date (default 7 days from now)
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + (config.RESCHEDULE_REQUEST_DEADLINE_DAYS || 7));
  
  // Create reschedule request
  const rescheduleRequest = await RescheduleRequest.create({
    appointmentId: appointmentId,
    originalAppointmentId: appointmentId,
    petOwnerId: petOwnerId,
    veterinarianId: appointment.veterinarianId._id || appointment.veterinarianId,
    preferredDate: requestedDate ? new Date(requestedDate) : null,
    preferredTime: requestedTime || null,
    reason: reason ? reason.trim() : null,
    status: 'PENDING',
    originalAppointmentFee: originalTransaction.amount
  });
  
  // Send notification to veterinarian
  const veterinarianId = appointment.veterinarianId._id ? appointment.veterinarianId._id.toString() : appointment.veterinarianId.toString();
  const petName = appointment.petId?.name || 'pet';
  await notificationService.createNotification({
    userId: veterinarianId,
    title: 'New Reschedule Request',
    body: `${appointment.petOwnerId.name || appointment.petOwnerId.fullName} has requested to reschedule appointment for ${petName} scheduled for ${new Date(appointment.appointmentDate).toLocaleDateString()} at ${appointment.appointmentTime}`,
    type: 'RESCHEDULE_REQUEST',
    data: {
      rescheduleRequestId: rescheduleRequest._id.toString(),
      appointmentId: appointmentId
    }
  });
  
  return rescheduleRequest;
};

/**
 * Approve reschedule request
 * @param {string} requestId - Reschedule request ID
 * @param {string} veterinarianId - Veterinarian ID
 * @param {Object} approvalData - Approval data
 * @returns {Promise<Object>} Updated request and new appointment
 */
const approveRescheduleRequest = async (requestId, veterinarianId, approvalData) => {
  const requestedDate =
    approvalData?.requestedDate ||
    approvalData?.newAppointmentDate ||
    approvalData?.newAppointmentDateTime ||
    approvalData?.newDate;
  const requestedTime =
    approvalData?.requestedTime ||
    approvalData?.newAppointmentTime ||
    approvalData?.newTime;
  const { rescheduleFee, rescheduleFeePercentage, veterinarianNotes } = approvalData || {};
  
  // Get reschedule request
  const request = await RescheduleRequest.findById(requestId)
    .populate('appointmentId')
    .populate('veterinarianId', 'name email fullName')
    .populate('petOwnerId', 'name email fullName');
  
  if (!request) {
    throw new Error('Reschedule request not found');
  }
  
  // Verify veterinarian ownership
  const veterinarianIdStr = request.veterinarianId._id ? request.veterinarianId._id.toString() : request.veterinarianId.toString();
  if (veterinarianIdStr !== veterinarianId) {
    throw new Error('Unauthorized: This request does not belong to you');
  }
  
  if (request.status !== 'PENDING') {
    throw new Error(`Cannot approve request with status: ${request.status}`);
  }
  
  // Use requested date/time or provided date/time
  const newAppointmentDate = requestedDate || request.preferredDate;
  const newAppointmentTime = requestedTime || request.preferredTime;
  
  if (!newAppointmentDate || !newAppointmentTime) {
    throw new Error('New appointment date and time are required');
  }
  
  // Validate new date/time is in the future
  const newDateTime = new Date(newAppointmentDate);
  const [hours, minutes] = newAppointmentTime.split(':').map(Number);
  newDateTime.setHours(hours, minutes, 0, 0);
  
  if (newDateTime <= new Date()) {
    throw new Error('New appointment date/time must be in the future');
  }
  
  // Get original appointment fee
  const originalTransaction = await Transaction.findOne({
    relatedAppointmentId: request.appointmentId._id || request.appointmentId,
    status: 'SUCCESS'
  }).sort({ createdAt: -1 });
  
  if (!originalTransaction) {
    throw new Error('Original payment transaction not found');
  }
  
  const originalFee = originalTransaction.amount;
  
  // An explicit zero is a fee waiver. It must not be turned into the configured
  // minimum fee, otherwise the pet owner is incorrectly sent to payment.
  const hasPercentageFee = rescheduleFeePercentage !== undefined
    && rescheduleFeePercentage !== null
    && rescheduleFeePercentage !== '';
  const hasFixedFee = rescheduleFee !== undefined
    && rescheduleFee !== null
    && rescheduleFee !== '';
  let calculatedFee;
  let explicitlyWaived = false;

  if (hasPercentageFee) {
    const percentage = Number(rescheduleFeePercentage);
    if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100) {
      throw new Error('Reschedule fee percentage must be between 0 and 100');
    }
    explicitlyWaived = percentage === 0;
    calculatedFee = (originalFee * percentage) / 100;
  } else if (hasFixedFee) {
    const fixedFee = Number(rescheduleFee);
    if (!Number.isFinite(fixedFee) || fixedFee < 0) {
      throw new Error('Reschedule fee cannot be negative');
    }
    explicitlyWaived = fixedFee === 0;
    calculatedFee = fixedFee;
  } else {
    const defaultFeePercent = Number(config.RESCHEDULE_DEFAULT_FEE_PERCENTAGE || 50);
    calculatedFee = (originalFee * defaultFeePercent) / 100;
  }

  if (!explicitlyWaived) {
    const minimumFee = Number(config.RESCHEDULE_MIN_FEE || 5);
    calculatedFee = Math.max(calculatedFee, Number.isFinite(minimumFee) ? minimumFee : 5);
  }

  calculatedFee = Math.min(calculatedFee, originalFee);
  calculatedFee = Number(calculatedFee.toFixed(2));
  const requiresReschedulePayment = calculatedFee > 0;
  
  // Get original appointment
  const originalAppointment = request.appointmentId;
  
  // Check for double-booking
  const appointmentDateStart = new Date(newAppointmentDate);
  appointmentDateStart.setHours(0, 0, 0, 0);
  const appointmentDateEnd = new Date(newAppointmentDate);
  appointmentDateEnd.setHours(23, 59, 59, 999);
  
  const existingAppointment = await Appointment.findOne({
    veterinarianId: originalAppointment.veterinarianId._id || originalAppointment.veterinarianId,
    appointmentDate: {
      $gte: appointmentDateStart,
      $lt: appointmentDateEnd
    },
    appointmentTime: newAppointmentTime,
    status: { $in: ['PENDING', 'CONFIRMED', 'PENDING_PAYMENT'] }
  });
  
  if (existingAppointment) {
    throw new Error('Veterinarian is already booked at the selected time');
  }
  
  // Create new appointment
  const newAppointment = await appointmentService.createAppointment({
    veterinarianId: originalAppointment.veterinarianId._id || originalAppointment.veterinarianId,
    petOwnerId: originalAppointment.petOwnerId._id || originalAppointment.petOwnerId,
    petId: originalAppointment.petId._id || originalAppointment.petId,
    appointmentDate: newAppointmentDate,
    appointmentTime: newAppointmentTime,
    appointmentDuration: originalAppointment.appointmentDuration,
    bookingType: 'ONLINE',
    reason: `Rescheduled from appointment ${originalAppointment.appointmentNumber || 'N/A'}. Original appointment: ${new Date(originalAppointment.appointmentDate).toLocaleDateString()} at ${originalAppointment.appointmentTime}`,
    timezone: originalAppointment.timezone,
    timezoneOffset: originalAppointment.timezoneOffset
  });

  const newAppointmentDoc = await Appointment.findById(newAppointment?._id || newAppointment?.id || newAppointment);
  if (newAppointmentDoc) {
    const originalConsultationFee = originalAppointment.consultationFee !== null && originalAppointment.consultationFee !== undefined && originalAppointment.consultationFee !== ''
      ? Number(originalAppointment.consultationFee)
      : NaN;
    newAppointmentDoc.status = requiresReschedulePayment ? 'PENDING_PAYMENT' : 'CONFIRMED';
    newAppointmentDoc.paymentStatus = requiresReschedulePayment ? 'UNPAID' : 'PAID';
    newAppointmentDoc.consultationFee = Number.isFinite(originalConsultationFee) && originalConsultationFee >= 0
      ? originalConsultationFee
      : originalFee;
    newAppointmentDoc.isRescheduled = true;
    newAppointmentDoc.originalAppointmentId = originalAppointment._id;
    newAppointmentDoc.rescheduleFee = calculatedFee;
    newAppointmentDoc.rescheduleRequestId = request._id;
    await newAppointmentDoc.save();
  }
  
  // Update original appointment
  originalAppointment.status = 'RESCHEDULED';
  originalAppointment.rescheduleRequestId = request._id;
  await originalAppointment.save();
  
  // Update reschedule request
  request.status = 'APPROVED';
  request.newAppointmentId = newAppointmentDoc?._id || newAppointment?._id || null;
  request.rescheduleFee = calculatedFee;
  if (rescheduleFeePercentage !== undefined && rescheduleFeePercentage !== null) {
    request.rescheduleFeePercentage = rescheduleFeePercentage;
  }
  if (veterinarianNotes !== undefined) {
    request.veterinarianNotes = veterinarianNotes || null;
  }
  request.respondedAt = new Date();
  await request.save();
  
  const finalAppointment = newAppointmentDoc || newAppointment;

  // Send notification to pet owner
  const petOwnerId = request.petOwnerId._id ? request.petOwnerId._id.toString() : request.petOwnerId.toString();
  await notificationService.createNotification({
    userId: petOwnerId,
    title: 'Reschedule Request Approved',
    body: requiresReschedulePayment
      ? `Your reschedule request has been approved. Please pay $${calculatedFee.toFixed(2)} to confirm your new appointment on ${new Date(newAppointmentDate).toLocaleDateString()} at ${newAppointmentTime}`
      : `Your reschedule request has been approved. Your new appointment is confirmed for ${new Date(newAppointmentDate).toLocaleDateString()} at ${newAppointmentTime}. No additional payment is required.`,
    type: 'RESCHEDULE_APPROVED',
    data: {
      rescheduleRequestId: request._id.toString(),
      newAppointmentId: finalAppointment._id.toString()
    }
  });
  
  return {
    rescheduleRequest: request,
    newAppointment: finalAppointment
  };
};

/**
 * Reject reschedule request
 * @param {string} requestId - Reschedule request ID
 * @param {string} veterinarianId - Veterinarian ID
 * @param {string} rejectionReason - Rejection reason
 * @returns {Promise<Object>} Updated request
 */
const rejectRescheduleRequest = async (requestId, veterinarianId, rejectionReason) => {
  const request = await RescheduleRequest.findById(requestId)
    .populate('appointmentId')
    .populate('veterinarianId', 'name email fullName')
    .populate('petOwnerId', 'name email fullName');
  
  if (!request) {
    throw new Error('Reschedule request not found');
  }
  
  // Verify veterinarian ownership
  const veterinarianIdStr = request.veterinarianId._id ? request.veterinarianId._id.toString() : request.veterinarianId.toString();
  if (veterinarianIdStr !== veterinarianId) {
    throw new Error('Unauthorized: This request does not belong to you');
  }
  
  if (request.status !== 'PENDING') {
    throw new Error(`Cannot reject request with status: ${request.status}`);
  }
  
  // Update request
  request.status = 'REJECTED';
  request.rejectionReason = rejectionReason ? rejectionReason.trim() : null;
  request.respondedAt = new Date();
  await request.save();
  
  // Send notification to pet owner
  const petOwnerId = request.petOwnerId._id ? request.petOwnerId._id.toString() : request.petOwnerId.toString();
  await notificationService.createNotification({
    userId: petOwnerId,
    title: 'Reschedule Request Rejected',
    body: `Your reschedule request has been rejected. Reason: ${rejectionReason || 'No reason provided'}`,
    type: 'RESCHEDULE_REJECTED',
    data: {
      rescheduleRequestId: request._id.toString(),
      appointmentId: request.appointmentId._id.toString()
    }
  });
  
  return request;
};

/**
 * Process reschedule fee payment
 * @param {string} requestId - Reschedule request ID
 * @param {string} petOwnerId - Pet owner ID
 * @param {string} paymentMethod - Payment method
 * @returns {Promise<Object>} Transaction and updated appointment
 */
const processReschedulePayment = async (requestId, petOwnerId, paymentMethod = 'STRIPE') => {
  const request = await RescheduleRequest.findById(requestId)
    .populate('appointmentId')
    .populate('petOwnerId', 'name email fullName');
  
  if (!request) {
    throw new Error('Reschedule request not found');
  }
  
  // Verify pet owner ownership
  const petOwnerIdStr = request.petOwnerId._id ? request.petOwnerId._id.toString() : request.petOwnerId.toString();
  if (petOwnerIdStr !== petOwnerId) {
    throw new Error('Unauthorized: This request does not belong to you');
  }
  
  if (request.status !== 'APPROVED') {
    throw new Error(`Cannot pay for request with status: ${request.status}`);
  }
  
  // Get the new appointment created during approval
  const newAppointment = await Appointment.findById(request.newAppointmentId);
  
  if (!newAppointment) {
    throw new Error('New appointment not found. Please contact support.');
  }
  
  if (newAppointment.paymentStatus === 'PAID') {
    throw new Error('Reschedule fee has already been paid');
  }
  
  // Process payment
  const transaction = await paymentService.processAppointmentPayment(
    petOwnerId,
    newAppointment._id.toString(),
    request.rescheduleFee,
    paymentMethod
  );
  
  // Update reschedule request
  request.paymentTransactionId = transaction._id;
  await request.save();
  
  // Update new appointment
  newAppointment.status = 'CONFIRMED';
  newAppointment.paymentStatus = 'PAID';
  await newAppointment.save();
  
  // Send notifications
  await notificationService.createNotification({
    userId: petOwnerId,
    title: 'Reschedule Payment Successful',
    body: `Your reschedule fee has been paid. Your new appointment is confirmed for ${new Date(newAppointment.appointmentDate).toLocaleDateString()} at ${newAppointment.appointmentTime}`,
    type: 'APPOINTMENT',
    data: {
      appointmentId: newAppointment._id.toString()
    }
  });
  
  // Notify veterinarian
  const veterinarianId = newAppointment.veterinarianId._id ? newAppointment.veterinarianId.toString() : newAppointment.veterinarianId.toString();
  await notificationService.createNotification({
    userId: veterinarianId,
    title: 'Rescheduled Appointment Confirmed',
    body: `Pet owner has paid the reschedule fee. New appointment confirmed for ${new Date(newAppointment.appointmentDate).toLocaleDateString()} at ${newAppointment.appointmentTime}`,
    type: 'APPOINTMENT',
    data: {
      appointmentId: newAppointment._id.toString()
    }
  });
  
  return {
    transaction: transaction,
    appointment: newAppointment
  };
};

/**
 * List reschedule requests (filtered by role)
 * @param {string} userId - User ID
 * @param {string} userRole - User role
 * @param {Object} filters - Filter criteria
 * @returns {Promise<Array>} List of reschedule requests
 */
const listRescheduleRequests = async (userId, userRole, filters = {}) => {
  const query = {};
  
  if (userRole === 'PET_OWNER') {
    query.petOwnerId = userId;
  } else if (userRole === 'VETERINARIAN') {
    query.veterinarianId = userId;
  }
  // Admin can see all (no filter)
  
  if (filters.status) {
    query.status = filters.status.toUpperCase();
  }
  
  const requests = await RescheduleRequest.find(query)
    .populate('appointmentId', 'appointmentDate appointmentTime appointmentNumber status bookingType paymentStatus')
    .populate('newAppointmentId', 'appointmentDate appointmentTime appointmentNumber status bookingType paymentStatus')
    .populate('petOwnerId', 'name email profileImage fullName')
    .populate('veterinarianId', 'name email profileImage fullName')
    .sort({ createdAt: -1 });
  
  return requests;
};

/**
 * Get reschedule request by ID
 * @param {string} requestId - Reschedule request ID
 * @param {string} userId - User ID
 * @param {string} userRole - User role
 * @returns {Promise<Object>} Reschedule request
 */
const getRescheduleRequestById = async (requestId, userId, userRole) => {
  const request = await RescheduleRequest.findById(requestId)
    .populate('appointmentId')
    .populate('newAppointmentId')
    .populate('petOwnerId', 'name email profileImage fullName')
    .populate('veterinarianId', 'name email profileImage fullName')
    ;
  
  if (!request) {
    throw new Error('Reschedule request not found');
  }
  
  // Verify access
  if (userRole === 'PET_OWNER') {
    const petOwnerId = request.petOwnerId._id ? request.petOwnerId._id.toString() : request.petOwnerId.toString();
    if (petOwnerId !== userId) {
      throw new Error('Unauthorized');
    }
  } else if (userRole === 'VETERINARIAN') {
    const veterinarianId = request.veterinarianId._id ? request.veterinarianId._id.toString() : request.veterinarianId.toString();
    if (veterinarianId !== userId) {
      throw new Error('Unauthorized');
    }
  }
  // Admin can access any request
  
  return request;
};

module.exports = {
  createRescheduleRequest,
  approveRescheduleRequest,
  rejectRescheduleRequest,
  processReschedulePayment,
  listRescheduleRequests,
  getRescheduleRequestById,
  getEligibleAppointmentsForReschedule,
  didPetOwnerJoinVideoCall
};
