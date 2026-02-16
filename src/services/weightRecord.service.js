const WeightRecord = require('../models/WeightRecord');
const Pet = require('../models/Pet');
const User = require('../models/User');
const Appointment = require('../models/Appointment');

/**
 * Create weight record
 */
const createWeightRecord = async (userId, userRole, data) => {
  const { petId, weight, date, notes, relatedAppointmentId } = data;
  if (userRole !== 'VETERINARIAN' && userRole !== 'ADMIN') {
    throw new Error('Unauthorized');
  }

  // Verify pet exists
  const pet = await Pet.findOne({ _id: petId, isActive: true }).maxTimeMS(2000);
  if (!pet) {
    throw new Error('Pet not found');
  }

  // If veterinarian, validate that the appointment belongs to them (when appointment is provided)
  if (userRole === 'VETERINARIAN' && relatedAppointmentId) {
    const appt = await Appointment.findById(relatedAppointmentId)
      .select('veterinarianId petId')
      .lean()
      .maxTimeMS(2000);

    if (!appt) {
      throw new Error('Related appointment not found');
    }

    if (appt.veterinarianId?.toString() !== userId) {
      throw new Error('Unauthorized: appointment does not belong to you');
    }

    if (appt.petId?.toString() !== petId) {
      throw new Error('Related appointment does not match this pet');
    }
  }

  // Handle weight - normalize to object format if needed
  let normalizedWeight = weight;
  if (weight && (typeof weight === 'number' || typeof weight === 'string')) {
    normalizedWeight = {
      value: Number(weight),
      unit: 'kg' // Default unit
    };
  } else if (weight && typeof weight === 'object' && !weight.value) {
    // If object but missing value, try to extract it
    if (weight.weight !== undefined) {
      normalizedWeight = {
        value: Number(weight.weight),
        unit: weight.unit || 'kg'
      };
    } else {
      throw new Error('Weight must have a value');
    }
  } else if (!weight || !weight.value) {
    throw new Error('Weight value is required');
  }

  const weightRecord = await WeightRecord.create({
    petId,
    petOwnerId: pet.ownerId,
    weight: normalizedWeight,
    date: date ? new Date(date) : new Date(),
    notes,
    recordedBy: userId,
    relatedAppointmentId
  });

  // Update pet's current weight
  if (normalizedWeight && normalizedWeight.value !== undefined && normalizedWeight.value !== null) {
    pet.weight = normalizedWeight;
    await pet.save();
  }

  const createdRecord = await WeightRecord.findById(weightRecord._id)
    .select('petId petOwnerId weight date notes recordedBy')
    .lean()
    .maxTimeMS(2000);

  // Populate separately
  const [populatedPet, recordedBy] = await Promise.all([
    createdRecord.petId ? Pet.findById(createdRecord.petId)
      .select('name species breed')
      .lean()
      .maxTimeMS(1000) : null,
    createdRecord.recordedBy ? require('../models/User').findById(createdRecord.recordedBy)
      .select('name')
      .lean()
      .maxTimeMS(1000) : null
  ]);

  return {
    ...createdRecord,
    petId: populatedPet,
    recordedBy: recordedBy
  };
};

/**
 * Get weight records
 */
const getWeightRecords = async (userId, userRole, options = {}) => {
  const { petId, page = 1, limit = 50 } = options;
  const skip = (page - 1) * limit;
  const query = {};

  if (userRole === 'PET_OWNER') {
    query.petOwnerId = userId;
  } else if (userRole === 'VETERINARIAN') {
    if (!petId) {
      query.recordedBy = userId;
    }
  } else if (userRole === 'ADMIN') {
    if (options.petOwnerId) query.petOwnerId = options.petOwnerId;
    if (options.veterinarianId) query.recordedBy = options.veterinarianId;
  } else {
    throw new Error('Unauthorized');
  }

  if (petId) {
    if (userRole === 'PET_OWNER') {
      const owned = await Pet.findOne({ _id: petId, ownerId: userId })
        .lean()
        .maxTimeMS(2000);
      if (!owned) {
        throw new Error('Pet not found or does not belong to you');
      }
    }

    if (userRole === 'VETERINARIAN') {
      const appt = await Appointment.findOne({ veterinarianId: userId, petId })
        .select('_id')
        .lean()
        .maxTimeMS(2000);

      if (!appt) {
        throw new Error('Unauthorized: You do not have access to this pet');
      }
    }

    query.petId = petId;
  }

  const [recordsRaw, total] = await Promise.all([
    WeightRecord.find(query)
      .select('petId petOwnerId weight date notes recordedBy relatedAppointmentId')
      .skip(skip)
      .limit(limit)
      .sort({ date: -1 })
      .lean()
      .maxTimeMS(3000),
    WeightRecord.countDocuments(query).maxTimeMS(2000)
  ]);

  // Populate separately
  const petIds = [...new Set(recordsRaw.map(r => r.petId?.toString()).filter(Boolean))];
  const recordedByIds = [...new Set(recordsRaw.map(r => r.recordedBy?.toString()).filter(Boolean))];
  const petOwnerIds = [...new Set(recordsRaw.map(r => r.petOwnerId?.toString()).filter(Boolean))];

  const [pets, recordedByUsers, petOwners] = await Promise.all([
    petIds.length > 0 ? Pet.find({ _id: { $in: petIds } })
      .select('name species breed photo')
      .lean()
      .maxTimeMS(2000) : Promise.resolve([]),
    recordedByIds.length > 0 ? User.find({ _id: { $in: recordedByIds } })
      .select('name')
      .lean()
      .maxTimeMS(2000) : Promise.resolve([]),
    petOwnerIds.length > 0 ? User.find({ _id: { $in: petOwnerIds } })
      .select('name email phone')
      .lean()
      .maxTimeMS(2000) : Promise.resolve([])
  ]);

  // Create lookup maps
  const petMap = {};
  pets.forEach(p => { petMap[p._id.toString()] = p; });
  const recordedByMap = {};
  recordedByUsers.forEach(u => { recordedByMap[u._id.toString()] = u; });
  const petOwnerMap = {};
  petOwners.forEach(u => { petOwnerMap[u._id.toString()] = u; });

  // Attach populated data
  const records = recordsRaw.map(r => ({
    ...r,
    petId: r.petId ? petMap[r.petId.toString()] : null,
    petOwnerId: r.petOwnerId ? petOwnerMap[r.petOwnerId.toString()] || r.petOwnerId : null,
    recordedBy: r.recordedBy ? recordedByMap[r.recordedBy.toString()] : null
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
 * Get weight record by ID
 */
const getWeightRecord = async (recordId, userId, userRole) => {
  if (userRole !== 'PET_OWNER' && userRole !== 'VETERINARIAN' && userRole !== 'ADMIN') {
    throw new Error('Unauthorized');
  }

  if (userRole === 'PET_OWNER') {
    const record = await WeightRecord.findOne({ _id: recordId, petOwnerId: userId })
      .select('petId petOwnerId weight date notes recordedBy relatedAppointmentId')
      .lean()
      .maxTimeMS(2000);

    if (!record) {
      throw new Error('Weight record not found or unauthorized');
    }

    const [pet, recordedBy] = await Promise.all([
      record.petId ? Pet.findById(record.petId)
        .select('name species breed photo')
        .lean()
        .maxTimeMS(1000) : null,
      record.recordedBy ? require('../models/User').findById(record.recordedBy)
        .select('name')
        .lean()
        .maxTimeMS(1000) : null
    ]);

    return {
      ...record,
      petId: pet,
      recordedBy: recordedBy
    };
  }

  if (userRole === 'ADMIN') {
    const record = await WeightRecord.findOne({ _id: recordId })
      .select('petId petOwnerId weight date notes recordedBy relatedAppointmentId')
      .lean()
      .maxTimeMS(2000);

    if (!record) {
      throw new Error('Weight record not found or unauthorized');
    }

    const [pet, recordedBy] = await Promise.all([
      record.petId ? Pet.findById(record.petId)
        .select('name species breed photo')
        .lean()
        .maxTimeMS(1000) : null,
      record.recordedBy ? require('../models/User').findById(record.recordedBy)
        .select('name')
        .lean()
        .maxTimeMS(1000) : null
    ]);

    return {
      ...record,
      petId: pet,
      recordedBy: recordedBy
    };
  }

  // VETERINARIAN
  const record = await WeightRecord.findOne({ _id: recordId })
    .select('petId petOwnerId weight date notes recordedBy relatedAppointmentId')
    .lean()
    .maxTimeMS(2000);

  if (!record) {
    throw new Error('Weight record not found or unauthorized');
  }

  const isOwnerOfRecord = record.recordedBy?.toString() === userId;
  const hasAppt = await Appointment.findOne({ veterinarianId: userId, petId: record.petId })
    .select('_id')
    .lean()
    .maxTimeMS(2000);

  if (!isOwnerOfRecord && !hasAppt) {
    throw new Error('Weight record not found or unauthorized');
  }

  const [pet, recordedBy] = await Promise.all([
    record.petId ? Pet.findById(record.petId)
      .select('name species breed photo')
      .lean()
      .maxTimeMS(1000) : null,
    record.recordedBy ? require('../models/User').findById(record.recordedBy)
      .select('name')
      .lean()
      .maxTimeMS(1000) : null
  ]);

  return {
    ...record,
    petId: pet,
    recordedBy: recordedBy
  };
};

/**
 * Update weight record
 */
const updateWeightRecord = async (recordId, userId, userRole, data) => {
  if (userRole !== 'VETERINARIAN' && userRole !== 'ADMIN') {
    throw new Error('Unauthorized');
  }

  const query = { _id: recordId };
  if (userRole === 'VETERINARIAN') query.recordedBy = userId;

  const record = await WeightRecord.findOne(query);
  if (!record) {
    throw new Error('Weight record not found or unauthorized');
  }

  // Handle weight - normalize to object format if needed
  if (data.weight) {
    if (typeof data.weight === 'number' || typeof data.weight === 'string') {
      data.weight = {
        value: Number(data.weight),
        unit: 'kg' // Default unit
      };
    } else if (typeof data.weight === 'object' && !data.weight.value) {
      // If object but missing value, try to extract it
      if (data.weight.weight !== undefined) {
        data.weight = {
          value: Number(data.weight.weight),
          unit: data.weight.unit || 'kg'
        };
      } else {
        throw new Error('Weight must have a value');
      }
    }
  }

  Object.assign(record, data);
  if (data.date) {
    record.date = new Date(data.date);
  }
  await record.save();

  return record;
};

/**
 * Delete weight record
 */
const deleteWeightRecord = async (recordId, userId, userRole) => {
  if (userRole !== 'VETERINARIAN' && userRole !== 'ADMIN') {
    throw new Error('Unauthorized');
  }

  const query = { _id: recordId };
  if (userRole === 'VETERINARIAN') query.recordedBy = userId;

  const record = await WeightRecord.findOne(query);
  if (!record) {
    throw new Error('Weight record not found or unauthorized');
  }

  await WeightRecord.findByIdAndDelete(recordId);
};

module.exports = {
  createWeightRecord,
  getWeightRecords,
  getWeightRecord,
  updateWeightRecord,
  deleteWeightRecord
};
