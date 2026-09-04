const { ContactQuery, CONTACT_QUERY_STATUSES } = require('../models/ContactQuery');
const { validateObjectId } = require('../utils/validation');

const escapeRegex = (value) => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const validateContactPayload = (data = {}) => {
  const payload = {
    name: String(data.name || '').trim(),
    email: String(data.email || '').trim().toLowerCase(),
    phone: String(data.phone || '').trim(),
    services: String(data.services || '').trim(),
    message: String(data.message || '').trim(),
  };

  if (payload.name.length < 2 || payload.name.length > 120) throw new Error('Name must be between 2 and 120 characters');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) throw new Error('A valid email address is required');
  if (payload.phone.length < 3 || payload.phone.length > 60) throw new Error('A valid phone number is required');
  if (!payload.services || payload.services.length > 160) throw new Error('Please provide the service you need');
  if (!payload.message || payload.message.length > 5000) throw new Error('Message must be between 1 and 5000 characters');

  return payload;
};

const createContactQuery = async (data) => ContactQuery.create(validateContactPayload(data));

const listContactQueries = async (options = {}) => {
  const page = Math.max(Number.parseInt(options.page, 10) || 1, 1);
  const limit = Math.min(Math.max(Number.parseInt(options.limit, 10) || 10, 1), 100);
  const query = {};

  if (options.status) {
    const status = String(options.status).toUpperCase();
    if (!CONTACT_QUERY_STATUSES.includes(status)) throw new Error('Invalid contact query status');
    query.status = status;
  }

  const search = String(options.search || '').trim();
  if (search) {
    const pattern = new RegExp(escapeRegex(search), 'i');
    query.$or = [
      { name: pattern },
      { email: pattern },
      { phone: pattern },
      { services: pattern },
      { message: pattern },
    ];
  }

  const [queries, total] = await Promise.all([
    ContactQuery.find(query)
      .populate('resolvedBy', 'name email')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean()
      .maxTimeMS(3000),
    ContactQuery.countDocuments(query).maxTimeMS(3000),
  ]);

  return {
    queries,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  };
};

const getContactQuery = async (id) => {
  validateObjectId(id, 'Contact query ID');
  const query = await ContactQuery.findById(id)
    .populate('resolvedBy', 'name email')
    .lean()
    .maxTimeMS(3000);
  if (!query) throw new Error('Contact query not found');
  return query;
};

const updateContactQuery = async (id, data = {}, adminId) => {
  validateObjectId(id, 'Contact query ID');
  const update = {};

  if (data.status !== undefined) {
    const status = String(data.status).toUpperCase();
    if (!CONTACT_QUERY_STATUSES.includes(status)) throw new Error('Invalid contact query status');
    update.status = status;
    if (['RESOLVED', 'CLOSED'].includes(status)) {
      update.resolvedAt = new Date();
      update.resolvedBy = adminId;
    } else {
      update.resolvedAt = null;
      update.resolvedBy = null;
    }
  }

  if (data.adminNotes !== undefined) {
    const notes = String(data.adminNotes || '').trim();
    if (notes.length > 5000) throw new Error('Admin notes are too long');
    update.adminNotes = notes;
  }

  const query = await ContactQuery.findByIdAndUpdate(id, { $set: update }, { new: true, runValidators: true })
    .populate('resolvedBy', 'name email')
    .lean()
    .maxTimeMS(3000);
  if (!query) throw new Error('Contact query not found');
  return query;
};

const deleteContactQuery = async (id) => {
  validateObjectId(id, 'Contact query ID');
  const deleted = await ContactQuery.findByIdAndDelete(id).lean().maxTimeMS(3000);
  if (!deleted) throw new Error('Contact query not found');
  return { id: deleted._id };
};

module.exports = {
  createContactQuery,
  listContactQueries,
  getContactQuery,
  updateContactQuery,
  deleteContactQuery,
};
