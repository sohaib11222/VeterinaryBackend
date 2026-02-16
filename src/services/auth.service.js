const User = require('../models/User');
const VeterinarianProfile = require('../models/VeterinarianProfile');
const { generateToken, generateRefreshToken } = require('../utils/jwt');
const { USER_ROLES, USER_STATUS } = require('../types/enums');
const { sendError } = require('../utils/response');
const { validateObjectId } = require('../utils/validation');

/**
 * Register new user
 */
const register = async (data) => {
  const { name, email, phone, password, role } = data;

  // Check if user already exists
  const existingUser = await User.findOne({ 
    $or: [{ email }, { phone }] 
  });

  if (existingUser) {
    throw new Error('User with this email or phone already exists');
  }

  // Determine status based on role
  let status = USER_STATUS.APPROVED;
  if ([USER_ROLES.VETERINARIAN, USER_ROLES.PET_STORE, USER_ROLES.PARAPHARMACY].includes(role)) {
    status = USER_STATUS.PENDING;
  }

  // Create user
  const user = await User.create({
    name,
    email,
    phone,
    password,
    role: role || USER_ROLES.PET_OWNER,
    status
  });

  // Create veterinarian profile if role is VETERINARIAN
  if (role === USER_ROLES.VETERINARIAN) {
    const veterinarianProfile = await VeterinarianProfile.create({
      userId: user._id
    });
    // Link profile to user
    user.veterinarianProfile = veterinarianProfile._id;
    await user.save();
  }

  // Generate tokens
  const token = generateToken({
    userId: user._id.toString(),
    email: user.email,
    role: user.role
  });

  const refreshToken = generateRefreshToken({
    userId: user._id.toString()
  });

  return {
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      status: user.status
    },
    token,
    refreshToken
  };
};

const approvePetStoreUser = async (userId) => {
  validateObjectId(userId, 'User ID');
  const user = await User.findById(userId).maxTimeMS(2000);

  if (!user) {
    throw new Error('User not found');
  }

  if (![USER_ROLES.PET_STORE, USER_ROLES.PARAPHARMACY].includes(user.role)) {
    throw new Error('User is not a pet store');
  }

  const requiredDocTypes = ['PET_STORE_LICENSE', 'PET_STORE_DEGREE', 'PET_STORE_OWNER_ID', 'PET_STORE_ADDRESS_PROOF'];
  const uploads = Array.isArray(user.documentUploads) ? user.documentUploads : [];
  const uploadedTypes = new Set(uploads.map((d) => String(d.type || '').toUpperCase()));

  const missing = requiredDocTypes.filter((t) => !uploadedTypes.has(t));
  if (missing.length > 0) {
    throw new Error(`Missing required pet store documents: ${missing.join(', ')}`);
  }

  user.status = USER_STATUS.APPROVED;
  await user.save();

  return user;
};

const rejectPetStoreUser = async (userId, reason) => {
  validateObjectId(userId, 'User ID');
  const user = await User.findById(userId).maxTimeMS(2000);

  if (!user) {
    throw new Error('User not found');
  }

  if (![USER_ROLES.PET_STORE, USER_ROLES.PARAPHARMACY].includes(user.role)) {
    throw new Error('User is not a pet store');
  }

  user.status = USER_STATUS.REJECTED;
  await user.save();

  return user;
};

/**
 * Login user
 */
const login = async (data) => {
  const { email, password } = data;

  // Find user with password
  const user = await User.findOne({ email }).select('+password');

  if (!user) {
    throw new Error('Invalid credentials');
  }

  // Check if user is blocked
  if (user.status === USER_STATUS.BLOCKED) {
    throw new Error('Account is blocked. Please contact admin');
  }

  // Check password
  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    throw new Error('Invalid credentials');
  }

  // Generate tokens
  const token = generateToken({
    userId: user._id.toString(),
    email: user.email,
    role: user.role
  });

  const refreshToken = generateRefreshToken({
    userId: user._id.toString()
  });

  return {
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      status: user.status
    },
    token,
    refreshToken
  };
};

/**
 * Change password
 */
const changePassword = async (userId, oldPassword, newPassword) => {
  const { validateObjectId } = require('../utils/validation');
  validateObjectId(userId, 'User ID');
  
  const user = await User.findById(userId).select('+password');

  if (!user) {
    throw new Error('User not found');
  }

  const isMatch = await user.comparePassword(oldPassword);
  if (!isMatch) {
    throw new Error('Current password is incorrect');
  }

  user.password = newPassword;
  await user.save();
};

/**
 * Forgot password - Send reset code
 */
const forgotPassword = async (email) => {
  const user = await User.findOne({ email });

  if (!user) {
    // Don't reveal if user exists
    return;
  }

  // TODO: Implement OTP generation and email sending
  // For now, just return success
  return;
};

/**
 * Verify reset code
 */
const verifyResetCode = async (email, code) => {
  // TODO: Implement OTP verification
  // For now, return a temporary token
  return { verified: true };
};

/**
 * Reset password
 */
const resetPassword = async (email, code, newPassword) => {
  // TODO: Implement password reset with OTP verification
  const user = await User.findOne({ email });

  if (!user) {
    throw new Error('User not found');
  }

  user.password = newPassword;
  await user.save();
};

/**
 * Refresh token
 */
const refreshToken = async (refreshToken) => {
  const { verifyRefreshToken } = require('../utils/jwt');
  
  try {
    const decoded = verifyRefreshToken(refreshToken);
    const user = await User.findById(decoded.userId);

    if (!user) {
      throw new Error('User not found');
    }

    const token = generateToken({
      userId: user._id.toString(),
      email: user.email,
      role: user.role
    });

    return { token };
  } catch (error) {
    throw new Error('Invalid refresh token');
  }
};

/**
 * Approve veterinarian
 * Uses findOneAndUpdate for a single atomic DB round-trip with explicit timeout.
 */
const approveVeterinarian = async (veterinarianId) => {
  validateObjectId(veterinarianId, 'Veterinarian ID');
  const updated = await User.findOneAndUpdate(
    { _id: veterinarianId, role: USER_ROLES.VETERINARIAN },
    { $set: { status: USER_STATUS.APPROVED } },
    { new: true, maxTimeMS: 5000 }
  ).lean();

  if (!updated) {
    throw new Error('Veterinarian not found');
  }
};

/**
 * Reject veterinarian
 * Uses findOneAndUpdate for a single atomic DB round-trip with explicit timeout.
 */
const rejectVeterinarian = async (veterinarianId, reason) => {
  validateObjectId(veterinarianId, 'Veterinarian ID');
  const updated = await User.findOneAndUpdate(
    { _id: veterinarianId, role: USER_ROLES.VETERINARIAN },
    { $set: { status: USER_STATUS.REJECTED } },
    { new: true, maxTimeMS: 5000 }
  ).lean();

  if (!updated) {
    throw new Error('Veterinarian not found');
  }

  // TODO: Send rejection email with reason
};

module.exports = {
  register,
  login,
  changePassword,
  forgotPassword,
  verifyResetCode,
  resetPassword,
  refreshToken,
  approveVeterinarian,
  rejectVeterinarian,
  approvePetStoreUser,
  rejectPetStoreUser
};
