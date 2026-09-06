const User = require('../models/User');
const VeterinarianProfile = require('../models/VeterinarianProfile');
const PasswordReset = require('../models/PasswordReset');
const crypto = require('crypto');
const { generateToken, generateRefreshToken } = require('../utils/jwt');
const { USER_ROLES, USER_STATUS } = require('../types/enums');
const { validateObjectId } = require('../utils/validation');
const { sendPhoneOtp, verifyPhoneOtp } = require('./twilioVerify.service');
const {
  sendWelcomeEmail,
  sendApprovalEmail,
  sendPasswordVerificationCodeEmail,
  sendEmailVerificationCodeEmail,
} = require('./email.service');

const isE164Phone = (phone) => {
  const t = String(phone || '').trim();
  return /^\+\d{7,15}$/.test(t);
};

const PHONE_VERIFICATION_ROLES = [
  USER_ROLES.VETERINARIAN,
  USER_ROLES.PET_STORE,
  USER_ROLES.PARAPHARMACY,
];

const requiresPhoneVerification = (role) => PHONE_VERIFICATION_ROLES.includes(String(role || '').toUpperCase());

const PASSWORD_RESET_PURPOSE = 'PASSWORD_RESET';
const PASSWORD_CHANGE_PURPOSE = 'PASSWORD_CHANGE';
const EMAIL_VERIFICATION_PURPOSE = 'EMAIL_VERIFICATION';
const PASSWORD_CODE_TTL_MS = 10 * 60 * 1000;

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();

const normalizeVerificationCode = (code) => String(code || '').trim();

const hashVerificationCode = (code) => crypto
  .createHash('sha256')
  .update(normalizeVerificationCode(code))
  .digest('hex');

const generateVerificationCode = () => String(crypto.randomInt(100000, 1000000));

const validateNewPassword = (password) => {
  if (typeof password !== 'string' || password.length < 8) {
    throw new Error('New password must be at least 8 characters long');
  }
};

const codesMatch = (storedHash, code) => {
  const candidate = Buffer.from(hashVerificationCode(code), 'utf8');
  const stored = Buffer.from(String(storedHash || ''), 'utf8');
  return stored.length === candidate.length && crypto.timingSafeEqual(stored, candidate);
};

const issueVerificationCode = async (user, purpose) => {
  if (!user?.email) {
    throw new Error('This account does not have an email address for verification');
  }

  const email = normalizeEmail(user.email);
  const code = generateVerificationCode();

  await PasswordReset.deleteMany({
    email,
    purpose,
    isUsed: false,
  });

  const verification = await PasswordReset.create({
    userId: user._id,
    email,
    purpose,
    code: hashVerificationCode(code),
    expiresAt: new Date(Date.now() + PASSWORD_CODE_TTL_MS),
  });

  try {
    const delivery = purpose === EMAIL_VERIFICATION_PURPOSE
      ? await sendEmailVerificationCodeEmail({ name: user.name, email, code })
      : await sendPasswordVerificationCodeEmail({
        name: user.name,
        email,
        code,
        purpose: purpose === PASSWORD_CHANGE_PURPOSE ? 'change' : 'reset',
      });

    if (delivery?.skipped) {
      throw new Error('Email delivery is not configured');
    }
  } catch (error) {
    await PasswordReset.deleteOne({ _id: verification._id });
    throw new Error(error?.message || 'Failed to send verification code');
  }
};

const issuePasswordVerificationCode = (user, purpose) => issueVerificationCode(user, purpose);

const findValidPasswordCode = async (email, purpose, code, userId = null) => {
  const normalizedEmail = normalizeEmail(email);
  const normalizedCode = normalizeVerificationCode(code);
  if (!normalizedEmail || !/^\d{6}$/.test(normalizedCode)) {
    return null;
  }

  const query = {
    email: normalizedEmail,
    purpose,
    isUsed: false,
    expiresAt: { $gt: new Date() },
  };
  if (userId) query.userId = userId;

  const verification = await PasswordReset.findOne(query)
    .sort({ createdAt: -1 });

  return verification && codesMatch(verification.code, normalizedCode)
    ? verification
    : null;
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
    // A user who submitted the pet-owner form but did not finish email
    // verification can safely restart the flow and receive a fresh code.
    if (
      existingUser.role === USER_ROLES.PET_OWNER &&
      existingUser.emailVerificationRequired &&
      !existingUser.isEmailVerified &&
      normalizeEmail(existingUser.email) === normalizeEmail(email)
    ) {
      await issueVerificationCode(existingUser, EMAIL_VERIFICATION_PURPOSE);
      return {
        requiresEmailVerification: true,
        email: existingUser.email,
        user: {
          id: existingUser._id,
          name: existingUser.name,
          email: existingUser.email,
          phone: existingUser.phone,
          role: existingUser.role,
          status: existingUser.status,
          isEmailVerified: existingUser.isEmailVerified,
        },
      };
    }
    throw new Error('User with this email or phone already exists');
  }

  const normalizedRole = String(role || USER_ROLES.PET_OWNER).toUpperCase();
  const isPetStore = normalizedRole === USER_ROLES.PET_STORE;
  const isParapharmacy = normalizedRole === USER_ROLES.PARAPHARMACY;
  const isVeterinarian = normalizedRole === USER_ROLES.VETERINARIAN;

  const requiresEmailVerification = normalizedRole === USER_ROLES.PET_OWNER;
  let status = requiresEmailVerification ? USER_STATUS.PENDING : USER_STATUS.APPROVED;
  if ([USER_ROLES.VETERINARIAN, USER_ROLES.PET_STORE, USER_ROLES.PARAPHARMACY].includes(normalizedRole)) {
    status = USER_STATUS.PENDING;
  }

  if (requiresPhoneVerification(normalizedRole) && !isE164Phone(phone)) {
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
    isEmailVerified: !requiresEmailVerification,
    emailVerificationRequired: requiresEmailVerification,
  });

  if (requiresPhoneVerification(normalizedRole)) {
    try {
      await sendPhoneOtp(String(user.phone).trim());
    } catch (error) {
      await User.deleteOne({ _id: user._id });
      throw new Error(error?.message || 'Failed to send verification code');
    }
  }

  // Create veterinarian profile if role is VETERINARIAN
  if (isVeterinarian) {
    const veterinarianProfile = await VeterinarianProfile.create({
      userId: user._id
    });
    // Link profile to user
    user.veterinarianProfile = veterinarianProfile._id;
    await user.save();
  }

  if (requiresEmailVerification) {
    try {
      await issueVerificationCode(user, EMAIL_VERIFICATION_PURPOSE);
    } catch (error) {
      await User.deleteOne({ _id: user._id });
      throw error;
    }

    return {
      requiresEmailVerification: true,
      email: user.email,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        status: user.status,
        isEmailVerified: user.isEmailVerified,
      },
    };
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
      isEmailVerified: user.isEmailVerified,
    },
    token,
    refreshToken
  };
};

const verifyEmail = async (email, code) => {
  const normalizedEmail = normalizeEmail(email);
  const verification = await findValidPasswordCode(
    normalizedEmail,
    EMAIL_VERIFICATION_PURPOSE,
    code
  );
  if (!verification) {
    throw new Error('Invalid or expired verification code');
  }

  const user = await User.findById(verification.userId);
  if (!user || user.role !== USER_ROLES.PET_OWNER) {
    throw new Error('Pet owner account not found');
  }

  user.isEmailVerified = true;
  user.emailVerificationRequired = false;
  user.status = USER_STATUS.APPROVED;
  verification.isUsed = true;
  await Promise.all([user.save(), verification.save()]);

  await sendWelcomeEmail({ name: user.name, email: user.email }).catch((error) => {
    console.error('[email] Failed to send pet owner welcome email:', error.message);
  });

  const token = generateToken({
    userId: user._id.toString(),
    email: user.email,
    role: user.role,
  });
  const refreshToken = generateRefreshToken({ userId: user._id.toString() });

  return {
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      status: user.status,
      isPhoneVerified: user.isPhoneVerified,
      isEmailVerified: user.isEmailVerified,
    },
    token,
    refreshToken,
  };
};

const resendEmailVerification = async (email) => {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) throw new Error('Email address is required');

  const user = await User.findOne({ email: normalizedEmail });
  if (!user || user.role !== USER_ROLES.PET_OWNER || !user.emailVerificationRequired || user.isEmailVerified) {
    return;
  }

  await issueVerificationCode(user, EMAIL_VERIFICATION_PURPOSE);
};

const sendPhoneOtpForUser = async (userId, phone = null) => {
  validateObjectId(userId, 'User ID');
  const user = await User.findById(userId).maxTimeMS(2000);

  if (!user) {
    throw new Error('User not found');
  }

  if (!requiresPhoneVerification(user.role)) {
    throw new Error('Phone verification is not available for this account');
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

  if (!requiresPhoneVerification(user.role)) {
    throw new Error('Phone verification is not available for this account');
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

  await sendApprovalEmail({ name: user.name, email: user.email, role: user.role }).catch((error) => {
    console.error('[email] Failed to send pharmacy approval email:', error.message);
  });

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

  if (user.role === USER_ROLES.PET_OWNER && user.emailVerificationRequired && !user.isEmailVerified) {
    throw new Error('Please verify your email address before logging in');
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
      isEmailVerified: user.isEmailVerified,
    },
    token,
    refreshToken
  };
};

/**
 * Change password
 */
const changePassword = async (userId, oldPassword, newPassword, verificationCode = null) => {
  validateObjectId(userId, 'User ID');
  const user = await User.findById(userId).select('+password');

  if (!user) {
    throw new Error('User not found');
  }

  validateNewPassword(newPassword);

  if (verificationCode) {
    const verification = await findValidPasswordCode(
      user.email,
      PASSWORD_CHANGE_PURPOSE,
      verificationCode,
      user._id
    );
    if (!verification) {
      throw new Error('Invalid or expired verification code');
    }
    if (!verification.verifiedAt) {
      throw new Error('Verify the code before changing your password');
    }
    verification.isUsed = true;
    await verification.save();
  } else {
    const isMatch = await user.comparePassword(oldPassword);
    if (!isMatch) {
      throw new Error('Current password is incorrect');
    }
  }

  user.password = newPassword;
  await user.save();
};

/**
 * Forgot password - Send reset code
 */
const forgotPassword = async (email) => {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    throw new Error('Email address is required');
  }

  const user = await User.findOne({ email: normalizedEmail });

  if (!user) {
    // Don't reveal if user exists
    return;
  }

  await issuePasswordVerificationCode(user, PASSWORD_RESET_PURPOSE);
};

/**
 * Verify reset code
 */
const verifyResetCode = async (email, code) => {
  const verification = await findValidPasswordCode(email, PASSWORD_RESET_PURPOSE, code);
  if (!verification) {
    throw new Error('Invalid or expired verification code');
  }

  verification.verifiedAt = new Date();
  await verification.save();
  return { verified: true };
};

/**
 * Reset password
 */
const resetPassword = async (email, code, newPassword) => {
  const normalizedEmail = normalizeEmail(email);
  validateNewPassword(newPassword);
  const user = await User.findOne({ email: normalizedEmail }).select('+password');

  if (!user) {
    throw new Error('Invalid or expired verification code');
  }

  const verification = await findValidPasswordCode(
    normalizedEmail,
    PASSWORD_RESET_PURPOSE,
    code,
    user._id
  );
  if (!verification) {
    throw new Error('Invalid or expired verification code');
  }
  if (!verification.verifiedAt) {
    throw new Error('Verify the code before setting a new password');
  }

  user.password = newPassword;
  verification.isUsed = true;
  await Promise.all([user.save(), verification.save()]);
};

const requestChangePasswordCode = async (userId) => {
  validateObjectId(userId, 'User ID');
  const user = await User.findById(userId).maxTimeMS(2000);
  if (!user) {
    throw new Error('User not found');
  }
  await issuePasswordVerificationCode(user, PASSWORD_CHANGE_PURPOSE);
};

const verifyChangePasswordCode = async (userId, code) => {
  validateObjectId(userId, 'User ID');
  const user = await User.findById(userId).maxTimeMS(2000);
  if (!user) {
    throw new Error('User not found');
  }

  const verification = await findValidPasswordCode(
    user.email,
    PASSWORD_CHANGE_PURPOSE,
    code,
    user._id
  );
  if (!verification) {
    throw new Error('Invalid or expired verification code');
  }

  verification.verifiedAt = new Date();
  await verification.save();
  return { verified: true };
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

  await sendApprovalEmail({ name: updated.name, email: updated.email, role: updated.role }).catch((error) => {
    console.error('[email] Failed to send veterinarian approval email:', error.message);
  });

  return updated;
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
  verifyEmail,
  resendEmailVerification,
  verifyResetCode,
  resetPassword,
  requestChangePasswordCode,
  verifyChangePasswordCode,
  refreshToken,
  approveVeterinarian,
  rejectVeterinarian,
  approvePetStoreUser,
  rejectPetStoreUser,
  sendPhoneOtpForUser,
  verifyPhoneOtpForUser
};
