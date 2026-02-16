const Prescription = require('../models/Prescription');
const Appointment = require('../models/Appointment');
const notificationService = require('./notification.service');
const { validateObjectId } = require('../utils/validation');

const assertAppointmentAccess = async ({ appointmentId, userId, role }) => {
  const normalizedRole = (role || '').toString().toUpperCase();

  if (!['VETERINARIAN', 'PET_OWNER'].includes(normalizedRole)) {
    const error = new Error('Insufficient permissions');
    error.statusCode = 403;
    throw error;
  }

  validateObjectId(appointmentId, 'Appointment ID');

  const appointment = await Appointment.findById(appointmentId)
    .populate('veterinarianId', 'fullName name email phone profileImage')
    .populate('petOwnerId', 'fullName name email phone profileImage address')
    .populate('petId', 'name species breed gender age dateOfBirth weight photo')
    .lean()
    .maxTimeMS(4000);

  if (!appointment) {
    const error = new Error('Appointment not found');
    error.statusCode = 404;
    throw error;
  }

  if (normalizedRole === 'VETERINARIAN' && appointment.veterinarianId?._id?.toString() !== userId.toString()) {
    const error = new Error('Unauthorized: This appointment does not belong to you');
    error.statusCode = 403;
    throw error;
  }

  if (normalizedRole === 'PET_OWNER' && appointment.petOwnerId?._id?.toString() !== userId.toString()) {
    const error = new Error('Unauthorized: This appointment does not belong to you');
    error.statusCode = 403;
    throw error;
  }

  return appointment;
};

const upsertPrescriptionForAppointment = async (veterinarianId, appointmentId, data) => {
  validateObjectId(veterinarianId, 'Veterinarian ID');

  const appointment = await assertAppointmentAccess({ appointmentId, userId: veterinarianId, role: 'VETERINARIAN' });

  if (String(appointment.status || '').toUpperCase() !== 'COMPLETED') {
    const error = new Error('Prescription can only be created after the appointment is completed');
    error.statusCode = 403;
    throw error;
  }

  const existing = await Prescription.findOne({ appointmentId }).maxTimeMS(2000);

  const nextStatus = data?.status || 'ISSUED';

  if (!existing) {
    const created = await Prescription.create({
      appointmentId,
      veterinarianId,
      petOwnerId: appointment.petOwnerId._id,
      petId: appointment.petId._id,
      issuedAt: new Date(),
      diagnosis: data?.diagnosis ?? null,
      clinicalNotes: data?.clinicalNotes ?? null,
      allergies: data?.allergies ?? null,
      medications: Array.isArray(data?.medications) ? data.medications : [],
      tests: Array.isArray(data?.tests) ? data.tests : [],
      advice: data?.advice ?? null,
      followUp: data?.followUp ?? null,
      status: nextStatus
    });

    if (created.status === 'ISSUED') {
      const appointmentNumber = appointment.appointmentNumber || '';
      await notificationService.createNotification({
        userId: appointment.petOwnerId._id.toString(),
        title: 'New Prescription',
        body: `A prescription has been issued for your appointment ${appointmentNumber}`.trim(),
        type: 'PRESCRIPTION',
        data: { prescriptionId: created._id.toString(), appointmentId: appointment._id.toString() }
      });
    }

    return Prescription.findById(created._id)
      .populate('veterinarianId', 'fullName name email phone profileImage')
      .populate('petOwnerId', 'fullName name email phone profileImage address')
      .populate('petId', 'name species breed gender age dateOfBirth weight photo')
      .populate('appointmentId');
  }

  const previousStatus = existing.status;

  existing.diagnosis = data?.diagnosis ?? existing.diagnosis;
  existing.clinicalNotes = data?.clinicalNotes ?? existing.clinicalNotes;
  existing.allergies = data?.allergies ?? existing.allergies;
  if (Array.isArray(data?.medications)) {
    existing.medications = data.medications;
  }
  if (Array.isArray(data?.tests)) {
    existing.tests = data.tests;
  }
  existing.advice = data?.advice ?? existing.advice;
  existing.followUp = data?.followUp ?? existing.followUp;

  if (data?.status) {
    existing.status = data.status;
  }

  if (existing.status === 'ISSUED' && previousStatus !== 'ISSUED') {
    existing.issuedAt = new Date();
  }

  await existing.save();

  if (existing.status === 'ISSUED' && previousStatus !== 'ISSUED') {
    const appointmentNumber = appointment.appointmentNumber || '';
    await notificationService.createNotification({
      userId: appointment.petOwnerId._id.toString(),
      title: 'New Prescription',
      body: `A prescription has been issued for your appointment ${appointmentNumber}`.trim(),
      type: 'PRESCRIPTION',
      data: { prescriptionId: existing._id.toString(), appointmentId: appointment._id.toString() }
    });
  }

  return Prescription.findById(existing._id)
    .populate('veterinarianId', 'fullName name email phone profileImage')
    .populate('petOwnerId', 'fullName name email phone profileImage address')
    .populate('petId', 'name species breed gender age dateOfBirth weight photo')
    .populate('appointmentId');
};

const getPrescriptionByAppointment = async (appointmentId, userId, role) => {
  await assertAppointmentAccess({ appointmentId, userId, role });

  const prescription = await Prescription.findOne({ appointmentId })
    .populate('veterinarianId', 'fullName name email phone profileImage')
    .populate('petOwnerId', 'fullName name email phone profileImage address')
    .populate('petId', 'name species breed gender age dateOfBirth weight photo')
    .populate('appointmentId');

  if (!prescription) {
    const error = new Error('Prescription not found');
    error.statusCode = 404;
    throw error;
  }

  return prescription;
};

const getPrescriptionById = async (id, userId, role) => {
  const normalizedRole = (role || '').toString().toUpperCase();
  if (!['VETERINARIAN', 'PET_OWNER'].includes(normalizedRole)) {
    const error = new Error('Insufficient permissions');
    error.statusCode = 403;
    throw error;
  }

  validateObjectId(id, 'Prescription ID');

  const prescription = await Prescription.findById(id)
    .populate('veterinarianId', 'fullName name email phone profileImage')
    .populate('petOwnerId', 'fullName name email phone profileImage address')
    .populate('petId', 'name species breed gender age dateOfBirth weight photo')
    .populate('appointmentId');

  if (!prescription) {
    const error = new Error('Prescription not found');
    error.statusCode = 404;
    throw error;
  }

  if (normalizedRole === 'VETERINARIAN' && prescription.veterinarianId?._id?.toString() !== userId.toString()) {
    const error = new Error('Unauthorized');
    error.statusCode = 403;
    throw error;
  }

  if (normalizedRole === 'PET_OWNER' && prescription.petOwnerId?._id?.toString() !== userId.toString()) {
    const error = new Error('Unauthorized');
    error.statusCode = 403;
    throw error;
  }

  return prescription;
};

const listPrescriptionsForPetOwner = async (petOwnerId, options = {}) => {
  validateObjectId(petOwnerId, 'Pet Owner ID');

  const { page = 1, limit = 20, petId } = options;
  const skip = (page - 1) * limit;

  const query = { petOwnerId };

  if (petId) {
    validateObjectId(petId, 'Pet ID');
    query.petId = petId;
  }

  const [prescriptions, total] = await Promise.all([
    Prescription.find(query)
      .populate('veterinarianId', 'fullName name email phone profileImage')
      .populate('petId', 'name species breed photo')
      .populate('appointmentId', 'appointmentNumber appointmentDate appointmentTime bookingType status')
      .sort({ issuedAt: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .maxTimeMS(4000),
    Prescription.countDocuments(query).maxTimeMS(2000)
  ]);

  return {
    prescriptions,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };
};

module.exports = {
  upsertPrescriptionForAppointment,
  getPrescriptionByAppointment,
  getPrescriptionById,
  listPrescriptionsForPetOwner
};
