const Specialization = require('../models/Specialization');

/**
 * Create specialization
 */
const createSpecialization = async (data) => {
  const { name, slug, description, icon, type } = data;

  const existing = await Specialization.findOne({ 
    $or: [
      { name: { $regex: new RegExp(`^${name}$`, 'i') } },
      { slug: slug }
    ]
  })
    .lean()
    .maxTimeMS(2000);

  if (existing) {
    throw new Error('Specialization with this name or slug already exists');
  }

  const generatedSlug = slug || name.toLowerCase().replace(/\s+/g, '-');

  const specialization = await Specialization.create({
    name,
    slug: generatedSlug,
    description,
    icon,
    type: type || null
  });

  return specialization;
};

/**
 * Update specialization
 */
const updateSpecialization = async (id, data) => {
  const specialization = await Specialization.findById(id)
    .maxTimeMS(2000);
  
  if (!specialization) {
    throw new Error('Specialization not found');
  }

  if (data.name || data.slug) {
    const existing = await Specialization.findOne({
      _id: { $ne: id },
      $or: [
        { name: data.name ? { $regex: new RegExp(`^${data.name}$`, 'i') } : null },
        { slug: data.slug }
      ].filter(Boolean)
    })
      .lean()
      .maxTimeMS(2000);

    if (existing) {
      throw new Error('Specialization with this name or slug already exists');
    }
  }

  Object.keys(data).forEach(key => {
    if (data[key] !== undefined) {
      specialization[key] = data[key];
    }
  });

  await specialization.save();
  return specialization;
};

/**
 * List all specializations
 */
const listSpecializations = async () => {
  const specializations = await Specialization.find()
    .sort({ name: 1 })
    .lean()
    .maxTimeMS(3000);
  return specializations;
};

/**
 * Delete specialization
 */
const deleteSpecialization = async (id) => {
  const specialization = await Specialization.findById(id);
  
  if (!specialization) {
    throw new Error('Specialization not found');
  }

  await Specialization.findByIdAndDelete(id);
  return { message: 'Specialization deleted successfully' };
};

module.exports = {
  createSpecialization,
  updateSpecialization,
  listSpecializations,
  deleteSpecialization
};
