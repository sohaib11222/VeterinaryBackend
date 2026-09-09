const User = require('../models/User');
const PetSitterProfile = require('../models/PetSitterProfile');
const { USER_ROLES, USER_STATUS } = require('../types/enums');
const { validateObjectId } = require('../utils/validation');

const normalizeArray = (value) => {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === 'string') {
    try { return JSON.parse(value); } catch (_) { return value.split(',').map((item) => item.trim()).filter(Boolean); }
  }
  return [];
};

const escapeRegExp = (value) => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const contains = (value) => ({ $regex: escapeRegExp(value), $options: 'i' });

const publicProfile = (user, profile) => ({
  id: user._id,
  name: user.fullName || user.name,
  email: user.email,
  phone: user.phone,
  profileImage: user.profileImage,
  address: user.address,
  gender: user.gender,
  dob: user.dob,
  status: user.status,
  isEmailVerified: user.isEmailVerified,
  profile: profile || null,
});

const getProfileForUser = async (userId, publicOnly = false) => {
  validateObjectId(userId, 'User ID');
  const user = await User.findOne({ _id: userId, role: USER_ROLES.PET_SITTER, ...(publicOnly ? { status: USER_STATUS.APPROVED } : {}) })
    .populate('petSitterProfile')
    .lean();
  if (!user) throw new Error('Pet sitter not found');
  if (publicOnly && !user.petSitterProfile?.profileCompleted) throw new Error('Pet sitter not found');
  return publicProfile(user, user.petSitterProfile);
};

const listPublic = async (options = {}) => {
  const page = Math.max(1, Number(options.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(options.limit) || 20));
  const search = String(options.search || '').trim();
  const petType = String(options.petType || '').trim().toUpperCase();
  const city = String(options.city || '').trim();
  const province = String(options.province || options.state || '').trim();
  const postalCode = String(options.postalCode || options.cap || options.zip || '').trim();
  const query = { role: USER_ROLES.PET_SITTER, status: USER_STATUS.APPROVED };
  if (search) query.$or = [
    { name: contains(search) },
    { fullName: contains(search) },
    { 'address.city': contains(search) },
  ];
  if (city) query['address.city'] = contains(city);
  if (province) query['address.state'] = contains(province);
  if (postalCode) query['address.zip'] = contains(postalCode);
  const profileQuery = petType
    ? { petTypes: petType, isAvailable: true, profileCompleted: true }
    : { isAvailable: true, profileCompleted: true };
  const profiles = await PetSitterProfile.find(profileQuery).select('userId').lean();
  query.petSitterProfile = { $in: profiles.map((profile) => profile._id) };
  const [users, total] = await Promise.all([
    User.find(query).populate('petSitterProfile').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    User.countDocuments(query),
  ]);
  return {
    petSitters: users.map((user) => publicProfile(user, user.petSitterProfile)),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  };
};

const updateMyProfile = async (userId, payload = {}) => {
  validateObjectId(userId, 'User ID');
  const user = await User.findOne({ _id: userId, role: USER_ROLES.PET_SITTER });
  if (!user) throw new Error('Pet sitter not found');
  const profile = await PetSitterProfile.findOne({ userId });
  if (!profile) throw new Error('Pet sitter profile not found');

  const allowedUserFields = ['fullName', 'name', 'phone', 'gender', 'dob', 'profileImage'];
  allowedUserFields.forEach((field) => {
    if (payload[field] !== undefined) user[field] = payload[field];
  });
  if (payload.address !== undefined) user.address = typeof payload.address === 'object' ? payload.address : { line1: payload.address };
  const profileFields = ['bio', 'petSittingExperience', 'isAvailable'];
  profileFields.forEach((field) => {
    if (payload[field] !== undefined) profile[field] = payload[field];
  });
  ['experienceYears'].forEach((field) => { if (payload[field] !== undefined) profile[field] = Number(payload[field]); });
  ['servicesOffered', 'petTypes', 'availability', 'certifications', 'documents'].forEach((field) => {
    if (payload[field] !== undefined) profile[field] = normalizeArray(payload[field]);
  });
  profile.profileCompleted = Boolean(profile.petTypes.length && profile.servicesOffered.length);
  await Promise.all([user.save(), profile.save()]);
  return getProfileForUser(userId);
};

const addDocuments = async (userId, documents = []) => {
  validateObjectId(userId, 'User ID');
  if (!documents.length) throw new Error('Please select at least one document');
  const profile = await PetSitterProfile.findOneAndUpdate(
    { userId },
    { $push: { documents: { $each: documents } } },
    { new: true }
  );
  if (!profile) throw new Error('Pet sitter profile not found');
  return getProfileForUser(userId);
};

const listAdmin = async (options = {}) => {
  const page = Math.max(1, Number(options.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(options.limit) || 20));
  const query = { role: USER_ROLES.PET_SITTER };
  if (options.status && Object.values(USER_STATUS).includes(String(options.status).toUpperCase())) query.status = String(options.status).toUpperCase();
  const search = String(options.search || '').trim();
  if (search) query.$or = [
    { name: { $regex: search, $options: 'i' } },
    { fullName: { $regex: search, $options: 'i' } },
    { email: { $regex: search, $options: 'i' } },
  ];
  const [users, total] = await Promise.all([
    User.find(query).populate('petSitterProfile').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    User.countDocuments(query),
  ]);
  return { petSitters: users.map((user) => publicProfile(user, user.petSitterProfile)), pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
};

const setStatus = async (userId, status) => {
  validateObjectId(userId, 'User ID');
  const normalized = String(status || '').toUpperCase();
  if (![USER_STATUS.APPROVED, USER_STATUS.REJECTED, USER_STATUS.BLOCKED, USER_STATUS.PENDING].includes(normalized)) throw new Error('Invalid status');
  const user = await User.findOneAndUpdate({ _id: userId, role: USER_ROLES.PET_SITTER }, { status: normalized }, { new: true })
    .populate('petSitterProfile');
  if (!user) throw new Error('Pet sitter not found');
  return publicProfile(user, user.petSitterProfile);
};

module.exports = { listPublic, getProfileForUser, updateMyProfile, addDocuments, listAdmin, setStatus, publicProfile };
