const PlatformService = require('../models/PlatformService');
const ProviderServiceOffering = require('../models/ProviderServiceOffering');
const User = require('../models/User');
const VeterinarianProfile = require('../models/VeterinarianProfile');
const PetSitterProfile = require('../models/PetSitterProfile');
const PetStore = require('../models/PetStore');
const { USER_ROLES, USER_STATUS } = require('../types/enums');

const DEFAULT_SERVICES = [
  ['Care', 'Cura', 'care', 'fa-heart-pulse', 'PROFESSIONAL', [USER_ROLES.VETERINARIAN]],
  ['Education', 'Educazione', 'education', 'fa-graduation-cap', 'PROFESSIONAL', [USER_ROLES.PET_SITTER, USER_ROLES.VETERINARIAN]],
  ['Assistance', 'Assistenza', 'assistance', 'fa-hand-holding-heart', 'PROFESSIONAL', [USER_ROLES.PET_SITTER, USER_ROLES.VETERINARIAN]],
  ['Transportation', 'Trasporto', 'transportation', 'fa-car-side', 'PROFESSIONAL', [USER_ROLES.PET_SITTER]],
  ['Well-being', 'Benessere', 'well-being', 'fa-spa', 'PROFESSIONAL', [USER_ROLES.VETERINARIAN, USER_ROLES.PET_SITTER]],
  ['Nutrition', 'Alimentazione', 'nutrition', 'fa-bowl-food', 'PROFESSIONAL', [USER_ROLES.VETERINARIAN, USER_ROLES.PET_STORE, USER_ROLES.PARAPHARMACY]],
  ['Daily Services', 'Servizi quotidiani', 'daily-services', 'fa-calendar-day', 'PROFESSIONAL', [USER_ROLES.PET_SITTER]],
  ['Travel', 'Viaggi', 'travel', 'fa-suitcase', 'PROFESSIONAL', [USER_ROLES.PET_SITTER]],
  ['Shopping', 'Acquisti', 'shopping', 'fa-bag-shopping', 'COMMERCE', [USER_ROLES.PET_STORE, USER_ROLES.PARAPHARMACY]],
  ['Extra', 'Extra', 'extra', 'fa-star', 'PROFESSIONAL', [USER_ROLES.VETERINARIAN, USER_ROLES.PET_SITTER, USER_ROLES.PET_STORE, USER_ROLES.PARAPHARMACY]],
  ['End of Life', 'Fine vita', 'end-of-life', 'fa-dove', 'PROFESSIONAL', [USER_ROLES.VETERINARIAN]],
].map(([name, nameIt, slug, icon, kind, allowedRoles], displayOrder) => ({ name, nameIt, slug, icon, kind, allowedRoles, displayOrder }));

const slugify = (value) => String(value || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
const normalizeRole = (value) => String(value || '').trim().toUpperCase();
const allowedProviderRoles = [USER_ROLES.VETERINARIAN, USER_ROLES.PET_SITTER, USER_ROLES.PET_STORE, USER_ROLES.PARAPHARMACY];

const ensureDefaults = async () => {
  await Promise.all(DEFAULT_SERVICES.map((service) => PlatformService.updateOne(
    { slug: service.slug },
    { $setOnInsert: service },
    { upsert: true }
  )));
};

const listServices = async ({ includeInactive = false } = {}) => {
  await ensureDefaults();
  return PlatformService.find(includeInactive ? {} : { isActive: true }).sort({ displayOrder: 1, name: 1 }).lean();
};

const createService = async (payload = {}) => {
  const name = String(payload.name || '').trim();
  const nameIt = String(payload.nameIt || '').trim();
  const slug = slugify(payload.slug || name);
  if (!name || !nameIt || !slug) throw new Error('English name, Italian name, and slug are required');
  const roles = [...new Set((Array.isArray(payload.allowedRoles) ? payload.allowedRoles : []).map(normalizeRole))];
  if (!roles.length || roles.some((role) => !allowedProviderRoles.includes(role))) throw new Error('Select at least one valid provider role');
  return PlatformService.create({
    name, nameIt, slug, allowedRoles: roles,
    description: String(payload.description || '').trim(), descriptionIt: String(payload.descriptionIt || '').trim(),
    icon: String(payload.icon || 'fa-paw').trim(), kind: payload.kind === 'COMMERCE' ? 'COMMERCE' : 'PROFESSIONAL',
    isActive: payload.isActive !== false, displayOrder: Number.isFinite(Number(payload.displayOrder)) ? Number(payload.displayOrder) : 999,
  });
};

const updateService = async (id, payload = {}) => {
  const service = await PlatformService.findById(id);
  if (!service) throw new Error('Service not found');
  const fields = ['name', 'nameIt', 'description', 'descriptionIt', 'icon', 'isActive', 'kind', 'displayOrder'];
  fields.forEach((field) => { if (payload[field] !== undefined) service[field] = field.includes('description') || field === 'icon' ? String(payload[field] || '').trim() : payload[field]; });
  if (payload.slug !== undefined) service.slug = slugify(payload.slug);
  if (payload.allowedRoles !== undefined) {
    const roles = [...new Set((Array.isArray(payload.allowedRoles) ? payload.allowedRoles : []).map(normalizeRole))];
    if (!roles.length || roles.some((role) => !allowedProviderRoles.includes(role))) throw new Error('Select at least one valid provider role');
    service.allowedRoles = roles;
  }
  await service.save();
  return service;
};

const deleteService = async (id) => {
  const service = await PlatformService.findById(id);
  if (!service) throw new Error('Service not found');
  const usageCount = await ProviderServiceOffering.countDocuments({ serviceId: service._id });
  if (usageCount) throw new Error('This service has provider offerings. Disable it instead of deleting it.');
  await service.deleteOne();
};

const listMyOfferings = async (userId, role) => {
  await ensureDefaults();
  const services = await PlatformService.find({ isActive: true, allowedRoles: role }).sort({ displayOrder: 1, name: 1 }).lean();
  const offerings = await ProviderServiceOffering.find({ providerId: userId }).lean();
  const offeringMap = new Map(offerings.map((offering) => [String(offering.serviceId), offering]));
  return services.map((service) => ({ ...service, offering: offeringMap.get(String(service._id)) || null }));
};

const updateMyOfferings = async (userId, role, entries) => {
  if (!allowedProviderRoles.includes(role)) throw new Error('This account cannot publish service offerings');
  const requested = Array.isArray(entries) ? entries : [];
  const ids = [...new Set(requested.map((entry) => String(entry.serviceId || entry._id || '')).filter(Boolean))];
  const services = await PlatformService.find({ _id: { $in: ids }, isActive: true }).lean();
  if (services.length !== ids.length) throw new Error('One or more selected services are unavailable');
  if (services.some((service) => !service.allowedRoles.includes(role))) throw new Error('Your role is not allowed to offer one or more selected services');
  const byId = new Map(services.map((service) => [String(service._id), service]));
  await Promise.all(requested.map((entry) => {
    const serviceId = String(entry.serviceId || entry._id || '');
    if (!byId.has(serviceId)) return null;
    const modes = (Array.isArray(entry.deliveryModes) ? entry.deliveryModes : []).filter((mode) => ['IN_PERSON', 'ONLINE', 'HOME_VISIT', 'TRANSPORT', 'STORE'].includes(mode));
    const parsedPrice = Number(entry.priceFrom);
    return ProviderServiceOffering.updateOne({ providerId: userId, serviceId }, {
      $set: { providerRole: role, description: String(entry.description || '').trim(), priceFrom: entry.priceFrom === '' || entry.priceFrom == null || !Number.isFinite(parsedPrice) ? null : parsedPrice, deliveryModes: modes, isActive: entry.isActive !== false },
    }, { upsert: true });
  }));
  await ProviderServiceOffering.updateMany({ providerId: userId, serviceId: { $nin: ids } }, { $set: { isActive: false } });
  return listMyOfferings(userId, role);
};

const listProviders = async (slug, options = {}) => {
  await ensureDefaults();
  const service = await PlatformService.findOne({ slug, isActive: true }).lean();
  if (!service) throw new Error('Service not found');
  const role = options.role ? normalizeRole(options.role) : null;
  const page = Math.max(1, Number(options.page) || 1);
  const limit = Math.min(60, Math.max(1, Number(options.limit) || 60));
  const offeringQuery = { serviceId: service._id, isActive: true, ...(role ? { providerRole: role } : {}) };
  const offerings = await ProviderServiceOffering.find(offeringQuery).lean();
  const ids = offerings.map((offering) => offering.providerId);
  const userQuery = { _id: { $in: ids }, status: USER_STATUS.APPROVED };
  const users = await User.find(userQuery).select('fullName name email phone profileImage address role').lean();
  const userMap = new Map(users.map((user) => [String(user._id), user]));
  const activeOfferings = offerings.filter((offering) => userMap.has(String(offering.providerId)));
  const selectedIds = activeOfferings.map((offering) => offering.providerId);
  const [vetProfiles, sitterProfiles, stores] = await Promise.all([
    VeterinarianProfile.find({ userId: { $in: selectedIds } }).select('userId specializations ratingAvg ratingCount isAvailableOnline').lean(),
    PetSitterProfile.find({ userId: { $in: selectedIds }, isAvailable: true, profileCompleted: true }).select('userId experienceYears petTypes isAvailable').lean(),
    PetStore.find({ ownerId: { $in: selectedIds }, isActive: true, isPublic: true }).select('ownerId _id name logo address phone').lean(),
  ]);
  const vetMap = new Map(vetProfiles.map((profile) => [String(profile.userId), profile]));
  const sitterMap = new Map(sitterProfiles.map((profile) => [String(profile.userId), profile]));
  const storeMap = new Map(stores.map((store) => [String(store.ownerId), store]));
  const includes = (value, search) => !search || String(value || '').toLowerCase().includes(String(search).trim().toLowerCase());
  const matchesLocation = (address = {}) => includes(address.city, options.city)
    && includes(address.state, options.province)
    && includes(address.zip, options.postalCode);
  const providers = activeOfferings.flatMap((offering) => {
    const user = userMap.get(String(offering.providerId));
    if (!user) return [];
    if (user.role === USER_ROLES.VETERINARIAN && !vetMap.has(String(user._id))) return [];
    if (user.role === USER_ROLES.PET_SITTER && !sitterMap.has(String(user._id))) return [];
    if ([USER_ROLES.PET_STORE, USER_ROLES.PARAPHARMACY].includes(user.role) && !storeMap.has(String(user._id))) return [];
    const store = storeMap.get(String(user._id));
    const profile = vetMap.get(String(user._id)) || sitterMap.get(String(user._id)) || null;
    const address = store?.address || user.address;
    if (!matchesLocation(address)) return [];
    return [{ id: user._id, role: user.role, name: store?.name || user.fullName || user.name, profileImage: store?.logo || user.profileImage, phone: store?.phone || user.phone, address, offering, profile, storeId: store?._id || null }];
  });
  const total = providers.length;
  return { service, providers: providers.slice((page - 1) * limit, page * limit), pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
};

module.exports = { listServices, createService, updateService, deleteService, listMyOfferings, updateMyOfferings, listProviders };
