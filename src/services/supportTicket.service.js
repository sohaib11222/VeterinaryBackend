const fs = require('fs');
const path = require('path');

const SupportTicket = require('../models/SupportTicket');
const SupportTicketMessage = require('../models/SupportTicketMessage');
const SupportTicketAttachment = require('../models/SupportTicketAttachment');
const SupportTicketActivity = require('../models/SupportTicketActivity');
const Appointment = require('../models/Appointment');
const Order = require('../models/Order');
const Transaction = require('../models/Transaction');
const ProductPrescriptionRequest = require('../models/ProductPrescriptionRequest');
const User = require('../models/User');
const { createNotification } = require('./notification.service');
const { isValidObjectId } = require('../utils/validation');

const {
  SUPPORT_TICKET_CATEGORIES,
  SUPPORT_TICKET_STATUSES,
  SUPPORT_TICKET_PRIORITIES,
  SUPPORT_RELATED_RECORD_TYPES,
} = SupportTicket;

const MAX_REOPEN_DAYS = 14;

const httpError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const normalizeEnum = (value) => String(value || '').trim().toUpperCase();
const normalizeText = (value) => String(value || '').trim();

const parseAttachmentIds = (value) => {
  const values = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(',')
      : [];
  return [...new Set(values.map((item) => String(item || '').trim()).filter(Boolean))];
};

const createActivity = (ticketId, actorId, type, summary, metadata = null) =>
  SupportTicketActivity.create({ ticketId, actorId: actorId || null, type, summary, metadata });

const notifyAdmins = async ({ title, body, data }) => {
  const admins = await User.find({ role: 'ADMIN', status: { $ne: 'BLOCKED' } })
    .select('_id')
    .lean();
  await Promise.allSettled(admins.map((admin) => createNotification({
    userId: admin._id,
    title,
    body,
    type: 'SUPPORT_TICKET',
    data,
  })));
};

const assertPatient = (role) => {
  if (String(role || '').toUpperCase() !== 'PET_OWNER') {
    throw httpError('Only pet owners can access patient support tickets', 403);
  }
};

const getOwnedRelatedRecord = async (patientId, type, recordId) => {
  if (!type && !recordId) return null;
  if (!type || !recordId) throw httpError('Select both a related record type and record');
  if (!SUPPORT_RELATED_RECORD_TYPES.includes(type)) throw httpError('Unsupported related record type');
  if (!isValidObjectId(recordId)) throw httpError('Invalid related record');

  let record = null;
  if (type === 'APPOINTMENT') record = await Appointment.findOne({ _id: recordId, petOwnerId: patientId }).select('_id').lean();
  if (type === 'ORDER') record = await Order.findOne({ _id: recordId, petOwnerId: patientId }).select('_id').lean();
  if (type === 'TRANSACTION') record = await Transaction.findOne({ _id: recordId, userId: patientId }).select('_id').lean();
  if (type === 'PRESCRIPTION') record = await ProductPrescriptionRequest.findOne({ _id: recordId, petOwnerId: patientId }).select('_id').lean();

  if (type === 'OTHER') return { type, recordId: null };
  if (!record) throw httpError('The selected related record was not found', 404);
  return { type, recordId: record._id };
};

const claimAttachments = async (attachmentIds, userId, ticketId) => {
  if (!attachmentIds.length) return [];
  if (!attachmentIds.every(isValidObjectId)) throw httpError('One or more attachments are invalid');
  const attachments = await SupportTicketAttachment.find({
    _id: { $in: attachmentIds },
    uploadedBy: userId,
    ticketId: null,
  });
  if (attachments.length !== attachmentIds.length) {
    throw httpError('One or more attachments are unavailable');
  }
  await SupportTicketAttachment.updateMany(
    { _id: { $in: attachmentIds }, uploadedBy: userId, ticketId: null },
    { $set: { ticketId } },
  );
  return attachmentIds;
};

const attachmentDto = (attachment) => ({
  _id: attachment._id,
  name: attachment.originalName,
  mimeType: attachment.mimeType,
  size: attachment.size,
  createdAt: attachment.createdAt,
  downloadUrl: `/api/support-tickets/attachments/${attachment._id}/download`,
});

const hydrateTicket = async (ticketId) => {
  const ticket = await SupportTicket.findById(ticketId)
    .populate('patientId', 'name fullName email phone profileImage')
    .populate('assignedAdminId', 'name fullName email')
    .lean();
  if (!ticket) return null;

  const [messages, activities] = await Promise.all([
    SupportTicketMessage.find({ ticketId })
      .populate('senderId', 'name fullName email profileImage role')
      .populate('attachments')
      .sort({ createdAt: 1 })
      .lean(),
    SupportTicketActivity.find({ ticketId })
      .populate('actorId', 'name fullName email role')
      .sort({ createdAt: 1 })
      .lean(),
  ]);

  return {
    ...ticket,
    messages: messages.map((message) => ({
      ...message,
      attachments: (message.attachments || []).map(attachmentDto),
    })),
    activities,
  };
};

const formatTicketList = (ticket) => ({
  ...ticket,
  latestResponse: ticket.lastMessageAt || ticket.updatedAt,
});

const listPatientTickets = async (patientId, role, options = {}) => {
  assertPatient(role);
  const page = Math.max(1, Number(options.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(options.limit) || 20));
  const query = { patientId };
  const status = normalizeEnum(options.status);
  const category = normalizeEnum(options.category);
  const priority = normalizeEnum(options.priority);
  const search = normalizeText(options.search);

  if (SUPPORT_TICKET_STATUSES.includes(status)) query.status = status;
  if (SUPPORT_TICKET_CATEGORIES.includes(category)) query.category = category;
  if (SUPPORT_TICKET_PRIORITIES.includes(priority)) query.priority = priority;
  if (search) query.$or = [
    { ticketNumber: { $regex: search, $options: 'i' } },
    { subject: { $regex: search, $options: 'i' } },
  ];

  const [tickets, total] = await Promise.all([
    SupportTicket.find(query).sort({ lastMessageAt: -1, updatedAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    SupportTicket.countDocuments(query),
  ]);
  return { tickets: tickets.map(formatTicketList), pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
};

const getPatientTicket = async (ticketId, patientId, role) => {
  assertPatient(role);
  if (!isValidObjectId(ticketId)) throw httpError('Invalid support ticket');
  const exists = await SupportTicket.exists({ _id: ticketId, patientId });
  if (!exists) throw httpError('Support ticket not found', 404);
  const detail = await hydrateTicket(ticketId);
  if (detail.unreadForPatient) {
    await SupportTicket.findByIdAndUpdate(ticketId, { $set: { unreadForPatient: false } });
    detail.unreadForPatient = false;
  }
  return detail;
};

const createPatientTicket = async (patientId, role, payload = {}) => {
  assertPatient(role);
  const subject = normalizeText(payload.subject);
  const description = normalizeText(payload.description);
  const category = normalizeEnum(payload.category);
  const requestedPriority = normalizeEnum(payload.priority);
  const attachmentIds = parseAttachmentIds(payload.attachments);

  if (subject.length < 4 || subject.length > 180) throw httpError('Subject must be between 4 and 180 characters');
  if (description.length < 10 || description.length > 8000) throw httpError('Description must be between 10 and 8000 characters');
  if (!SUPPORT_TICKET_CATEGORIES.includes(category)) throw httpError('Select a valid support category');
  const relatedRecord = await getOwnedRelatedRecord(patientId, normalizeEnum(payload.relatedRecord?.type), payload.relatedRecord?.recordId);
  const ticket = await SupportTicket.create({
    ticketNumber: await SupportTicket.createTicketNumber(),
    patientId,
    subject,
    category,
    priority: SUPPORT_TICKET_PRIORITIES.includes(requestedPriority) ? requestedPriority : 'MEDIUM',
    description,
    relatedRecord: relatedRecord || { type: null, recordId: null },
    lastMessageAt: new Date(),
    unreadForAdmin: true,
  });

  const attachments = await claimAttachments(attachmentIds, patientId, ticket._id);
  await SupportTicketMessage.create({
    ticketId: ticket._id,
    senderId: patientId,
    senderRole: 'PET_OWNER',
    body: description,
    attachments,
  });
  await createActivity(ticket._id, patientId, 'CREATED', `Ticket ${ticket.ticketNumber} was created`);
  if (attachments.length) await createActivity(ticket._id, patientId, 'ATTACHMENTS_ADDED', `${attachments.length} attachment${attachments.length === 1 ? '' : 's'} added`);
  await notifyAdmins({
    title: `New support ticket ${ticket.ticketNumber}`,
    body: subject,
    data: { ticketId: ticket._id.toString(), ticketNumber: ticket.ticketNumber, category },
  });
  return hydrateTicket(ticket._id);
};

const assertTicketReplyAllowed = (ticket) => {
  if (ticket.status === 'CLOSED') throw httpError('This support ticket is closed');
  if (ticket.status === 'RESOLVED') throw httpError('Reopen this resolved ticket before sending a reply');
};

const addPatientMessage = async (ticketId, patientId, role, payload = {}) => {
  assertPatient(role);
  if (!isValidObjectId(ticketId)) throw httpError('Invalid support ticket');
  const ticket = await SupportTicket.findOne({ _id: ticketId, patientId });
  if (!ticket) throw httpError('Support ticket not found', 404);
  assertTicketReplyAllowed(ticket);
  const body = normalizeText(payload.body);
  const attachmentIds = parseAttachmentIds(payload.attachments);
  if (!body && !attachmentIds.length) throw httpError('Write a message or attach a file');
  if (body.length > 8000) throw httpError('Message is too long');

  const attachments = await claimAttachments(attachmentIds, patientId, ticket._id);
  const previousStatus = ticket.status;
  if (ticket.status === 'WAITING_FOR_PATIENT') ticket.status = 'IN_PROGRESS';
  ticket.unreadForAdmin = true;
  ticket.unreadForPatient = false;
  ticket.lastMessageAt = new Date();
  await ticket.save();
  const message = await SupportTicketMessage.create({ ticketId: ticket._id, senderId: patientId, senderRole: 'PET_OWNER', body: body || null, attachments });
  await createActivity(ticket._id, patientId, 'PATIENT_REPLIED', 'Patient sent a reply');
  if (previousStatus !== ticket.status) await createActivity(ticket._id, patientId, 'STATUS_CHANGED', 'Status changed to In Progress', { from: previousStatus, to: ticket.status });
  if (attachments.length) await createActivity(ticket._id, patientId, 'ATTACHMENTS_ADDED', `${attachments.length} attachment${attachments.length === 1 ? '' : 's'} added`);
  await notifyAdmins({
    title: `Patient replied to ${ticket.ticketNumber}`,
    body: ticket.subject,
    data: { ticketId: ticket._id.toString(), ticketNumber: ticket.ticketNumber },
  });
  return message;
};

const reopenPatientTicket = async (ticketId, patientId, role) => {
  assertPatient(role);
  if (!isValidObjectId(ticketId)) throw httpError('Invalid support ticket');
  const ticket = await SupportTicket.findOne({ _id: ticketId, patientId });
  if (!ticket) throw httpError('Support ticket not found', 404);
  if (ticket.status !== 'RESOLVED') throw httpError('Only resolved tickets can be reopened');
  if (!ticket.resolvedAt || Date.now() - new Date(ticket.resolvedAt).getTime() > MAX_REOPEN_DAYS * 86400000) {
    throw httpError('This ticket can no longer be reopened');
  }
  ticket.status = 'OPEN';
  ticket.resolvedAt = null;
  ticket.unreadForAdmin = true;
  ticket.lastMessageAt = new Date();
  await ticket.save();
  await createActivity(ticket._id, patientId, 'REOPENED', 'Patient reopened the ticket');
  await notifyAdmins({
    title: `Ticket ${ticket.ticketNumber} reopened`,
    body: ticket.subject,
    data: { ticketId: ticket._id.toString(), ticketNumber: ticket.ticketNumber },
  });
  return ticket;
};

const getPatientUnreadCount = async (patientId, role) => {
  assertPatient(role);
  const unreadCount = await SupportTicket.countDocuments({ patientId, unreadForPatient: true });
  return { unreadCount };
};

const listAdminTickets = async (options = {}) => {
  const page = Math.max(1, Number(options.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(options.limit) || 20));
  const query = {};
  const status = normalizeEnum(options.status);
  const category = normalizeEnum(options.category);
  const priority = normalizeEnum(options.priority);
  const patientId = String(options.patientId || '').trim();
  const search = normalizeText(options.search);
  if (SUPPORT_TICKET_STATUSES.includes(status)) query.status = status;
  if (SUPPORT_TICKET_CATEGORIES.includes(category)) query.category = category;
  if (SUPPORT_TICKET_PRIORITIES.includes(priority)) query.priority = priority;
  if (isValidObjectId(patientId)) query.patientId = patientId;
  if (search) query.$or = [{ ticketNumber: { $regex: search, $options: 'i' } }, { subject: { $regex: search, $options: 'i' } }];
  const [tickets, total] = await Promise.all([
    SupportTicket.find(query)
      .populate('patientId', 'name fullName email profileImage')
      .populate('assignedAdminId', 'name fullName email')
      .sort({ unreadForAdmin: -1, lastMessageAt: -1, updatedAt: -1 })
      .skip((page - 1) * limit).limit(limit).lean(),
    SupportTicket.countDocuments(query),
  ]);
  return { tickets: tickets.map(formatTicketList), pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
};

const getAdminTicket = async (ticketId) => {
  if (!isValidObjectId(ticketId)) throw httpError('Invalid support ticket');
  const ticket = await SupportTicket.findById(ticketId);
  if (!ticket) throw httpError('Support ticket not found', 404);
  if (ticket.unreadForAdmin) {
    ticket.unreadForAdmin = false;
    await ticket.save();
  }
  return hydrateTicket(ticketId);
};

const updateAdminTicket = async (ticketId, adminId, payload = {}) => {
  if (!isValidObjectId(ticketId)) throw httpError('Invalid support ticket');
  const ticket = await SupportTicket.findById(ticketId);
  if (!ticket) throw httpError('Support ticket not found', 404);
  const tasks = [];
  const status = normalizeEnum(payload.status);
  const priority = normalizeEnum(payload.priority);
  if (status && !SUPPORT_TICKET_STATUSES.includes(status)) throw httpError('Invalid ticket status');
  if (priority && !SUPPORT_TICKET_PRIORITIES.includes(priority)) throw httpError('Invalid ticket priority');
  if (status && status !== ticket.status) {
    const previous = ticket.status;
    ticket.status = status;
    ticket.resolvedAt = status === 'RESOLVED' ? new Date() : null;
    ticket.closedAt = status === 'CLOSED' ? new Date() : null;
    tasks.push(createActivity(ticket._id, adminId, 'STATUS_CHANGED', `Status changed to ${status.replace(/_/g, ' ')}`, { from: previous, to: status }));
  }
  if (priority && priority !== ticket.priority) {
    const previous = ticket.priority;
    ticket.priority = priority;
    tasks.push(createActivity(ticket._id, adminId, 'PRIORITY_CHANGED', `Priority changed to ${priority}`, { from: previous, to: priority }));
  }
  if (payload.assignedAdminId !== undefined) {
    const assignedAdminId = String(payload.assignedAdminId || '').trim();
    if (assignedAdminId && !isValidObjectId(assignedAdminId)) throw httpError('Invalid assigned admin');
    if (assignedAdminId) {
      const assignee = await User.findOne({ _id: assignedAdminId, role: 'ADMIN' }).select('_id').lean();
      if (!assignee) throw httpError('Assigned user must be an admin');
    }
    if (String(ticket.assignedAdminId || '') !== assignedAdminId) {
      ticket.assignedAdminId = assignedAdminId || null;
      tasks.push(createActivity(ticket._id, adminId, 'ASSIGNED', assignedAdminId ? 'Ticket was assigned to an admin' : 'Ticket assignment cleared'));
    }
  }
  if (tasks.length) {
    ticket.lastMessageAt = ticket.lastMessageAt || new Date();
    await ticket.save();
    await Promise.all(tasks);
    await createNotification({
      userId: ticket.patientId,
      title: `Support ticket ${ticket.ticketNumber} updated`,
      body: `Its status is now ${ticket.status.replace(/_/g, ' ').toLowerCase()}.`,
      type: 'SUPPORT_TICKET',
      data: { ticketId: ticket._id.toString(), ticketNumber: ticket.ticketNumber },
    });
  }
  return hydrateTicket(ticket._id);
};

const addAdminMessage = async (ticketId, adminId, payload = {}) => {
  if (!isValidObjectId(ticketId)) throw httpError('Invalid support ticket');
  const ticket = await SupportTicket.findById(ticketId);
  if (!ticket) throw httpError('Support ticket not found', 404);
  assertTicketReplyAllowed(ticket);
  const body = normalizeText(payload.body);
  const attachmentIds = parseAttachmentIds(payload.attachments);
  if (!body && !attachmentIds.length) throw httpError('Write a message or attach a file');
  if (body.length > 8000) throw httpError('Message is too long');
  const attachments = await claimAttachments(attachmentIds, adminId, ticket._id);
  const previousStatus = ticket.status;
  if (ticket.status === 'OPEN' || ticket.status === 'IN_PROGRESS') ticket.status = 'WAITING_FOR_PATIENT';
  ticket.unreadForPatient = true;
  ticket.unreadForAdmin = false;
  ticket.lastMessageAt = new Date();
  await ticket.save();
  const message = await SupportTicketMessage.create({ ticketId: ticket._id, senderId: adminId, senderRole: 'ADMIN', body: body || null, attachments });
  await createActivity(ticket._id, adminId, 'ADMIN_REPLIED', 'Admin sent a reply');
  if (previousStatus !== ticket.status) await createActivity(ticket._id, adminId, 'STATUS_CHANGED', 'Status changed to Waiting for Patient', { from: previousStatus, to: ticket.status });
  if (attachments.length) await createActivity(ticket._id, adminId, 'ATTACHMENTS_ADDED', `${attachments.length} attachment${attachments.length === 1 ? '' : 's'} added`);
  await createNotification({
    userId: ticket.patientId,
    title: `Admin replied to support ticket ${ticket.ticketNumber}`,
    body: ticket.subject,
    type: 'SUPPORT_TICKET',
    data: { ticketId: ticket._id.toString(), ticketNumber: ticket.ticketNumber },
  });
  return message;
};

const createUploadedAttachments = async (files, userId) => {
  if (!files?.length) throw httpError('Select at least one attachment');
  return SupportTicketAttachment.insertMany(files.map((file) => ({
    uploadedBy: userId,
    originalName: file.originalname,
    storedName: path.basename(file.filename),
    mimeType: file.mimetype || 'application/octet-stream',
    size: file.size || 0,
  })));
};

const getAttachmentFile = async (attachmentId, userId, role) => {
  if (!isValidObjectId(attachmentId)) throw httpError('Invalid attachment');
  const attachment = await SupportTicketAttachment.findById(attachmentId).lean();
  if (!attachment || !attachment.ticketId) throw httpError('Attachment not found', 404);
  const ticket = await SupportTicket.findById(attachment.ticketId).select('patientId').lean();
  if (!ticket) throw httpError('Attachment not found', 404);
  const isAdmin = String(role || '').toUpperCase() === 'ADMIN';
  if (!isAdmin && String(ticket.patientId) !== String(userId)) throw httpError('You cannot access this attachment', 403);
  const filePath = path.join(process.cwd(), 'uploads', 'support-tickets', path.basename(attachment.storedName));
  if (!fs.existsSync(filePath)) throw httpError('Attachment file is unavailable', 404);
  return { attachment, filePath };
};

const getAdminUnreadCount = async () => {
  const unreadCount = await SupportTicket.countDocuments({ unreadForAdmin: true });
  return { unreadCount };
};

module.exports = {
  SUPPORT_TICKET_CATEGORIES,
  SUPPORT_TICKET_STATUSES,
  SUPPORT_TICKET_PRIORITIES,
  listPatientTickets,
  getPatientTicket,
  createPatientTicket,
  addPatientMessage,
  reopenPatientTicket,
  getPatientUnreadCount,
  listAdminTickets,
  getAdminTicket,
  updateAdminTicket,
  addAdminMessage,
  createUploadedAttachments,
  getAttachmentFile,
  getAdminUnreadCount,
  attachmentDto,
};
