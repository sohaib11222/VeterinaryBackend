const ChatMessage = require('../models/ChatMessage');
const Conversation = require('../models/Conversation');
const User = require('../models/User');
const Appointment = require('../models/Appointment');
const Notification = require('../models/Notification');
const mongoose = require('mongoose');
const subscriptionPolicy = require('./subscriptionPolicy.service');

/**
 * Check if current time is within appointment window
 */
const isWithinAppointmentWindow = (appointment) => {
  const now = new Date();

  const appointmentDateUTC = appointment.appointmentDate instanceof Date
    ? appointment.appointmentDate
    : new Date(appointment.appointmentDate);

  const baseYear = appointmentDateUTC.getUTCFullYear();
  const baseMonth = appointmentDateUTC.getUTCMonth() + 1;
  const baseDay = appointmentDateUTC.getUTCDate();

  const [startHours, startMinutes] = String(appointment.appointmentTime || '').split(':').map(Number);
  if (!Number.isFinite(startHours) || !Number.isFinite(startMinutes)) {
    return { isValid: false, message: 'Invalid appointment time' };
  }

  const duration = appointment.appointmentDuration || 30;
  const tzOffsetMinutes =
    typeof appointment.timezoneOffset === 'number' && Number.isFinite(appointment.timezoneOffset)
      ? appointment.timezoneOffset
      : null;

  let start;
  if (tzOffsetMinutes !== null) {
    const appointmentDateInTz = new Date(appointmentDateUTC.getTime() + tzOffsetMinutes * 60 * 1000);
    const year = appointmentDateInTz.getUTCFullYear();
    const month = appointmentDateInTz.getUTCMonth();
    const day = appointmentDateInTz.getUTCDate();
    const appointmentStartDateTimeUTC = new Date(Date.UTC(year, month, day, startHours, startMinutes, 0, 0));
    start = new Date(appointmentStartDateTimeUTC.getTime() - tzOffsetMinutes * 60 * 1000);
  } else {
    start = new Date(Date.UTC(baseYear, baseMonth - 1, baseDay, startHours, startMinutes, 0, 0));
  }

  let end;
  if (appointment.appointmentEndTime) {
    const [endHours, endMinutes] = String(appointment.appointmentEndTime || '').split(':').map(Number);
    if (Number.isFinite(endHours) && Number.isFinite(endMinutes)) {
      const startTimeMinutes = startHours * 60 + startMinutes;
      const endTimeMinutes = endHours * 60 + endMinutes;

      let endYear = baseYear;
      let endMonth = baseMonth - 1;
      let endDay = baseDay;

      if (tzOffsetMinutes !== null) {
        const appointmentDateInTz = new Date(appointmentDateUTC.getTime() + tzOffsetMinutes * 60 * 1000);
        endYear = appointmentDateInTz.getUTCFullYear();
        endMonth = appointmentDateInTz.getUTCMonth();
        endDay = appointmentDateInTz.getUTCDate();
      }

      if (endTimeMinutes < startTimeMinutes && startTimeMinutes - endTimeMinutes > 12 * 60) {
        const nextDay = new Date(Date.UTC(endYear, endMonth, endDay + 1));
        endYear = nextDay.getUTCFullYear();
        endMonth = nextDay.getUTCMonth();
        endDay = nextDay.getUTCDate();
      }

      const appointmentEndDateTimeUTC = new Date(Date.UTC(endYear, endMonth, endDay, endHours, endMinutes, 0, 0));
      end = tzOffsetMinutes !== null
        ? new Date(appointmentEndDateTimeUTC.getTime() - tzOffsetMinutes * 60 * 1000)
        : appointmentEndDateTimeUTC;
    }
  }
  if (!end) {
    end = new Date(start.getTime() + duration * 60 * 1000);
  }

  const windowStart = new Date(start.getTime() - 15 * 60 * 1000);
  const windowEnd = new Date(end.getTime() + 30 * 60 * 1000);

  if (now < windowStart) {
    return { isValid: false, message: 'Communication will be available 15 minutes before the appointment time' };
  }

  if (now > windowEnd) {
    return { isValid: false, message: 'Communication window has expired. It was available until 30 minutes after the appointment end time.' };
  }

  return { isValid: true };
};

/**
 * Send message
 */
const sendMessage = async (data) => {
  const {
    veterinarianId,
    petOwnerId,
    adminId,
    senderId,
    message,
    type = 'TEXT',
    fileUrl,
    fileName,
    appointmentId,
    attachments,
  } = data;

  const messageText = typeof message === 'string' ? message.trim() : null;
  const normalizedAttachments = Array.isArray(attachments) ? attachments.filter(Boolean) : [];
  const primaryAttachment = normalizedAttachments.length > 0 ? normalizedAttachments[0] : null;
  const resolvedFileUrl = fileUrl || primaryAttachment?.url || null;
  const resolvedFileName = fileName || primaryAttachment?.name || null;

  if (!messageText && normalizedAttachments.length === 0 && !resolvedFileUrl) {
    throw new Error('Message text or at least one attachment is required');
  }

  const isVeterinarianPetOwnerChat = !!petOwnerId && !!appointmentId;
  const isAdminVeterinarianChat = !isVeterinarianPetOwnerChat;

  if (!isAdminVeterinarianChat && !isVeterinarianPetOwnerChat) {
    throw new Error('Either admin-veterinarian or veterinarian-pet owner conversation must be specified');
  }

  const sender = await User.findById(senderId);
  if (!sender) {
    throw new Error('Sender not found');
  }

  if (isAdminVeterinarianChat) {
    const resolvedAdminId = adminId || (await User.findOne({ role: 'ADMIN' }).select('_id').lean())?._id;
    if (!resolvedAdminId) {
      throw new Error('Admin not found');
    }

    const [admin, veterinarian] = await Promise.all([
      User.findById(resolvedAdminId),
      User.findById(veterinarianId)
    ]);

    if (!admin || admin.role !== 'ADMIN') {
      throw new Error('Admin not found');
    }

    if (!veterinarian || veterinarian.role !== 'VETERINARIAN') {
      throw new Error('Veterinarian not found');
    }

    if (senderId !== resolvedAdminId.toString() && senderId !== veterinarianId) {
      throw new Error('Sender must be either admin or veterinarian');
    }

    let conversation = await Conversation.findOne({
      adminId: resolvedAdminId,
      veterinarianId,
      conversationType: 'ADMIN_VETERINARIAN'
    });

    if (!conversation) {
      conversation = await Conversation.create({
        adminId: resolvedAdminId,
        veterinarianId,
        conversationType: 'ADMIN_VETERINARIAN',
        lastMessageAt: new Date()
      });
    } else {
      conversation.lastMessageAt = new Date();
      conversation.lastMessage = {
        message: messageText || (resolvedFileName ? `File: ${resolvedFileName}` : ''),
        sentAt: new Date(),
        sentBy: senderId
      };
      if (!conversation.lastMessage.readBy) {
        conversation.lastMessage.readBy = [];
      }
      if (!conversation.lastMessage.readBy.includes(senderId)) {
        conversation.lastMessage.readBy.push(senderId);
      }
      await conversation.save();
    }

    const chatMessage = await ChatMessage.create({
      conversationId: conversation._id,
      senderId,
      message: messageText || null,
      type,
      attachments: normalizedAttachments,
      fileUrl: resolvedFileUrl,
      fileName: resolvedFileName
    });

    // Update conversation unread count
    if (senderId === resolvedAdminId.toString()) {
      conversation.unreadCount = (conversation.unreadCount || 0) + 1;
    } else {
      conversation.unreadCount = 0; // Veterinarian read their own message
    }
    await conversation.save();

    // Send notification
    if (senderId === resolvedAdminId.toString()) {
      await Notification.create({
        userId: veterinarianId,
        title: 'New Message from Admin',
        body: messageText
          ? (messageText.length > 100 ? messageText.substring(0, 100) + '...' : messageText)
          : (resolvedFileName ? `File: ${resolvedFileName}` : 'You have a new message'),
        type: 'CHAT',
        data: {
          conversationId: conversation._id.toString(),
          messageId: chatMessage._id.toString()
        }
      });
    }

    return chatMessage;
  } else {
    // Veterinarian-Pet Owner conversation
    const [veterinarian, petOwner] = await Promise.all([
      User.findById(veterinarianId),
      User.findById(petOwnerId)
    ]);

    if (!veterinarian || veterinarian.role !== 'VETERINARIAN') {
      throw new Error('Veterinarian not found');
    }

    if (!petOwner || petOwner.role !== 'PET_OWNER') {
      throw new Error('Pet owner not found');
    }

    if (senderId !== veterinarianId && senderId !== petOwnerId) {
      throw new Error('Sender must be either veterinarian or pet owner');
    }

    if (!appointmentId) {
      throw new Error('Appointment ID is required for veterinarian-pet owner communication');
    }

    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) {
      throw new Error('Appointment not found');
    }

    if (appointment.veterinarianId.toString() !== veterinarianId || appointment.petOwnerId.toString() !== petOwnerId) {
      throw new Error('Appointment does not match the provided veterinarian and pet owner');
    }

    if (appointment.status !== 'CONFIRMED') {
      throw new Error('Appointment must be confirmed before communication can begin');
    }

    const timeWindowCheck = isWithinAppointmentWindow(appointment);
    if (!timeWindowCheck.isValid) {
      throw new Error(timeWindowCheck.message);
    }

    let conversation = await Conversation.findOne({
      veterinarianId,
      petOwnerId,
      appointmentId: appointment._id,
      conversationType: 'VETERINARIAN_PET_OWNER'
    });

    if (!conversation) {
      await subscriptionPolicy.enforceChatStartLimit({ veterinarianId });

      conversation = await Conversation.create({
        veterinarianId,
        petOwnerId,
        appointmentId: appointment._id,
        conversationType: 'VETERINARIAN_PET_OWNER',
        lastMessageAt: new Date()
      });
    }

    conversation.lastMessageAt = new Date();
    conversation.lastMessage = {
      message: messageText || (resolvedFileName ? `File: ${resolvedFileName}` : ''),
      sentAt: new Date(),
      sentBy: senderId,
      readBy: conversation.lastMessage?.readBy || []
    };
    if (!conversation.lastMessage.readBy.includes(senderId)) {
      conversation.lastMessage.readBy.push(senderId);
    }
    await conversation.save();

    const chatMessage = await ChatMessage.create({
      conversationId: conversation._id,
      senderId,
      message: messageText || null,
      type,
      attachments: normalizedAttachments,
      fileUrl: resolvedFileUrl,
      fileName: resolvedFileName
    });

    // Update unread count
    if (senderId === veterinarianId) {
      conversation.unreadCount = (conversation.unreadCount || 0) + 1;
    } else {
      conversation.unreadCount = 0;
    }
    await conversation.save();

    return chatMessage;
  }
};

/**
 * Get messages for conversation
 */
const getMessages = async (conversationId, options = {}) => {
  const { page = 1, limit = 50 } = options;
  const skip = (page - 1) * limit;

  const conversation = await Conversation.findById(conversationId)
    .maxTimeMS(2000);
  if (!conversation) {
    throw new Error('Conversation not found');
  }

  const [messagesRaw, total] = await Promise.all([
    ChatMessage.find({ conversationId })
      .lean()
      .maxTimeMS(3000)
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 }),
    ChatMessage.countDocuments({ conversationId }).maxTimeMS(2000)
  ]);

  // Populate separately for better performance
  const senderIds = [...new Set(messagesRaw.map(m => m.senderId?.toString()).filter(Boolean))];
  const senders = senderIds.length > 0 ? await User.find({ _id: { $in: senderIds } })
    .select('name email profileImage role')
    .lean()
    .maxTimeMS(2000) : [];

  const senderMap = {};
  senders.forEach(s => { senderMap[s._id.toString()] = s; });

  const messages = messagesRaw.map(m => ({
    ...m,
    senderId: m.senderId ? senderMap[m.senderId.toString()] : null
  }));

  return {
    messages: messages.reverse(),
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };
};

/**
 * Get or create conversation
 */
const getOrCreateConversation = async (veterinarianId, petOwnerId, adminId, appointmentId) => {
  const isVeterinarianPetOwnerChat = !!petOwnerId && !!appointmentId;
  const isAdminVeterinarianChat = !isVeterinarianPetOwnerChat;

  if (!isAdminVeterinarianChat && !isVeterinarianPetOwnerChat) {
    throw new Error('Either admin-veterinarian or veterinarian-pet owner conversation must be specified');
  }

  if (isAdminVeterinarianChat) {
    const resolvedAdminId = adminId || (await User.findOne({ role: 'ADMIN' }).select('_id').lean())?._id;
    if (!resolvedAdminId) {
      throw new Error('Admin not found');
    }

    const [admin, veterinarian] = await Promise.all([
      User.findById(resolvedAdminId),
      User.findById(veterinarianId)
    ]);

    if (!admin || admin.role !== 'ADMIN') {
      throw new Error('Admin not found');
    }

    if (!veterinarian || veterinarian.role !== 'VETERINARIAN') {
      throw new Error('Veterinarian not found');
    }

    let conversation = await Conversation.findOne({
      adminId: resolvedAdminId,
      veterinarianId,
      conversationType: 'ADMIN_VETERINARIAN'
    })
      .lean()
      .maxTimeMS(2000);

    if (conversation) {
      // Populate separately
      const [populatedAdmin, populatedVet] = await Promise.all([
        User.findById(conversation.adminId)
          .select('name email phone profileImage')
          .lean()
          .maxTimeMS(1000),
        User.findById(conversation.veterinarianId)
          .select('name email phone profileImage')
          .lean()
          .maxTimeMS(1000)
      ]);
      conversation.adminId = populatedAdmin;
      conversation.veterinarianId = populatedVet;
    }

    if (!conversation) {
      conversation = await Conversation.create({
        adminId: resolvedAdminId,
        veterinarianId,
        conversationType: 'ADMIN_VETERINARIAN',
        lastMessageAt: new Date()
      });
      await conversation.populate('adminId', 'name email phone profileImage');
      await conversation.populate('veterinarianId', 'name email phone profileImage');
    }

    return conversation;
  } else {
    if (!appointmentId) {
      throw new Error('Appointment ID is required for veterinarian-pet owner conversation');
    }

    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) {
      throw new Error('Appointment not found');
    }

    if (appointment.status !== 'CONFIRMED') {
      throw new Error('Appointment must be confirmed before communication can begin');
    }

    const timeWindowCheck = isWithinAppointmentWindow(appointment);
    if (!timeWindowCheck.isValid) {
      throw new Error(timeWindowCheck.message);
    }

    let conversation = await Conversation.findOne({
      veterinarianId,
      petOwnerId,
      appointmentId: appointment._id,
      conversationType: 'VETERINARIAN_PET_OWNER'
    })
      .populate('veterinarianId', 'name email phone profileImage')
      .populate('petOwnerId', 'name email phone profileImage')
      .populate('appointmentId', 'appointmentDate appointmentTime status');

    if (!conversation) {
      await subscriptionPolicy.enforceChatStartLimit({ veterinarianId });

      conversation = await Conversation.create({
        veterinarianId,
        petOwnerId,
        appointmentId: appointment._id,
        conversationType: 'VETERINARIAN_PET_OWNER',
        lastMessageAt: new Date()
      });
      await conversation.populate('veterinarianId', 'name email phone profileImage');
      await conversation.populate('petOwnerId', 'name email phone profileImage');
      await conversation.populate('appointmentId', 'appointmentDate appointmentTime status');
    }

    return conversation;
  }
};

/**
 * Get conversations for user
 */
const getConversations = async (userId, userRole, options = {}) => {
  const { page = 1, limit = 20 } = options;
  const skip = (page - 1) * limit;

  let query = {};

  if (userRole === 'ADMIN') {
    query = { adminId: userId, conversationType: 'ADMIN_VETERINARIAN' };
  } else if (userRole === 'VETERINARIAN') {
    query = {
      $or: [
        { veterinarianId: userId, conversationType: 'ADMIN_VETERINARIAN' },
        { veterinarianId: userId, conversationType: 'VETERINARIAN_PET_OWNER' }
      ]
    };
  } else if (userRole === 'PET_OWNER') {
    query = { petOwnerId: userId, conversationType: 'VETERINARIAN_PET_OWNER' };
  } else {
    throw new Error('Invalid role');
  }

  const [conversationsRaw, total] = await Promise.all([
    Conversation.find(query)
      .lean()
      .maxTimeMS(3000)
      .sort({ lastMessageAt: -1 })
      .skip(skip)
      .limit(limit),
    Conversation.countDocuments(query).maxTimeMS(2000)
  ]);

  // Populate separately for better performance
  const adminIds = [...new Set(conversationsRaw.map(c => c.adminId?.toString()).filter(Boolean))];
  const vetIds = [...new Set(conversationsRaw.map(c => c.veterinarianId?.toString()).filter(Boolean))];
  const ownerIds = [...new Set(conversationsRaw.map(c => c.petOwnerId?.toString()).filter(Boolean))];
  const appointmentIds = [...new Set(conversationsRaw.map(c => c.appointmentId?.toString()).filter(Boolean))];

  const [admins, veterinarians, petOwners, appointments] = await Promise.all([
    adminIds.length > 0 ? User.find({ _id: { $in: adminIds } })
      .select('name email phone profileImage')
      .lean()
      .maxTimeMS(2000) : Promise.resolve([]),
    vetIds.length > 0 ? User.find({ _id: { $in: vetIds } })
      .select('name email phone profileImage')
      .lean()
      .maxTimeMS(2000) : Promise.resolve([]),
    ownerIds.length > 0 ? User.find({ _id: { $in: ownerIds } })
      .select('name email phone profileImage')
      .lean()
      .maxTimeMS(2000) : Promise.resolve([]),
    appointmentIds.length > 0 ? require('../models/Appointment').find({ _id: { $in: appointmentIds } })
      .select('appointmentDate appointmentTime status')
      .lean()
      .maxTimeMS(2000) : Promise.resolve([])
  ]);

  const adminMap = {};
  admins.forEach(a => { adminMap[a._id.toString()] = a; });
  const vetMap = {};
  veterinarians.forEach(v => { vetMap[v._id.toString()] = v; });
  const ownerMap = {};
  petOwners.forEach(o => { ownerMap[o._id.toString()] = o; });
  const appointmentMap = {};
  appointments.forEach(a => { appointmentMap[a._id.toString()] = a; });

  const conversations = conversationsRaw.map(c => ({
    ...c,
    adminId: c.adminId ? adminMap[c.adminId.toString()] : null,
    veterinarianId: c.veterinarianId ? vetMap[c.veterinarianId.toString()] : null,
    petOwnerId: c.petOwnerId ? ownerMap[c.petOwnerId.toString()] : null,
    appointmentId: c.appointmentId ? appointmentMap[c.appointmentId.toString()] : null
  }));

  // Get unread counts for all conversations in one query
  const conversationIds = conversations.map(c => c._id);
  const unreadAggregation = await ChatMessage.aggregate([
    {
      $match: {
        conversationId: { $in: conversationIds },
        senderId: { $ne: new mongoose.Types.ObjectId(userId) },
        'readBy.userId': { $ne: new mongoose.Types.ObjectId(userId) }
      }
    },
    {
      $group: {
        _id: '$conversationId',
        count: { $sum: 1 }
      }
    }
  ]).option({ maxTimeMS: 2000 });

  const unreadMap = {};
  unreadAggregation.forEach(u => {
    unreadMap[u._id.toString()] = u.count;
  });

  const conversationsWithUnread = conversations.map(conversation => ({
    ...conversation,
    unreadCount: unreadMap[conversation._id.toString()] || 0
  }));

  return {
    conversations: conversationsWithUnread,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };
};

/**
 * Mark messages as read
 */
const markMessagesAsRead = async (conversationId, userId) => {
  const conversation = await Conversation.findById(conversationId);
  if (!conversation) {
    throw new Error('Conversation not found');
  }

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new Error('Invalid user ID');
  }

  const userObjectId = new mongoose.Types.ObjectId(userId);

  const result = await ChatMessage.updateMany(
    {
      conversationId,
      senderId: { $ne: userObjectId },
      'readBy.userId': { $ne: userObjectId }
    },
    {
      $addToSet: { readBy: { userId: userObjectId, readAt: new Date() } }
    }
  );

  // Update conversation unread count
  conversation.unreadCount = 0;
  if (conversation.lastMessage && !conversation.lastMessage.readBy.includes(userId)) {
    conversation.lastMessage.readBy.push(userId);
  }
  await conversation.save();

  return { updatedCount: result.modifiedCount };
};

/**
 * Get unread message count
 */
const getUnreadCount = async (userId, userRole) => {
  let conversationQuery = {};

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return 0;
  }

  const userObjectId = new mongoose.Types.ObjectId(userId);

  if (userRole === 'ADMIN') {
    conversationQuery = { adminId: userId, conversationType: 'ADMIN_VETERINARIAN' };
  } else if (userRole === 'VETERINARIAN') {
    conversationQuery = {
      $or: [
        { veterinarianId: userId, conversationType: 'ADMIN_VETERINARIAN' },
        { veterinarianId: userId, conversationType: 'VETERINARIAN_PET_OWNER' }
      ]
    };
  } else if (userRole === 'PET_OWNER') {
    conversationQuery = { petOwnerId: userId, conversationType: 'VETERINARIAN_PET_OWNER' };
  } else {
    return 0;
  }

  const conversations = await Conversation.find(conversationQuery).select('_id');
  const conversationIds = conversations.map(c => c._id);

  const unreadCount = await ChatMessage.countDocuments({
    conversationId: { $in: conversationIds },
    senderId: { $ne: userObjectId },
    'readBy.userId': { $ne: userObjectId }
  });

  return unreadCount;
};

module.exports = {
  sendMessage,
  getMessages,
  getOrCreateConversation,
  getConversations,
  markMessagesAsRead,
  getUnreadCount
};
