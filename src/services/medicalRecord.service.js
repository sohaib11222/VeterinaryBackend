const MedicalRecord = require('../models/MedicalRecord');
const Pet = require('../models/Pet');
const User = require('../models/User');

/**
 * Create medical record
 */
const createMedicalRecord = async (petOwnerId, data) => {
  const { petId, title, description, recordType, fileUrl, fileName, fileSize, relatedAppointmentId, relatedVeterinarianId } = data;

  // Verify pet exists and belongs to pet owner
  const pet = await Pet.findOne({ _id: petId, ownerId: petOwnerId, isActive: true })
    .lean()
    .maxTimeMS(2000);
  if (!pet) {
    throw new Error('Pet not found or does not belong to you');
  }

  const medicalRecord = await MedicalRecord.create({
    petId,
    petOwnerId,
    title,
    description,
    recordType: recordType || 'GENERAL',
    fileUrl,
    fileName,
    fileSize,
    relatedAppointmentId,
    relatedVeterinarianId,
    uploadedDate: new Date()
  });

  const record = await MedicalRecord.findById(medicalRecord._id)
    .select('petId petOwnerId title description recordType fileUrl fileName fileSize uploadedDate relatedAppointmentId relatedVeterinarianId')
    .lean()
    .maxTimeMS(2000);
  
  // Populate separately
  const [populatedPet, appointment, veterinarian] = await Promise.all([
    record.petId ? Pet.findById(record.petId).select('name species breed').lean().maxTimeMS(1000) : null,
    record.relatedAppointmentId ? require('../models/Appointment').findById(record.relatedAppointmentId).select('appointmentNumber appointmentDate').lean().maxTimeMS(1000) : null,
    record.relatedVeterinarianId ? User.findById(record.relatedVeterinarianId).select('name').lean().maxTimeMS(1000) : null
  ]);
  
  return {
    ...record,
    petId: populatedPet,
    relatedAppointmentId: appointment,
    relatedVeterinarianId: veterinarian
  };
};

/**
 * Get medical records
 */
const getMedicalRecords = async (petOwnerId, options = {}) => {
  const { petId, recordType, page = 1, limit = 20 } = options;
  const skip = (page - 1) * limit;

  const query = { petOwnerId };

  if (petId) {
    // Verify pet belongs to pet owner
    const pet = await Pet.findOne({ _id: petId, ownerId: petOwnerId })
      .lean()
      .maxTimeMS(2000);
    if (!pet) {
      throw new Error('Pet not found or does not belong to you');
    }
    query.petId = petId;
  }

  if (recordType) {
    query.recordType = recordType.toUpperCase();
  }

  const [records, total] = await Promise.all([
    MedicalRecord.find(query)
      .select('petId petOwnerId title description recordType fileUrl fileName fileSize uploadedDate relatedAppointmentId relatedVeterinarianId')
      .skip(skip)
      .limit(limit)
      .sort({ uploadedDate: -1 })
      .lean()
      .maxTimeMS(3000),
    MedicalRecord.countDocuments(query).maxTimeMS(2000)
  ]);

  // Populate separately for better performance
  const petIds = [...new Set(records.map(r => r.petId?.toString()).filter(Boolean))];
  const appointmentIds = [...new Set(records.map(r => r.relatedAppointmentId?.toString()).filter(Boolean))];
  const veterinarianIds = [...new Set(records.map(r => r.relatedVeterinarianId?.toString()).filter(Boolean))];

  const [pets, appointments, veterinarians] = await Promise.all([
    petIds.length > 0 ? Pet.find({ _id: { $in: petIds } })
      .select('name species breed photo')
      .lean()
      .maxTimeMS(2000) : Promise.resolve([]),
    appointmentIds.length > 0 ? require('../models/Appointment').find({ _id: { $in: appointmentIds } })
      .select('appointmentNumber appointmentDate')
      .lean()
      .maxTimeMS(2000) : Promise.resolve([]),
    veterinarianIds.length > 0 ? User.find({ _id: { $in: veterinarianIds } })
      .select('name')
      .lean()
      .maxTimeMS(2000) : Promise.resolve([])
  ]);

  // Create lookup maps
  const petMap = {};
  pets.forEach(p => { petMap[p._id.toString()] = p; });
  const appointmentMap = {};
  appointments.forEach(a => { appointmentMap[a._id.toString()] = a; });
  const veterinarianMap = {};
  veterinarians.forEach(v => { veterinarianMap[v._id.toString()] = v; });

  // Attach populated data
  const populatedRecords = records.map(record => ({
    ...record,
    petId: record.petId ? petMap[record.petId.toString()] : null,
    relatedAppointmentId: record.relatedAppointmentId ? appointmentMap[record.relatedAppointmentId.toString()] : null,
    relatedVeterinarianId: record.relatedVeterinarianId ? veterinarianMap[record.relatedVeterinarianId.toString()] : null
  }));

  return {
    records: populatedRecords,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };
};

/**
 * Get medical record by ID
 */
const getMedicalRecord = async (recordId, petOwnerId) => {
  const record = await MedicalRecord.findOne({ _id: recordId, petOwnerId })
    .select('petId petOwnerId title description recordType fileUrl fileName fileSize uploadedDate relatedAppointmentId relatedVeterinarianId')
    .lean()
    .maxTimeMS(2000);
  
  if (!record) {
    throw new Error('Medical record not found or unauthorized');
  }

  // Populate separately
  const [pet, appointment, veterinarian] = await Promise.all([
    record.petId ? Pet.findById(record.petId)
      .select('name species breed photo')
      .lean()
      .maxTimeMS(1000) : null,
    record.relatedAppointmentId ? require('../models/Appointment').findById(record.relatedAppointmentId)
      .select('appointmentNumber appointmentDate')
      .lean()
      .maxTimeMS(1000) : null,
    record.relatedVeterinarianId ? User.findById(record.relatedVeterinarianId)
      .select('name')
      .lean()
      .maxTimeMS(1000) : null
  ]);

  return {
    ...record,
    petId: pet,
    relatedAppointmentId: appointment,
    relatedVeterinarianId: veterinarian
  };
};

/**
 * Delete medical record
 */
const deleteMedicalRecord = async (recordId, petOwnerId) => {
  const record = await MedicalRecord.findOne({ _id: recordId, petOwnerId })
    .lean()
    .maxTimeMS(2000);
  
  if (!record) {
    throw new Error('Medical record not found or unauthorized');
  }

  await MedicalRecord.findByIdAndDelete(recordId).maxTimeMS(2000);
};

module.exports = {
  createMedicalRecord,
  getMedicalRecords,
  getMedicalRecord,
  deleteMedicalRecord
};
