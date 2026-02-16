const Vaccine = require('../models/Vaccine');

const createVaccine = async (data) => {
  const { name } = data;
  if (!name || String(name).trim() === '') {
    throw new Error('Vaccine name is required');
  }

  const existing = await Vaccine.findOne({ name: { $regex: new RegExp(`^${String(name).trim()}$`, 'i') } })
    .lean()
    .maxTimeMS(2000);

  if (existing) {
    throw new Error('Vaccine with this name already exists');
  }

  const vaccine = await Vaccine.create({
    name: String(name).trim(),
    applicableSpecies: Array.isArray(data.applicableSpecies) && data.applicableSpecies.length > 0 ? data.applicableSpecies : ['ALL'],
    minAgeWeeks: data.minAgeWeeks ?? null,
    dosesRequired: data.dosesRequired ?? null,
    boosterScheduleDays: Array.isArray(data.boosterScheduleDays) ? data.boosterScheduleDays : [],
    defaultNextDueDays: data.defaultNextDueDays ?? null,
    isActive: data.isActive !== undefined ? !!data.isActive : true,
  });

  return vaccine;
};

const updateVaccine = async (id, data) => {
  const vaccine = await Vaccine.findById(id).maxTimeMS(2000);
  if (!vaccine) {
    throw new Error('Vaccine not found');
  }

  if (data.name !== undefined) {
    const name = String(data.name || '').trim();
    if (!name) {
      throw new Error('Vaccine name cannot be empty');
    }

    const existing = await Vaccine.findOne({
      _id: { $ne: id },
      name: { $regex: new RegExp(`^${name}$`, 'i') },
    })
      .lean()
      .maxTimeMS(2000);

    if (existing) {
      throw new Error('Vaccine with this name already exists');
    }

    vaccine.name = name;
  }

  if (data.applicableSpecies !== undefined) {
    vaccine.applicableSpecies = Array.isArray(data.applicableSpecies) && data.applicableSpecies.length > 0 ? data.applicableSpecies : ['ALL'];
  }

  if (data.minAgeWeeks !== undefined) vaccine.minAgeWeeks = data.minAgeWeeks;
  if (data.dosesRequired !== undefined) vaccine.dosesRequired = data.dosesRequired;
  if (data.boosterScheduleDays !== undefined) vaccine.boosterScheduleDays = Array.isArray(data.boosterScheduleDays) ? data.boosterScheduleDays : [];
  if (data.defaultNextDueDays !== undefined) vaccine.defaultNextDueDays = data.defaultNextDueDays;
  if (data.isActive !== undefined) vaccine.isActive = !!data.isActive;

  await vaccine.save();
  return vaccine;
};

const listVaccines = async ({ includeInactive = false } = {}) => {
  const query = includeInactive ? {} : { isActive: true };

  const vaccines = await Vaccine.find(query)
    .sort({ name: 1 })
    .lean()
    .maxTimeMS(3000);

  return vaccines;
};

const deleteVaccine = async (id) => {
  const vaccine = await Vaccine.findById(id).lean().maxTimeMS(2000);
  if (!vaccine) {
    throw new Error('Vaccine not found');
  }

  await Vaccine.findByIdAndDelete(id);
  return { message: 'Vaccine deleted successfully' };
};

module.exports = {
  createVaccine,
  updateVaccine,
  listVaccines,
  deleteVaccine,
};
