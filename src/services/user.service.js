const User = require('../models/User');
const VeterinarianSubscription = require('../models/VeterinarianSubscription');
const { validateObjectId } = require('../utils/validation');

/**
 * Get user by ID
 * @param {string} userId - User ID
 * @returns {Promise<Object>} User object
 */
const getUserById = async (userId) => {
  validateObjectId(userId, 'User ID');
  
  const user = await User.findById(userId).select('-password');
  
  if (!user) {
    throw new Error('User not found');
  }

  return user;
};

/**
 * Update user profile
 * @param {string} userId - User ID
 * @param {Object} data - Update data
 * @returns {Promise<Object>} Updated user
 */
const updateUserProfile = async (userId, data) => {
  validateObjectId(userId, 'User ID');
  
  const user = await User.findById(userId);
  
  if (!user) {
    throw new Error('User not found');
  }

  // Update allowed fields
  if (data.name !== undefined) user.name = data.name;
  if (data.fullName !== undefined) user.fullName = data.fullName;
  if (data.phone !== undefined) user.phone = data.phone;
  if (data.gender !== undefined) user.gender = data.gender;
  if (data.dob !== undefined) user.dob = data.dob ? new Date(data.dob) : null;
  if (data.profileImage !== undefined) user.profileImage = data.profileImage;
  if (data.bloodGroup !== undefined) user.bloodGroup = data.bloodGroup;
  
  if (data.address) {
    user.address = {
      line1: data.address.line1 || user.address?.line1 || null,
      line2: data.address.line2 || user.address?.line2 || null,
      city: data.address.city || user.address?.city || null,
      state: data.address.state || user.address?.state || null,
      country: data.address.country || user.address?.country || null,
      zip: data.address.zip || user.address?.zip || null
    };
  }

  if (data.emergencyContact) {
    user.emergencyContact = {
      name: data.emergencyContact.name || user.emergencyContact?.name || null,
      phone: data.emergencyContact.phone || user.emergencyContact?.phone || null,
      relation: data.emergencyContact.relation || user.emergencyContact?.relation || null
    };
  }

  await user.save();

  const userObj = user.toObject();
  delete userObj.password;

  return userObj;
};

/**
 * Update user status (admin only)
 * @param {string} userId - User ID
 * @param {string} status - New status
 * @returns {Promise<Object>} Updated user
 */
const updateStatus = async (userId, status) => {
  validateObjectId(userId, 'User ID');
  
  const user = await User.findById(userId);
  
  if (!user) {
    throw new Error('User not found');
  }

  const validStatuses = ['PENDING', 'APPROVED', 'REJECTED', 'BLOCKED'];
  if (!validStatuses.includes(status)) {
    throw new Error('Invalid status');
  }

  user.status = status;
  await user.save();

  const userObj = user.toObject();
  delete userObj.password;

  return userObj;
};

/**
 * List users with filtering and pagination
 * @param {Object} filter - Filter criteria
 * @returns {Promise<Object>} Users and pagination info
 */
const listUsers = async (filter = {}) => {
  const {
    role,
    status,
    search,
    page = 1,
    limit = 10
  } = filter;

  const query = {};

  if (role) {
    query.role = role.toUpperCase();
  }

  if (status) {
    query.status = status.toUpperCase();
  }

  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { fullName: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } }
    ];
  }

  const skip = (page - 1) * limit;

  const [users, total] = await Promise.all([
    User.find(query)
      .select('-password')
      .populate('subscriptionPlan', 'name price durationInDays features status')
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 }),
    User.countDocuments(query)
  ]);

  return {
    users,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };
};

/**
 * List all veterinarians with subscription info (admin only)
 * @param {Object} filter - Filter criteria
 * @returns {Promise<Object>} Veterinarians and pagination info
 */
const listVeterinarians = async (filter = {}) => {
  const {
    status,
    subscriptionStatus,
    search,
    page = 1,
    limit = 10
  } = filter;

  const query = { role: 'VETERINARIAN' };

  if (status) {
    query.status = status.toUpperCase();
  }

  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { fullName: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } }
    ];
  }

  const skip = (page - 1) * limit;

  const [veterinarians, total] = await Promise.all([
    User.find(query)
      .select('-password')
      .populate('veterinarianProfile')
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 }),
    User.countDocuments(query)
  ]);

  const veterinarianIds = veterinarians.map(v => v._id);
  const activeSubscriptions = veterinarianIds.length > 0
    ? await VeterinarianSubscription.find({
      veterinarianId: { $in: veterinarianIds },
      isActive: true,
      endDate: { $gt: new Date() }
    })
      .populate('subscriptionPlanId', 'name price durationInDays features status')
      .lean()
      .maxTimeMS(3000)
    : [];

  const subscriptionMap = new Map(
    activeSubscriptions.map(subscription => [
      subscription.veterinarianId.toString(),
      subscription
    ])
  );

  // Always return subscription information so it can be reviewed in the
  // Admin UI, not merely used as an invisible filter.
  const enrichedVeterinarians = veterinarians.map(veterinarian => {
    const vet = veterinarian.toObject();
    const subscription = subscriptionMap.get(vet._id.toString()) || null;
    return {
      ...vet,
      subscriptionStatus: subscription ? 'ACTIVE' : 'NONE',
      subscription: subscription
        ? {
          _id: subscription._id,
          startDate: subscription.startDate,
          endDate: subscription.endDate,
          isActive: subscription.isActive,
          plan: subscription.subscriptionPlanId || null
        }
        : null
    };
  });

  let filteredVeterinarians = enrichedVeterinarians;
  if (subscriptionStatus) {
    const requestedStatus = subscriptionStatus.toUpperCase();
    filteredVeterinarians = enrichedVeterinarians.filter(vet => {
      const hasActiveSubscription = vet.subscriptionStatus === 'ACTIVE';
      if (requestedStatus === 'ACTIVE') return hasActiveSubscription;
      if (requestedStatus === 'EXPIRED' || requestedStatus === 'NONE') {
        return !hasActiveSubscription;
      }
      return true;
    });
  }

  return {
    veterinarians: filteredVeterinarians,
    pagination: {
      page,
      limit,
      total: subscriptionStatus ? filteredVeterinarians.length : total,
      pages: Math.ceil((subscriptionStatus ? filteredVeterinarians.length : total) / limit)
    }
  };
};

/**
 * Delete user by ID (admin only)
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Success message
 */
const deleteUserById = async (userId) => {
  validateObjectId(userId, 'User ID');

  const user = await User.findById(userId)
    .maxTimeMS(2000);

  if (!user) {
    throw new Error('User not found');
  }

  if (String(user.role || '').toUpperCase() === 'ADMIN') {
    throw new Error('Cannot delete admin user');
  }

  await User.findByIdAndDelete(userId).maxTimeMS(2000);
  return { message: 'User deleted successfully' };
};

module.exports = {
  getUserById,
  updateUserProfile,
  updateStatus,
  listUsers,
  listVeterinarians,
  deleteUserById
};
