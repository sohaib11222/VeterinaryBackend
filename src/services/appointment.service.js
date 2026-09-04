const Appointment = require('../models/Appointment');
const User = require('../models/User');
const Pet = require('../models/Pet');
const VeterinarianProfile = require('../models/VeterinarianProfile');
const VeterinarianSubscription = require('../models/VeterinarianSubscription');
const Transaction = require('../models/Transaction');
const Notification = require('../models/Notification');
const WeeklySchedule = require('../models/WeeklySchedule');
const vaccinationService = require('./vaccination.service');
const weightRecordService = require('./weightRecord.service');
const subscriptionPolicy = require('./subscriptionPolicy.service');
const {
  sendAppointmentBookedEmail,
  sendAppointmentStatusEmail,
} = require('./email.service');
const {
  getAppointmentDateParts,
  getTimeZoneOffsetMinutes,
  isIanaTimeZone,
} = require('../utils/appointmentTime');

const logEmailFailure = (event, error) => {
  console.error(`[email] Failed to send ${event} email:`, error?.message || error);
};

/**
 * Create appointment
 */
const createAppointment = async (data) => {
  const {
    veterinarianId,
    petOwnerId,
    petId,
    appointmentDate,
    appointmentTime,
    appointmentDuration,
    bookingType,
    reason,
    petSymptoms,
    clinicName,
    createdBy,
    timezone,
    timezoneOffset,
    isEmergency,
    emergencyPriority,
    emergencyDescription
  } = data;

  // Verify veterinarian exists
  const veterinarian = await User.findById(veterinarianId)
    .select('name email role status')
    .lean()
    .maxTimeMS(2000);
  if (!veterinarian || veterinarian.role !== 'VETERINARIAN') {
    throw new Error('Veterinarian not found');
  }

  // Verify veterinarian is approved
  if (veterinarian.status !== 'APPROVED') {
    throw new Error('Veterinarian account is not approved');
  }

  // Check if veterinarian has active subscription
  const subscription = await VeterinarianSubscription.findOne({
    veterinarianId,
    isActive: true,
    endDate: { $gt: new Date() }
  });
  if (!subscription) {
    throw new Error('Veterinarian does not have an active subscription');
  }

  await subscriptionPolicy.enforceAppointmentBookingLimit({ veterinarianId, bookingType });

  // Keep the fee shown on appointment details tied to the booked appointment,
  // rather than a later change to the veterinarian's profile pricing.
  const veterinarianProfile = await VeterinarianProfile.findOne({ userId: veterinarianId })
    .select('consultationFees')
    .lean()
    .maxTimeMS(2000);
  const configuredFee = bookingType === 'ONLINE'
    ? veterinarianProfile?.consultationFees?.online
    : veterinarianProfile?.consultationFees?.clinic;
  const hasConfiguredFee = configuredFee !== null && configuredFee !== undefined && configuredFee !== '';
  const parsedConsultationFee = hasConfiguredFee ? Number(configuredFee) : NaN;
  const consultationFee = Number.isFinite(parsedConsultationFee) && parsedConsultationFee >= 0
    ? parsedConsultationFee
    : null;

  // Verify pet owner exists
  const petOwner = await User.findById(petOwnerId);
  if (!petOwner || petOwner.role !== 'PET_OWNER') {
    throw new Error('Pet owner not found');
  }

  // Verify pet exists and belongs to pet owner
  const pet = await Pet.findOne({ _id: petId, ownerId: petOwnerId, isActive: true });
  if (!pet) {
    throw new Error('Pet not found or does not belong to you');
  }

  // Store and query the calendar date as UTC midnight. The appointment clock
  // is interpreted separately using the appointment's timezone when the chat
  // or video session is opened, so server-local timezone never changes its day.
  const dateParts = getAppointmentDateParts(appointmentDate);
  const localMidnightDate = new Date(Date.UTC(dateParts.year, dateParts.month - 1, dateParts.day, 0, 0, 0, 0));
  const nextMidnightDate = new Date(Date.UTC(dateParts.year, dateParts.month - 1, dateParts.day + 1, 0, 0, 0, 0));

  // Check for double-booking
  const existingAppointment = await Appointment.findOne({
    veterinarianId,
    appointmentDate: {
      $gte: localMidnightDate,
      $lt: nextMidnightDate
    },
    appointmentTime,
    status: { $in: ['PENDING', 'CONFIRMED'] }
  });

  if (existingAppointment) {
    throw new Error('Veterinarian is already booked at this time');
  }

  // Get appointment duration from weekly schedule or use provided/default
  let duration = appointmentDuration || 30;
  if (!appointmentDuration) {
    const weeklySchedule = await WeeklySchedule.findOne({ veterinarianId });
    if (weeklySchedule && weeklySchedule.appointmentDuration) {
      duration = weeklySchedule.appointmentDuration;
    }
  }

  // Calculate the local end-clock value without relying on the Node process
  // timezone. This also supports slots that cross midnight.
  const [hours, minutes] = appointmentTime.split(':').map(Number);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) {
    throw new Error('Invalid appointment time');
  }
  const appointmentStartDateTime = new Date(Date.UTC(dateParts.year, dateParts.month - 1, dateParts.day, hours, minutes, 0, 0));
  const appointmentEndDateTime = new Date(appointmentStartDateTime.getTime() + duration * 60 * 1000);
  const appointmentEndTime = `${appointmentEndDateTime.getUTCHours().toString().padStart(2, '0')}:${appointmentEndDateTime.getUTCMinutes().toString().padStart(2, '0')}`;

  // Generate video call link if online booking
  let videoCallLink = null;
  if (bookingType === 'ONLINE') {
    const appointmentNumber = `APT-${Date.now()}`;
    videoCallLink = `https://videocall.veterinary.com/${appointmentNumber}`;
  }

  // Preserve the IANA zone for DST-aware video/chat eligibility. The numeric
  // offset is retained as a legacy fallback and uses positive minutes east of
  // UTC, matching the booking UI's `-Date#getTimezoneOffset()` value.
  const normalizedTimezone = isIanaTimeZone(timezone) ? timezone : 'Europe/Rome';
  const requestedOffset = Number(timezoneOffset);
  const scheduledNoon = new Date(Date.UTC(dateParts.year, dateParts.month - 1, dateParts.day, 12, 0, 0, 0));
  const fallbackOffset = getTimeZoneOffsetMinutes(scheduledNoon, normalizedTimezone);
  const tzOffset = Number.isFinite(requestedOffset)
    ? requestedOffset
    : Number.isFinite(fallbackOffset)
      ? fallbackOffset
      : 0;

  // Create appointment
  const appointment = await Appointment.create({
    veterinarianId,
    petOwnerId,
    petId,
    appointmentDate: localMidnightDate,
    appointmentTime,
    appointmentDuration: duration,
    appointmentEndTime,
    consultationFee,
    timezone: normalizedTimezone,
    timezoneOffset: tzOffset,
    bookingType: bookingType || 'VISIT',
    reason,
    petSymptoms,
    clinicName,
    videoCallLink,
    createdBy: createdBy || petOwnerId,
    status: 'PENDING',
    paymentStatus: 'UNPAID',
    isEmergency: isEmergency || false,
    emergencyPriority: emergencyPriority || null,
    emergencyDescription: emergencyDescription || null
  });

  // Create notifications
  await Promise.all([
    Notification.create({
      userId: veterinarianId,
      title: 'New Appointment Request',
      body: `${petOwner.name} has requested an appointment for ${pet.name} on ${new Date(appointmentDate).toLocaleDateString()} at ${appointmentTime}`,
      type: 'APPOINTMENT',
      data: { appointmentId: appointment._id, petId: pet._id }
    }),
    Notification.create({
      userId: petOwnerId,
      title: 'Appointment Requested',
      body: `Your appointment request for ${pet.name} with ${veterinarian.name} is pending confirmation`,
      type: 'APPOINTMENT',
      data: { appointmentId: appointment._id, petId: pet._id }
    })
  ]);

  // Email delivery must never undo a successful booking. The in-app
  // notification remains available if an SMTP provider has a temporary issue.
  if (veterinarian.email) {
    await sendAppointmentBookedEmail({
      veterinarian,
      petOwner,
      pet,
      appointment,
    }).catch((error) => logEmailFailure('new appointment', error));
  }

  const createdAppointment = await Appointment.findById(appointment._id)
    .select('veterinarianId petOwnerId petId appointmentDate appointmentTime consultationFee appointmentNumber bookingType reason status')
    .lean()
    .maxTimeMS(2000);

  // Populate separately
  const [vet, owner, populatedPet] = await Promise.all([
    User.findById(createdAppointment.veterinarianId)
      .select('name email phone profileImage')
      .lean()
      .maxTimeMS(1000),
    User.findById(createdAppointment.petOwnerId)
      .select('name email phone')
      .lean()
      .maxTimeMS(1000),
    Pet.findById(createdAppointment.petId)
      .select('name species breed')
      .lean()
      .maxTimeMS(1000)
  ]);

  return {
    ...createdAppointment,
    veterinarianId: vet,
    petOwnerId: owner,
    petId: populatedPet
  };
};

/**
 * Update appointment status
 */
const updateAppointmentStatus = async (id, statusData) => {
  const appointment = await Appointment.findById(id)
    .select('veterinarianId petOwnerId petId status paymentStatus')
    .lean()
    .maxTimeMS(2000);
  
  if (!appointment) {
    throw new Error('Appointment not found');
  }

  const { status, paymentStatus, paymentMethod, notes } = statusData;

  // Get document for saving
  const appointmentDoc = await Appointment.findById(id);
  const previousStatus = appointmentDoc.status;

  if (status) {
    const validStatuses = ['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED', 'NO_SHOW', 'REJECTED', 'RESCHEDULED', 'PENDING_PAYMENT'];
    if (!validStatuses.includes(status)) {
      throw new Error('Invalid appointment status');
    }
    appointmentDoc.status = status;
  }

  if (paymentStatus) {
    const validPaymentStatuses = ['UNPAID', 'PAID', 'REFUNDED'];
    if (!validPaymentStatuses.includes(paymentStatus)) {
      throw new Error('Invalid payment status');
    }
    appointmentDoc.paymentStatus = paymentStatus;
  }

  if (paymentMethod) {
    appointmentDoc.paymentMethod = paymentMethod;
  }

  if (notes !== undefined) {
    appointmentDoc.notes = notes;
  }

  await appointmentDoc.save();

  // Credit veterinarian balance when appointment is completed
  if (status === 'COMPLETED' && appointmentDoc.paymentStatus === 'PAID' && previousStatus !== 'COMPLETED') {
    try {
      const transaction = await Transaction.findOne({
        relatedAppointmentId: appointment._id,
        status: 'SUCCESS'
      })
        .select('amount')
        .sort({ createdAt: -1 })
        .lean()
        .maxTimeMS(2000);

      if (transaction && transaction.amount > 0) {
        const existingCredit = await Transaction.findOne({
          userId: appointment.veterinarianId?.toString(),
          'metadata.type': 'BALANCE_CREDIT',
          'metadata.appointmentId': appointment._id.toString()
        })
          .lean()
          .maxTimeMS(2000);

        if (!existingCredit) {
          // Credit balance (balance service will be implemented)
          // await balanceService.creditBalance(...)
        }
      }
    } catch (error) {
      console.error('Error crediting veterinarian balance:', error);
    }
  }

  // Get populated data separately for notifications
  const [vet, owner, pet] = await Promise.all([
    appointment.veterinarianId ? User.findById(appointment.veterinarianId)
      .select('name')
      .lean()
      .maxTimeMS(1000) : null,
    appointment.petOwnerId ? User.findById(appointment.petOwnerId)
      .select('name')
      .lean()
      .maxTimeMS(1000) : null,
    appointment.petId ? Pet.findById(appointment.petId)
      .select('name')
      .lean()
      .maxTimeMS(1000) : null
  ]);

  // Create notifications
  if (status === 'CONFIRMED' || status === 'REJECTED') {
    const statusMessage = status === 'CONFIRMED' 
      ? `Your appointment for ${pet?.name || 'your pet'} with ${vet?.name || 'the veterinarian'} has been confirmed`
      : `Your appointment for ${pet?.name || 'your pet'} with ${vet?.name || 'the veterinarian'} has been rejected`;
    
    await Notification.create({
      userId: appointment.petOwnerId?.toString(),
      title: status === 'CONFIRMED' ? 'Appointment Confirmed' : 'Appointment Rejected',
      body: statusMessage,
      type: 'APPOINTMENT',
      data: { appointmentId: appointment._id }
    });
  }

  // Return with populated data
  return {
    ...appointmentDoc.toObject(),
    veterinarianId: vet,
    petOwnerId: owner,
    petId: pet
  };
};

/**
 * Accept appointment (veterinarian action)
 */
const acceptAppointment = async (appointmentId, veterinarianId) => {
  const appointment = await Appointment.findById(appointmentId)
    .select('veterinarianId petOwnerId petId appointmentDate appointmentTime appointmentNumber bookingType reason petSymptoms clinicName status')
    .lean()
    .maxTimeMS(2000);
  
  if (!appointment) {
    throw new Error('Appointment not found');
  }

  if (appointment.veterinarianId?.toString() !== veterinarianId) {
    throw new Error('Unauthorized: This appointment does not belong to you');
  }

  if (appointment.status !== 'PENDING') {
    throw new Error(`Cannot accept appointment with status: ${appointment.status}`);
  }

  // Get document for saving
  const appointmentDoc = await Appointment.findById(appointmentId);
  appointmentDoc.status = 'CONFIRMED';
  await appointmentDoc.save();

  // Get populated data separately
  const [vet, owner, pet] = await Promise.all([
    User.findById(veterinarianId)
      .select('name email')
      .lean()
      .maxTimeMS(1000),
    User.findById(appointment.petOwnerId)
      .select('name email')
      .lean()
      .maxTimeMS(1000),
    Pet.findById(appointment.petId)
      .select('name')
      .lean()
      .maxTimeMS(1000)
  ]);

  await Notification.create({
    userId: appointment.petOwnerId?.toString(),
    title: 'Appointment Confirmed',
    body: `Your appointment for ${pet?.name || 'your pet'} with ${vet?.name || 'the veterinarian'} has been confirmed`,
    type: 'APPOINTMENT',
    data: { appointmentId: appointment._id }
  });

  if (owner?.email) {
    await sendAppointmentStatusEmail({
      petOwner: owner,
      veterinarian: vet,
      pet,
      appointment,
      status: 'CONFIRMED',
    }).catch((error) => logEmailFailure('appointment acceptance', error));
  }

  return {
    ...appointmentDoc.toObject(),
    veterinarianId: vet,
    petOwnerId: owner,
    petId: pet
  };
};

/**
 * Reject appointment (veterinarian action)
 */
const rejectAppointment = async (appointmentId, veterinarianId, reason = null) => {
  const appointment = await Appointment.findById(appointmentId);
  
  if (!appointment) {
    throw new Error('Appointment not found');
  }

  if (appointment.veterinarianId.toString() !== veterinarianId) {
    throw new Error('Unauthorized: This appointment does not belong to you');
  }

  if (appointment.status !== 'PENDING') {
    throw new Error(`Cannot reject appointment with status: ${appointment.status}`);
  }

  appointment.status = 'REJECTED';
  if (reason) {
    appointment.notes = reason;
  }
  await appointment.save();

  // Create notification
  const veterinarian = await User.findById(veterinarianId);
  const petOwner = await User.findById(appointment.petOwnerId);
  const pet = await Pet.findById(appointment.petId);

  await Notification.create({
    userId: appointment.petOwnerId.toString(),
    title: 'Appointment Rejected',
    body: `Your appointment for ${pet.name} with ${veterinarian.name} has been rejected${reason ? ': ' + reason : ''}`,
    type: 'APPOINTMENT',
    data: { appointmentId: appointment._id }
  });

  if (petOwner?.email) {
    await sendAppointmentStatusEmail({
      petOwner,
      veterinarian,
      pet,
      appointment,
      status: 'REJECTED',
      reason,
    }).catch((error) => logEmailFailure('appointment rejection', error));
  }

  return appointment;
};

/**
 * Cancel appointment (pet owner action)
 */
const cancelAppointment = async (appointmentId, petOwnerId, reason = null) => {
  const appointment = await Appointment.findById(appointmentId)
    .select('veterinarianId petOwnerId petId appointmentDate appointmentTime status')
    .lean()
    .maxTimeMS(2000);
  
  if (!appointment) {
    throw new Error('Appointment not found');
  }

  if (appointment.petOwnerId?.toString() !== petOwnerId) {
    throw new Error('Unauthorized: This appointment does not belong to you');
  }

  if (['COMPLETED', 'CANCELLED'].includes(appointment.status)) {
    throw new Error(`Cannot cancel appointment with status: ${appointment.status}`);
  }

  // Check if appointment time has passed
  const appointmentDateTime = new Date(appointment.appointmentDate);
  const [hours, minutes] = appointment.appointmentTime.split(':');
  appointmentDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
  
  if (appointmentDateTime < new Date()) {
    throw new Error('Cannot cancel appointment that has already passed');
  }

  // Get document for saving
  const appointmentDoc = await Appointment.findById(appointmentId);
  appointmentDoc.status = 'CANCELLED';
  if (reason) {
    appointmentDoc.notes = reason;
  }
  await appointmentDoc.save();

  // Get populated data separately
  const [vet, owner, pet] = await Promise.all([
    appointment.veterinarianId ? User.findById(appointment.veterinarianId)
      .select('name')
      .lean()
      .maxTimeMS(1000) : null,
    appointment.petOwnerId ? User.findById(appointment.petOwnerId)
      .select('name')
      .lean()
      .maxTimeMS(1000) : null,
    appointment.petId ? Pet.findById(appointment.petId)
      .select('name')
      .lean()
      .maxTimeMS(1000) : null
  ]);

  // Create notification for veterinarian
  await Notification.create({
    userId: appointment.veterinarianId?.toString(),
    title: 'Appointment Cancelled',
    body: `${owner?.name || 'A pet owner'} has cancelled their appointment for ${pet?.name || 'their pet'}${reason ? ': ' + reason : ''}`,
    type: 'APPOINTMENT',
    data: { appointmentId: appointment._id }
  });

  return {
    ...appointmentDoc.toObject(),
    veterinarianId: vet,
    petOwnerId: owner,
    petId: pet
  };
};

/**
 * Complete appointment (veterinarian action)
 */
const completeAppointment = async (appointmentId, veterinarianId, body = {}) => {
  const appointment = await Appointment.findById(appointmentId)
    .select('veterinarianId petOwnerId petId status')
    .lean()
    .maxTimeMS(2000);
  
  if (!appointment) {
    throw new Error('Appointment not found');
  }

  if (appointment.veterinarianId?.toString() !== veterinarianId) {
    throw new Error('Unauthorized: This appointment does not belong to you');
  }

  if (appointment.status !== 'CONFIRMED') {
    throw new Error(`Cannot complete appointment with status: ${appointment.status}`);
  }

  // Get document for saving
  const appointmentDoc = await Appointment.findById(appointmentId);
  appointmentDoc.status = 'COMPLETED';
  await appointmentDoc.save();

  const weightInput = body?.weightRecord;
  let createdWeightRecord = null;
  if (weightInput && (weightInput.weight || weightInput.value || weightInput.weight?.value)) {
    const w = weightInput.weight || weightInput;
    createdWeightRecord = await weightRecordService.createWeightRecord(veterinarianId, 'VETERINARIAN', {
      petId: appointment.petId?.toString(),
      weight: {
        value: w.value !== undefined ? w.value : w.weight,
        unit: w.unit || 'kg',
      },
      date: weightInput.date || new Date().toISOString(),
      notes: weightInput.notes || null,
      relatedAppointmentId: appointmentId,
    });
  }

  const vaccinationsInput = Array.isArray(body?.vaccinations) ? body.vaccinations : [];
  let vaccinationNotificationText = null;
  let vaccinationNotificationCount = 0;
  if (vaccinationsInput.length > 0) {
    const createdVaccinations = [];
    for (const v of vaccinationsInput) {
      if (!v) continue;
      const created = await vaccinationService.createVaccination(veterinarianId, 'VETERINARIAN', {
        petId: appointment.petId?.toString(),
        vaccineId: v.vaccineId || null,
        vaccinationType: v.vaccinationType || v.type || null,
        vaccinationDate: v.vaccinationDate || new Date().toISOString(),
        nextDueDate: v.nextDueDate || null,
        batchNumber: v.batchNumber || null,
        certificateUrl: v.certificateUrl || null,
        notes: v.notes || null,
        doseNumber: v.doseNumber ?? null,
        relatedAppointmentId: appointmentId,
      });
      createdVaccinations.push(created);
    }

    if (createdVaccinations.length > 0) {
      vaccinationNotificationCount = createdVaccinations.length;
      vaccinationNotificationText = createdVaccinations
        .map((cv) => {
          const type = cv?.vaccinationType || cv?.vaccineId?.name || 'Vaccination';
          const nextDue = cv?.nextDueDate ? new Date(cv.nextDueDate).toLocaleDateString() : null;
          return nextDue ? `${type} (next due ${nextDue})` : type;
        })
        .join(', ');
    }
  }

  // Get populated data separately
  const [vet, owner, pet] = await Promise.all([
    User.findById(veterinarianId)
      .select('name')
      .lean()
      .maxTimeMS(1000),
    User.findById(appointment.petOwnerId)
      .select('name')
      .lean()
      .maxTimeMS(1000),
    Pet.findById(appointment.petId)
      .select('name')
      .lean()
      .maxTimeMS(1000)
  ]);

  if (vaccinationNotificationText && vaccinationNotificationCount > 0) {
    await Notification.create({
      userId: appointment.petOwnerId?.toString(),
      title: 'Vaccination Recorded',
      body: `Vaccination(s) recorded for ${pet?.name || 'your pet'}: ${vaccinationNotificationText}`,
      type: 'VACCINATION',
      data: { appointmentId: appointment._id, petId: appointment.petId, count: vaccinationNotificationCount }
    });
  }

  if (createdWeightRecord?.weight?.value) {
    await Notification.create({
      userId: appointment.petOwnerId?.toString(),
      title: 'Weight Recorded',
      body: `Weight recorded for ${pet?.name || 'your pet'}: ${createdWeightRecord.weight.value}${createdWeightRecord.weight.unit || 'kg'}`,
      type: 'WEIGHT',
      data: { appointmentId: appointment._id, petId: appointment.petId, weightRecordId: createdWeightRecord._id }
    });
  }

  await Notification.create({
    userId: appointment.petOwnerId?.toString(),
    title: 'Appointment Completed',
    body: `Your appointment for ${pet?.name || 'your pet'} with ${vet?.name || 'the veterinarian'} has been completed`,
    type: 'APPOINTMENT',
    data: { appointmentId: appointment._id }
  });

  return {
    ...appointmentDoc.toObject(),
    veterinarianId: vet,
    petOwnerId: owner,
    petId: pet
  };
};

/**
 * List appointments with filtering
 */
const listAppointments = async (filter = {}) => {
  const {
    veterinarianId,
    petOwnerId,
    petId,
    appointmentNumber,
    status,
    paymentStatus,
    fromDate,
    toDate,
    search,
    page = 1,
    limit = 10
  } = filter;

  const query = {};

  if (veterinarianId) {
    query.veterinarianId = veterinarianId;
  }

  if (petOwnerId) {
    query.petOwnerId = petOwnerId;
  }

  if (petId) {
    query.petId = petId;
  }

  if (appointmentNumber) {
    // allow partial match on appointmentNumber
    query.appointmentNumber = { $regex: String(appointmentNumber).trim(), $options: 'i' };
  }

  if (status) {
    query.status = status.toUpperCase();
  }

  if (paymentStatus) {
    query.paymentStatus = String(paymentStatus).toUpperCase();
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

  const searchTerm = String(search || '').trim();
  if (searchTerm) {
    const escapedSearch = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const searchPattern = new RegExp(escapedSearch, 'i');
    const [matchingUsers, matchingPets] = await Promise.all([
      User.find({ $or: [{ name: searchPattern }, { fullName: searchPattern }, { email: searchPattern }] })
        .select('_id')
        .lean()
        .maxTimeMS(1500),
      Pet.find({ $or: [{ name: searchPattern }, { species: searchPattern }, { breed: searchPattern }] })
        .select('_id')
        .lean()
        .maxTimeMS(1500)
    ]);

    const matchingUserIds = matchingUsers.map((user) => user._id);
    const matchingPetIds = matchingPets.map((pet) => pet._id);
    query.$or = [
      { appointmentNumber: searchPattern },
      { status: searchPattern },
      { bookingType: searchPattern },
      { reason: searchPattern },
      ...(matchingUserIds.length ? [{ veterinarianId: { $in: matchingUserIds } }, { petOwnerId: { $in: matchingUserIds } }] : []),
      ...(matchingPetIds.length ? [{ petId: { $in: matchingPetIds } }] : [])
    ];
  }

  const skip = (page - 1) * limit;

  const [appointmentsRaw, total] = await Promise.all([
    Appointment.find(query)
      .select('veterinarianId petOwnerId petId appointmentDate appointmentTime appointmentDuration appointmentEndTime status appointmentNumber bookingType reason paymentStatus paymentMethod consultationFee isRescheduled originalAppointmentId rescheduleRequestId rescheduleFee')
      .skip(skip)
      .limit(limit)
      .sort({ appointmentDate: -1, appointmentTime: -1 })
      .lean()
      .maxTimeMS(3000),
    Appointment.countDocuments(query).maxTimeMS(2000)
  ]);

  // Populate separately for better performance
  const veterinarianIds = [...new Set(appointmentsRaw.map(a => a.veterinarianId?.toString()).filter(Boolean))];
  const petOwnerIds = [...new Set(appointmentsRaw.map(a => a.petOwnerId?.toString()).filter(Boolean))];
  const petIds = [...new Set(appointmentsRaw.map(a => a.petId?.toString()).filter(Boolean))];

  const [veterinarians, petOwners, pets] = await Promise.all([
    veterinarianIds.length > 0 ? User.find({ _id: { $in: veterinarianIds } })
      .select('name email phone profileImage')
      .lean()
      .maxTimeMS(2000) : Promise.resolve([]),
    petOwnerIds.length > 0 ? User.find({ _id: { $in: petOwnerIds } })
      .select('name email phone profileImage')
      .lean()
      .maxTimeMS(2000) : Promise.resolve([]),
    petIds.length > 0 ? Pet.find({ _id: { $in: petIds } })
      .select('name species breed photo gender age dateOfBirth weight')
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
  const appointments = appointmentsRaw.map(apt => ({
    ...apt,
    veterinarianId: apt.veterinarianId ? veterinarianMap[apt.veterinarianId.toString()] : null,
    petOwnerId: apt.petOwnerId ? petOwnerMap[apt.petOwnerId.toString()] : null,
    petId: apt.petId ? petMap[apt.petId.toString()] : null
  }));

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
 * Get appointment by ID
 */
const getAppointment = async (id, userId, userRole) => {
  const appointment = await Appointment.findById(id)
    .select('veterinarianId petOwnerId petId videoSessionId originalAppointmentId appointmentDate appointmentTime appointmentDuration appointmentEndTime timezone timezoneOffset consultationFee status appointmentNumber bookingType reason petSymptoms notes paymentStatus paymentMethod isRescheduled rescheduleRequestId rescheduleFee')
    .lean()
    .maxTimeMS(2000);
  
  if (!appointment) {
    throw new Error('Appointment not found');
  }

  // Check authorization first (before populate)
  if (userRole === 'VETERINARIAN' && appointment.veterinarianId?.toString() !== userId) {
    throw new Error('Unauthorized: This appointment does not belong to you');
  }

  if (userRole === 'PET_OWNER' && appointment.petOwnerId?.toString() !== userId) {
    throw new Error('Unauthorized: This appointment does not belong to you');
  }

  // Populate separately
  const [veterinarian, petOwner, pet, videoSession, veterinarianProfile, paymentTransaction] = await Promise.all([
    appointment.veterinarianId ? User.findById(appointment.veterinarianId)
      .select('name email phone profileImage')
      .lean()
      .maxTimeMS(1000) : null,
    appointment.petOwnerId ? User.findById(appointment.petOwnerId)
      .select('name email phone profileImage')
      .lean()
      .maxTimeMS(1000) : null,
    appointment.petId ? Pet.findById(appointment.petId)
      .select('name species breed photo weight')
      .lean()
      .maxTimeMS(1000) : null,
    appointment.videoSessionId ? require('../models/VideoSession').findById(appointment.videoSessionId)
      .lean()
      .maxTimeMS(1000) : null,
    appointment.veterinarianId ? VeterinarianProfile.findOne({ userId: appointment.veterinarianId })
      .select('consultationFees')
      .lean()
      .maxTimeMS(1000) : null,
    Transaction.findOne({
      relatedAppointmentId: appointment.originalAppointmentId || appointment._id,
      status: 'SUCCESS'
    })
      .select('amount')
      .sort({ createdAt: -1 })
      .lean()
      .maxTimeMS(1000)
  ]);

  const storedFee = appointment.consultationFee !== null && appointment.consultationFee !== undefined && appointment.consultationFee !== ''
    ? Number(appointment.consultationFee)
    : NaN;
  const transactionFee = Number(paymentTransaction?.amount);
  const configuredProfileFee = appointment.bookingType === 'ONLINE'
    ? veterinarianProfile?.consultationFees?.online
    : veterinarianProfile?.consultationFees?.clinic;
  const profileFee = configuredProfileFee !== null && configuredProfileFee !== undefined && configuredProfileFee !== ''
    ? Number(configuredProfileFee)
    : NaN;
  const consultationFee = Number.isFinite(storedFee) && storedFee >= 0
    ? storedFee
    : Number.isFinite(transactionFee) && transactionFee >= 0
      ? transactionFee
      : Number.isFinite(profileFee) && profileFee >= 0
        ? profileFee
        : null;

  return {
    ...appointment,
    consultationFee,
    veterinarianId: veterinarian,
    petOwnerId: petOwner,
    petId: pet,
    videoSessionId: videoSession
  };
};

module.exports = {
  createAppointment,
  updateAppointmentStatus,
  listAppointments,
  getAppointment,
  acceptAppointment,
  rejectAppointment,
  cancelAppointment,
  completeAppointment
};
