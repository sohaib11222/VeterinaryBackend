const Vaccination = require('../models/Vaccination');
const Pet = require('../models/Pet');
const User = require('../models/User');
const Vaccine = require('../models/Vaccine');

/**
 * Create vaccination
 */
const createVaccination = async (userId, userRole, data) => {
  const { petId, vaccinationDate, nextDueDate, batchNumber, certificateUrl, notes, vaccineId, doseNumber, relatedAppointmentId } = data;

  if (userRole !== 'VETERINARIAN' && userRole !== 'ADMIN') {
    throw new Error('Unauthorized');
  }

  // Handle vaccinationType - accept multiple field name variations
  let vaccinationType = data.vaccinationType || data.type || data.vaccination_type || data.vaccineType;
  
  // If still not found, check if it's nested in a vaccination object
  if (!vaccinationType && data.vaccination && typeof data.vaccination === 'object') {
    vaccinationType = data.vaccination.type || data.vaccination.vaccinationType;
  }
  
  let resolvedVaccine = null;
  if (vaccineId) {
    resolvedVaccine = await Vaccine.findById(vaccineId)
      .lean()
      .maxTimeMS(2000);
    if (!resolvedVaccine || !resolvedVaccine.isActive) {
      throw new Error('Vaccine not found');
    }
    vaccinationType = resolvedVaccine.name;
  }

  if (!vaccinationType || (typeof vaccinationType === 'string' && vaccinationType.trim() === '')) {
    throw new Error('Vaccination type is required');
  }
  vaccinationType = String(vaccinationType).trim();

  // Verify pet exists
  const pet = await Pet.findById(petId);
  if (!pet) {
    throw new Error('Pet not found');
  }

  // If veterinarian, verify they exist
  let veterinarianId = null;
  if (userRole === 'VETERINARIAN') {
    const veterinarian = await User.findById(userId);
    if (!veterinarian || veterinarian.role !== 'VETERINARIAN') {
      throw new Error('Veterinarian not found');
    }
    veterinarianId = userId;
  } else if (data.veterinarianId) {
    veterinarianId = data.veterinarianId;
  }

  if (!vaccinationDate) {
    throw new Error('Vaccination date is required');
  }

  const vaccinationDateObj = new Date(vaccinationDate);
  if (Number.isNaN(vaccinationDateObj.getTime())) {
    throw new Error('Invalid vaccination date');
  }

  const nextDueDateObj = nextDueDate
    ? new Date(nextDueDate)
    : resolvedVaccine?.defaultNextDueDays
      ? new Date(vaccinationDateObj.getTime() + resolvedVaccine.defaultNextDueDays * 24 * 60 * 60 * 1000)
      : null;

  if (nextDueDate && Number.isNaN(nextDueDateObj.getTime())) {
    throw new Error('Invalid next due date');
  }

  const vaccination = await Vaccination.create({
    petId,
    petOwnerId: pet.ownerId,
    vaccineId: resolvedVaccine?._id || vaccineId || null,
    vaccinationType,
    vaccinationDate: vaccinationDateObj,
    nextDueDate: nextDueDateObj,
    doseNumber: doseNumber ?? null,
    veterinarianId,
    batchNumber,
    certificateUrl,
    notes,
    isCompleted: true,
    relatedAppointmentId: relatedAppointmentId || null,
  });

  const createdVaccination = await Vaccination.findById(vaccination._id)
    .select('petId veterinarianId petOwnerId vaccineId vaccinationType vaccinationDate nextDueDate doseNumber batchNumber certificateUrl notes relatedAppointmentId')
    .lean()
    .maxTimeMS(2000);

  // Populate separately
  const [populatedPet, veterinarian, petOwner, vaccine] = await Promise.all([
    createdVaccination.petId ? Pet.findById(createdVaccination.petId)
      .select('name species breed')
      .lean()
      .maxTimeMS(1000) : null,
    createdVaccination.veterinarianId ? User.findById(createdVaccination.veterinarianId)
      .select('name')
      .lean()
      .maxTimeMS(1000) : null,
    createdVaccination.petOwnerId ? User.findById(createdVaccination.petOwnerId)
      .select('name')
      .lean()
      .maxTimeMS(1000) : null,
    createdVaccination.vaccineId ? Vaccine.findById(createdVaccination.vaccineId)
      .select('name applicableSpecies minAgeWeeks dosesRequired boosterScheduleDays defaultNextDueDays isActive')
      .lean()
      .maxTimeMS(1000) : null
  ]);

  return {
    ...createdVaccination,
    petId: populatedPet,
    veterinarianId: veterinarian,
    petOwnerId: petOwner,
    vaccineId: vaccine,
  };
};

/**
 * Get vaccinations
 */
const getVaccinations = async (userId, userRole, options = {}) => {
  const { petId, petOwnerId, veterinarianId, relatedAppointmentId, page = 1, limit = 20 } = options;
  const skip = (page - 1) * limit;

  const query = {};

  if (userRole === 'PET_OWNER') {
    if (petId) {
      const pet = await Pet.findOne({ _id: petId, ownerId: userId });
      if (!pet) {
        throw new Error('Pet not found or does not belong to you');
      }
      query.petId = petId;
    } else {
      const pets = await Pet.find({ ownerId: userId, isActive: true }).select('_id');
      const ownedPetIds = pets.map(p => p._id);
      query.petId = { $in: ownedPetIds };
    }
  } else if (userRole === 'VETERINARIAN') {
    query.veterinarianId = userId;
    if (petId) {
      const pet = await Pet.findById(petId).lean().maxTimeMS(2000);
      if (!pet) {
        throw new Error('Pet not found');
      }
      query.petId = petId;
    }
    if (relatedAppointmentId) query.relatedAppointmentId = relatedAppointmentId;
  } else if (userRole === 'ADMIN') {
    if (petId) query.petId = petId;
    if (petOwnerId) query.petOwnerId = petOwnerId;
    if (veterinarianId) query.veterinarianId = veterinarianId;
    if (relatedAppointmentId) query.relatedAppointmentId = relatedAppointmentId;
  } else {
    throw new Error('Unauthorized');
  }

  const [vaccinationsRaw, total] = await Promise.all([
    Vaccination.find(query)
      .select('petId veterinarianId petOwnerId vaccineId vaccinationType vaccinationDate nextDueDate doseNumber batchNumber certificateUrl notes relatedAppointmentId')
      .skip(skip)
      .limit(limit)
      .sort({ vaccinationDate: -1 })
      .lean()
      .maxTimeMS(3000),
    Vaccination.countDocuments(query).maxTimeMS(2000)
  ]);

  // Populate separately
  const petIds = [...new Set(vaccinationsRaw.map(v => v.petId?.toString()).filter(Boolean))];
  const veterinarianIds = [...new Set(vaccinationsRaw.map(v => v.veterinarianId?.toString()).filter(Boolean))];
  const petOwnerIds = [...new Set(vaccinationsRaw.map(v => v.petOwnerId?.toString()).filter(Boolean))];
  const vaccineIds = [...new Set(vaccinationsRaw.map(v => v.vaccineId?.toString()).filter(Boolean))];

  const [pets, veterinarians, petOwners, vaccines] = await Promise.all([
    petIds.length > 0 ? Pet.find({ _id: { $in: petIds } })
      .select('name species breed photo')
      .lean()
      .maxTimeMS(2000) : Promise.resolve([]),
    veterinarianIds.length > 0 ? User.find({ _id: { $in: veterinarianIds } })
      .select('name')
      .lean()
      .maxTimeMS(2000) : Promise.resolve([]),
    petOwnerIds.length > 0 ? User.find({ _id: { $in: petOwnerIds } })
      .select('name')
      .lean()
      .maxTimeMS(2000) : Promise.resolve([]),
    vaccineIds.length > 0 ? Vaccine.find({ _id: { $in: vaccineIds } })
      .select('name applicableSpecies minAgeWeeks dosesRequired boosterScheduleDays defaultNextDueDays isActive')
      .lean()
      .maxTimeMS(2000) : Promise.resolve([])
  ]);

  // Create lookup maps
  const petMap = {};
  pets.forEach(p => { petMap[p._id.toString()] = p; });
  const veterinarianMap = {};
  veterinarians.forEach(v => { veterinarianMap[v._id.toString()] = v; });
  const petOwnerMap = {};
  petOwners.forEach(p => { petOwnerMap[p._id.toString()] = p; });
  const vaccineMap = {};
  vaccines.forEach(v => { vaccineMap[v._id.toString()] = v; });

  // Attach populated data
  const vaccinations = vaccinationsRaw.map(vacc => ({
    ...vacc,
    petId: vacc.petId ? petMap[vacc.petId.toString()] : null,
    veterinarianId: vacc.veterinarianId ? veterinarianMap[vacc.veterinarianId.toString()] : null,
    petOwnerId: vacc.petOwnerId ? petOwnerMap[vacc.petOwnerId.toString()] : null,
    vaccineId: vacc.vaccineId ? vaccineMap[vacc.vaccineId.toString()] : null
  }));

  return {
    vaccinations,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };
};

/**
 * Get upcoming vaccinations
 */
const getUpcomingVaccinations = async (userId, userRole, options = {}) => {
  const { petId } = options;
  const now = new Date();
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(now.getDate() + 30);

  const query = {
    nextDueDate: {
      $gte: now,
      $lte: thirtyDaysFromNow
    },
    isCompleted: true
  };

  if (userRole === 'PET_OWNER') {
    if (petId) {
      const pet = await Pet.findOne({ _id: petId, ownerId: userId })
        .lean()
        .maxTimeMS(2000);
      if (!pet) {
        throw new Error('Pet not found or does not belong to you');
      }
      query.petId = petId;
    } else {
      const pets = await Pet.find({ ownerId: userId, isActive: true })
        .select('_id')
        .lean()
        .maxTimeMS(2000);
      const petIds = pets.map(p => p._id);
      query.petId = { $in: petIds };
    }
  } else if (userRole === 'VETERINARIAN') {
    query.veterinarianId = userId;
    if (petId) {
      const pet = await Pet.findById(petId).lean().maxTimeMS(2000);
      if (!pet) {
        throw new Error('Pet not found');
      }
      query.petId = petId;
    }
  } else if (userRole === 'ADMIN') {
    if (petId) query.petId = petId;
  } else {
    throw new Error('Unauthorized');
  }

  const vaccinationsRaw = await Vaccination.find(query)
    .select('petId veterinarianId vaccineId vaccinationType nextDueDate')
    .sort({ nextDueDate: 1 })
    .lean()
    .maxTimeMS(3000);

  // Populate separately
  const petIds = [...new Set(vaccinationsRaw.map(v => v.petId?.toString()).filter(Boolean))];
  const veterinarianIds = [...new Set(vaccinationsRaw.map(v => v.veterinarianId?.toString()).filter(Boolean))];
  const vaccineIds = [...new Set(vaccinationsRaw.map(v => v.vaccineId?.toString()).filter(Boolean))];

  const [pets, veterinarians, vaccines] = await Promise.all([
    petIds.length > 0 ? Pet.find({ _id: { $in: petIds } })
      .select('name species breed photo')
      .lean()
      .maxTimeMS(2000) : Promise.resolve([]),
    veterinarianIds.length > 0 ? User.find({ _id: { $in: veterinarianIds } })
      .select('name')
      .lean()
      .maxTimeMS(2000) : Promise.resolve([]),
    vaccineIds.length > 0 ? Vaccine.find({ _id: { $in: vaccineIds } })
      .select('name applicableSpecies minAgeWeeks dosesRequired boosterScheduleDays defaultNextDueDays isActive')
      .lean()
      .maxTimeMS(2000) : Promise.resolve([])
  ]);

  // Create lookup maps
  const petMap = {};
  pets.forEach(p => { petMap[p._id.toString()] = p; });
  const veterinarianMap = {};
  veterinarians.forEach(v => { veterinarianMap[v._id.toString()] = v; });
  const vaccineMap = {};
  vaccines.forEach(v => { vaccineMap[v._id.toString()] = v; });

  // Attach populated data
  const vaccinations = vaccinationsRaw.map(vacc => ({
    ...vacc,
    petId: vacc.petId ? petMap[vacc.petId.toString()] : null,
    veterinarianId: vacc.veterinarianId ? veterinarianMap[vacc.veterinarianId.toString()] : null,
    vaccineId: vacc.vaccineId ? vaccineMap[vacc.vaccineId.toString()] : null
  }));

  return { vaccinations };
};

/**
 * Update vaccination
 */
const updateVaccination = async (vaccinationId, userId, userRole, data) => {
  const vaccination = await Vaccination.findById(vaccinationId);
  if (!vaccination) {
    throw new Error('Vaccination not found');
  }

  if (userRole === 'ADMIN') {
    // allowed
  } else if (userRole === 'VETERINARIAN') {
    if (!vaccination.veterinarianId || vaccination.veterinarianId.toString() !== userId) {
      throw new Error('Unauthorized');
    }
  } else {
    throw new Error('Unauthorized');
  }

  let resolvedVaccine = null;
  if (data.vaccineId !== undefined) {
    if (!data.vaccineId) {
      vaccination.vaccineId = null;
    } else {
      resolvedVaccine = await Vaccine.findById(data.vaccineId).lean().maxTimeMS(2000);
      if (!resolvedVaccine || !resolvedVaccine.isActive) {
        throw new Error('Vaccine not found');
      }
      vaccination.vaccineId = resolvedVaccine._id;
      vaccination.vaccinationType = resolvedVaccine.name;
    }
    delete data.vaccineId;
  }

  // Handle vaccinationType - accept both 'vaccinationType' and 'type' field names
  if (data.vaccinationType !== undefined || data.type !== undefined) {
    const type = data.vaccinationType || data.type;
    if (type && typeof type === 'string' && type.trim() !== '') {
      vaccination.vaccinationType = type.trim();
    } else if (type) {
      throw new Error('Vaccination type cannot be empty');
    }
    // Remove from data to avoid double assignment
    delete data.vaccinationType;
    delete data.type;
  }

  Object.assign(vaccination, data);
  if (data.vaccinationDate !== undefined) {
    vaccination.vaccinationDate = data.vaccinationDate ? new Date(data.vaccinationDate) : vaccination.vaccinationDate;
  }
  if (data.nextDueDate !== undefined) {
    vaccination.nextDueDate = data.nextDueDate ? new Date(data.nextDueDate) : null;
  }
  if (data.doseNumber !== undefined) {
    vaccination.doseNumber = data.doseNumber;
  }

  await vaccination.save();
  return vaccination;
};

/**
 * Delete vaccination
 */
const deleteVaccination = async (vaccinationId, userId, userRole) => {
  const vaccination = await Vaccination.findById(vaccinationId);
  if (!vaccination) {
    throw new Error('Vaccination not found');
  }

  if (userRole === 'ADMIN') {
    // allowed
  } else if (userRole === 'VETERINARIAN') {
    if (!vaccination.veterinarianId || vaccination.veterinarianId.toString() !== userId) {
      throw new Error('Unauthorized');
    }
  } else {
    throw new Error('Unauthorized');
  }

  await Vaccination.findByIdAndDelete(vaccinationId);
};

module.exports = {
  createVaccination,
  getVaccinations,
  getUpcomingVaccinations,
  updateVaccination,
  deleteVaccination
};
