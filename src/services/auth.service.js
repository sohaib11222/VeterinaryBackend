const User = require('../models/User');
const VeterinarianProfile = require('../models/VeterinarianProfile');
const { generateToken, generateRefreshToken } = require('../utils/jwt');
const { USER_ROLES, USER_STATUS } = require('../types/enums');
const { sendError } = require('../utils/response');
const { validateObjectId } = require('../utils/validation');
const { sendPhoneOtp, verifyPhoneOtp } = require('./twilioVerify.service');

const isE164Phone = (phone) => {
  const t = String(phone || '').trim();
  return /^\+\d{7,15}$/.test(t);
};

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

  const normalizedRole = String(role || USER_ROLES.PET_OWNER).toUpperCase();
  const isPetStore = normalizedRole === USER_ROLES.PET_STORE;
  const isParapharmacy = normalizedRole === USER_ROLES.PARAPHARMACY;

  let status = USER_STATUS.APPROVED;
  if ([USER_ROLES.VETERINARIAN, USER_ROLES.PET_STORE, USER_ROLES.PARAPHARMACY].includes(normalizedRole)) {
    status = USER_STATUS.PENDING;
  }

  if ((isPetStore || isParapharmacy) && !isE164Phone(phone)) {
    throw new Error('Phone number must be in international format (E.164), e.g. +1234567890');
  }

  const user = await User.create({
    name,
    email,
    phone: phone ? String(phone).trim() : phone,
    password,
    role: normalizedRole,
    status,
    isPhoneVerified: false,
  });

  if (isPetStore || isParapharmacy) {
    try {
      await sendPhoneOtp(String(user.phone).trim());
    } catch (error) {
      await User.deleteOne({ _id: user._id });
      throw new Error(error?.message || 'Failed to send verification code');
    }
  }

  // Create veterinarian profile if role is VETERINARIAN
  if (normalizedRole === USER_ROLES.VETERINARIAN) {
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
      status: user.status,
      isPhoneVerified: user.isPhoneVerified,
    },
    token,
    refreshToken
  };
};

const sendPhoneOtpForUser = async (userId, phone = null) => {
  validateObjectId(userId, 'User ID');
  const user = await User.findById(userId).maxTimeMS(2000);

  if (!user) {
    throw new Error('User not found');
  }

  if (![USER_ROLES.PET_STORE, USER_ROLES.PARAPHARMACY].includes(user.role)) {
    throw new Error('Phone verification is only available for pharmacy accounts');
  }

  const targetPhone = String(phone || user.phone || '').trim();
  if (!isE164Phone(targetPhone)) {
    throw new Error('Phone number must be in international format (E.164), e.g. +1234567890');
  }

  if (!user.phone || String(user.phone).trim() !== targetPhone) {
    user.phone = targetPhone;
    await user.save();
  }

  const result = await sendPhoneOtp(targetPhone);
  return { status: result.status };
};

const verifyPhoneOtpForUser = async (userId, code, phone = null) => {
  validateObjectId(userId, 'User ID');
  const user = await User.findById(userId).maxTimeMS(2000);

  if (!user) {
    throw new Error('User not found');
  }

  if (![USER_ROLES.PET_STORE, USER_ROLES.PARAPHARMACY].includes(user.role)) {
    throw new Error('Phone verification is only available for pharmacy accounts');
  }

  const targetPhone = String(phone || user.phone || '').trim();
  if (!isE164Phone(targetPhone)) {
    throw new Error('Phone number must be in international format (E.164), e.g. +1234567890');
  }
  if (!String(code || '').trim()) {
    throw new Error('Verification code is required');
  }

  const result = await verifyPhoneOtp(targetPhone, String(code).trim());
  const isApproved = String(result.status || '').toLowerCase() === 'approved';
  if (!isApproved) {
    throw new Error('Invalid verification code');
  }

  user.isPhoneVerified = true;
  user.phone = targetPhone;
  await user.save();

  return {
    verified: true,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      status: user.status,
      isPhoneVerified: user.isPhoneVerified,
    },
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
      status: user.status,
      isPhoneVerified: user.isPhoneVerified,
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
  rejectPetStoreUser,
  sendPhoneOtpForUser,
  verifyPhoneOtpForUser
};
