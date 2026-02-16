const Favorite = require('../models/Favorite');

/**
 * Add favorite veterinarian
 * @param {Object} data - Favorite data
 * @returns {Promise<Object>} Created favorite
 */
const addFavorite = async (data) => {
  const { veterinarianId, petOwnerId } = data;

  // Check if already favorited
  const existing = await Favorite.findOne({ veterinarianId, petOwnerId })
    .lean()
    .maxTimeMS(2000);
  if (existing) {
    throw new Error('Veterinarian is already in favorites');
  }

  const favorite = await Favorite.create({
    veterinarianId,
    petOwnerId
  });

  return favorite;
};

/**
 * Remove favorite
 * @param {string} favoriteId - Favorite ID
 * @returns {Promise<Object>} Success message
 */
const removeFavorite = async (favoriteId) => {
  const favorite = await Favorite.findById(favoriteId)
    .maxTimeMS(2000);
  
  if (!favorite) {
    throw new Error('Favorite not found');
  }

  await Favorite.findByIdAndDelete(favoriteId).maxTimeMS(2000);

  return { message: 'Favorite removed successfully' };
};

/**
 * List favorites for pet owner
 * @param {string} petOwnerId - Pet owner ID
 * @param {Object} options - Pagination options
 * @returns {Promise<Object>} Favorites and pagination info
 */
const listFavorites = async (petOwnerId, options = {}) => {
  const { page = 1, limit = 10 } = options;

  const skip = (page - 1) * limit;

  const [favoritesRaw, total] = await Promise.all([
    Favorite.find({ petOwnerId })
      .lean()
      .maxTimeMS(3000)
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 }),
    Favorite.countDocuments({ petOwnerId }).maxTimeMS(2000)
  ]);

  // Populate separately for better performance
  const veterinarianIds = [...new Set(favoritesRaw.map(f => f.veterinarianId?.toString()).filter(Boolean))];
  const veterinarians = veterinarianIds.length > 0 ? await require('../models/User').find({ _id: { $in: veterinarianIds } })
    .select('name email phone profileImage fullName')
    .lean()
    .maxTimeMS(2000) : [];

  const veterinarianMap = {};
  veterinarians.forEach(v => { veterinarianMap[v._id.toString()] = v; });

  const favorites = favoritesRaw.map(f => ({
    ...f,
    veterinarianId: f.veterinarianId ? veterinarianMap[f.veterinarianId.toString()] : null
  }));

  return {
    favorites,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };
};

module.exports = {
  addFavorite,
  removeFavorite,
  listFavorites
};
