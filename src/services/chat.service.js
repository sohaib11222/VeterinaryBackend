const ChatMessage = require('../models/ChatMessage');
const Conversation = require('../models/Conversation');
const User = require('../models/User');
const Appointment = require('../models/Appointment');
const Notification = require('../models/Notification');
const mongoose = require('mongoose');
const subscriptionPolicy = require('./subscriptionPolicy.service');
const { getAppointmentStart } = require('../utils/appointmentTime');

const ADMIN_SUPPORT_CONVERSATION_TYPES = {
  VETERINARIAN: 'ADMIN_VETERINARIAN',
  PET_STORE: 'ADMIN_PET_STORE',
  PARAPHARMACY: 'ADMIN_PARAPHARMACY',
};

const ALL_ADMIN_SUPPORT_CONVERSATION_TYPES = Object.values(ADMIN_SUPPORT_CONVERSATION_TYPES);

const getAdminSupportTypeForRole = (role) => ADMIN_SUPPORT_CONVERSATION_TYPES[String(role || '').toUpperCase()] || null;

/**
 * Veterinary appointment chats open exactly at the appointment start and stay
 * open until the assigned veterinarian explicitly completes the conversation.
 */
const assertAppointmentChatHasStarted = (appointment) => {
  const start = getAppointmentStart(appointment);
  if (new Date() < start) {
    throw new Error('Chat will be available when the appointment time starts.');
  }
};

const sameId = (left, right) => String(left || '') === String(right || '');

const assertConversationParticipant = (conversation, userId) => {
  const participantIds = [conversation.veterinarianId, conversation.petOwnerId, conversation.adminId, conversation.businessId]
    .filter(Boolean)
    .map((id) => String(id));

  if (!participantIds.includes(String(userId))) {
    throw new Error('You do not have access to this conversation');
  }
};

/**
 * Resolve and validate the non-admin participant for an admin support chat.
 * Veterinarians retain their existing field/type; Pharmacy and Parapharmacy
 * users use businessId and role-derived types so a caller cannot place a chat
 * in the wrong Admin filter by supplying a role in the request body.
 */
const resolveAdminSupportParticipant = async ({ adminId, veterinarianId, businessId, actorId = null }) => {
  if (Boolean(veterinarianId) === Boolean(businessId)) {
    throw new Error('Exactly one admin support participant must be specified');
  }

  const participantId = businessId || veterinarianId;
  const participantField = businessId ? 'businessId' : 'veterinarianId';
  const resolvedAdminId = adminId || (await User.findOne({ role: 'ADMIN' }).select('_id').lean())?._id;
  if (!resolvedAdminId) throw new Error('Admin not found');

  const [admin, participant] = await Promise.all([
    User.findById(resolvedAdminId),
    User.findById(participantId),
  ]);

  if (!admin || admin.role !== 'ADMIN') throw new Error('Admin not found');
  if (!participant) throw new Error('Support-chat participant not found');

  const conversationType = getAdminSupportTypeForRole(participant.role);
  if (!conversationType || (businessId && participant.role === 'VETERINARIAN')) {
    throw new Error('This account type cannot use Admin support chat');
  }
  if (veterinarianId && participant.role !== 'VETERINARIAN') {
    throw new Error('Veterinarian not found');
  }
  if (actorId && !sameId(actorId, resolvedAdminId) && !sameId(actorId, participantId)) {
    throw new Error('You do not have access to this conversation');
  }

  return {
    resolvedAdminId,
    participant,
    participantId,
    participantField,
    conversationType,
  };
};

const resolveMergedConversation = async (conversation) => {
  let resolvedConversation = conversation;
  const visitedConversationIds = new Set();

  while (resolvedConversation?.mergedInto) {
    const currentId = String(resolvedConversation._id);
    if (visitedConversationIds.has(currentId)) {
      throw new Error('Conversation merge chain is invalid');
    }
    visitedConversationIds.add(currentId);
    resolvedConversation = await Conversation.findById(resolvedConversation.mergedInto);
  }

  return resolvedConversation;
};

/**
 * A veterinarian and pet owner have one continuous conversation. Older
 * appointment-specific records are soft-merged so their messages remain in
 * the current chat without leaving duplicate rows in the chat list.
 */
const consolidateVeterinarianPetOwnerConversations = async (veterinarianId, petOwnerId, preferredAppointmentId = null) => {
  const conversations = await Conversation.find({
    veterinarianId,
    petOwnerId,
    conversationType: 'VETERINARIAN_PET_OWNER',
    mergedInto: null
  }).sort({ lastMessageAt: -1, updatedAt: -1 });

  if (conversations.length === 0) return null;

  const canonicalConversation =
    conversations.find((conversation) => preferredAppointmentId && sameId(conversation.appointmentId, preferredAppointmentId)) ||
    conversations.find((conversation) => conversation.status !== 'COMPLETED') ||
    conversations[0];

  const duplicateConversations = conversations.filter((conversation) => !sameId(conversation._id, canonicalConversation._id));
  if (duplicateConversations.length === 0) return canonicalConversation;

  const newestConversation = conversations.reduce((newest, conversation) => {
    const newestTime = newest?.lastMessageAt ? new Date(newest.lastMessageAt).getTime() : 0;
    const candidateTime = conversation.lastMessageAt ? new Date(conversation.lastMessageAt).getTime() : 0;
    return candidateTime > newestTime ? conversation : newest;
  }, canonicalConversation);

  const duplicateIds = duplicateConversations.map((conversation) => conversation._id);
  await ChatMessage.updateMany(
    { conversationId: { $in: duplicateIds } },
    { $set: { conversationId: canonicalConversation._id } }
  );
  await Conversation.updateMany(
    { _id: { $in: duplicateIds } },
    { $set: { mergedInto: canonicalConversation._id } }
  );

  if (newestConversation.lastMessageAt &&
      (!canonicalConversation.lastMessageAt || new Date(newestConversation.lastMessageAt) > new Date(canonicalConversation.lastMessageAt))) {
    canonicalConversation.lastMessageAt = newestConversation.lastMessageAt;
    canonicalConversation.lastMessage = newestConversation.lastMessage;
    await canonicalConversation.save();
  }

  return canonicalConversation;
};

const consolidateLegacyConversationsForUser = async (userId, userRole) => {
  if (!mongoose.Types.ObjectId.isValid(userId)) return;
  if (userRole !== 'VETERINARIAN' && userRole !== 'PET_OWNER') return;

  const userObjectId = new mongoose.Types.ObjectId(userId);
  const userMatch = userRole === 'VETERINARIAN'
    ? { veterinarianId: userObjectId }
    : { petOwnerId: userObjectId };

  const duplicateRelationships = await Conversation.aggregate([
    {
      $match: {
        ...userMatch,
        conversationType: 'VETERINARIAN_PET_OWNER',
        mergedInto: null
      }
    },
    {
      $group: {
        _id: { veterinarianId: '$veterinarianId', petOwnerId: '$petOwnerId' },
        count: { $sum: 1 }
      }
    },
    { $match: { count: { $gt: 1 } } },
    { $limit: 50 }
  ]).option({ maxTimeMS: 3000 });

  await Promise.all(duplicateRelationships.map(({ _id: relationship }) =>
    consolidateVeterinarianPetOwnerConversations(relationship.veterinarianId, relationship.petOwnerId)
  ));
};

/**
 * Send message
 */
const sendMessage = async (data) => {
  const {
    veterinarianId,
    petOwnerId,
    adminId,
    businessId,
    senderId,
    message,
    type = 'TEXT',
    fileUrl,
    fileName,
    appointmentId,
    conversationId,
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
  const isAdminSupportChat = !isVeterinarianPetOwnerChat;

  if (!isAdminSupportChat && !isVeterinarianPetOwnerChat) {
    throw new Error('Either an Admin support or veterinarian-pet owner conversation must be specified');
  }

  const sender = await User.findById(senderId);
  if (!sender) {
    throw new Error('Sender not found');
  }

  if (isAdminSupportChat) {
    const {
      resolvedAdminId,
      participant,
      participantId,
      participantField,
      conversationType,
    } = await resolveAdminSupportParticipant({ adminId, veterinarianId, businessId, actorId: senderId });

    if (!sameId(senderId, resolvedAdminId) && !sameId(senderId, participantId)) {
      throw new Error('Sender must be either admin or the support-chat participant');
    }

    const conversationQuery = {
      adminId: resolvedAdminId,
      [participantField]: participantId,
      conversationType,
    };
    let conversation = await Conversation.findOne(conversationQuery);
    if (!conversation) {
      conversation = await Conversation.create({
        ...conversationQuery,
        lastMessageAt: new Date(),
      });
    }

    const sentAt = new Date();
    conversation.lastMessageAt = sentAt;
    conversation.lastMessage = {
      message: messageText || (resolvedFileName ? `File: ${resolvedFileName}` : ''),
      sentAt,
      sentBy: senderId,
      readBy: conversation.lastMessage?.readBy || [],
    };
    if (!conversation.lastMessage.readBy.some((id) => sameId(id, senderId))) {
      conversation.lastMessage.readBy.push(senderId);
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

    // Update conversation unread count for the recipient. A full per-user
    // unread calculation is still used by the list API, this field is kept for
    // older clients and lightweight sidebar indicators.
    if (sameId(senderId, resolvedAdminId)) {
      conversation.unreadCount = (conversation.unreadCount || 0) + 1;
    } else {
      conversation.unreadCount = 0;
    }
    await conversation.save();

    const recipientId = sameId(senderId, resolvedAdminId) ? participantId : resolvedAdminId;
    const participantLabel = participant.role === 'PARAPHARMACY'
      ? 'Parapharmacy'
      : participant.role === 'PET_STORE'
        ? 'Pharmacy'
        : 'Veterinarian';
    await Notification.create({
      userId: recipientId,
      title: sameId(senderId, resolvedAdminId) ? 'New Message from Admin' : `New Message from ${participantLabel}`,
      body: messageText
        ? (messageText.length > 100 ? `${messageText.substring(0, 100)}...` : messageText)
        : (resolvedFileName ? `File: ${resolvedFileName}` : 'You have a new message'),
      type: 'CHAT',
      data: {
        conversationId: conversation._id.toString(),
        messageId: chatMessage._id.toString(),
      },
    });

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

    // This check applies to conversations created by an earlier version too:
    // no appointment chat can be used before its scheduled start time.
    assertAppointmentChatHasStarted(appointment);

    let conversation = null;

    if (conversationId) {
      conversation = await Conversation.findById(conversationId);
      conversation = await resolveMergedConversation(conversation);
      if (!conversation || conversation.conversationType !== 'VETERINARIAN_PET_OWNER') {
        throw new Error('Conversation not found');
      }
      if (
        !sameId(conversation.veterinarianId, veterinarianId) ||
        !sameId(conversation.petOwnerId, petOwnerId)
      ) {
        throw new Error('Conversation does not belong to this veterinarian and pet owner');
      }
    } else {
      conversation = await consolidateVeterinarianPetOwnerConversations(veterinarianId, petOwnerId, appointment._id);
    }

    if (!conversation || !sameId(conversation.appointmentId, appointment._id)) {
      conversation = await getOrCreateConversation(
        veterinarianId,
        petOwnerId,
        null,
        appointment._id,
        senderId
      );
    }

    if (conversation.status === 'COMPLETED') {
      throw new Error('This chat has been marked as completed by the veterinarian. No further messages can be sent.');
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
const getMessages = async (conversationId, userId, options = {}) => {
  const { page = 1, limit = 50 } = options;
  const skip = (page - 1) * limit;

  let conversation = await Conversation.findById(conversationId)
    .maxTimeMS(2000);
  conversation = await resolveMergedConversation(conversation);
  if (!conversation) {
    throw new Error('Conversation not found');
  }
  assertConversationParticipant(conversation, userId);

  const [messagesRaw, total] = await Promise.all([
    ChatMessage.find({ conversationId: conversation._id })
      .lean()
      .maxTimeMS(3000)
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 }),
    ChatMessage.countDocuments({ conversationId: conversation._id }).maxTimeMS(2000)
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
const getOrCreateConversation = async (
  veterinarianId,
  petOwnerId,
  adminId,
  appointmentId,
  actorId = null,
  businessId = null
) => {
  const isVeterinarianPetOwnerChat = !!petOwnerId && !!appointmentId;
  const isAdminSupportChat = !isVeterinarianPetOwnerChat;

  if (!isAdminSupportChat && !isVeterinarianPetOwnerChat) {
    throw new Error('Either an Admin support or veterinarian-pet owner conversation must be specified');
  }

  if (isAdminSupportChat) {
    const {
      resolvedAdminId,
      participantId,
      participantField,
      conversationType,
    } = await resolveAdminSupportParticipant({ adminId, veterinarianId, businessId, actorId });
    const conversationQuery = {
      adminId: resolvedAdminId,
      [participantField]: participantId,
      conversationType,
    };
    let conversation = await Conversation.findOne(conversationQuery).maxTimeMS(2000);
    if (!conversation) {
      conversation = await Conversation.create({
        ...conversationQuery,
        lastMessageAt: new Date(),
      });
    }
    await conversation.populate([
      { path: 'adminId', select: 'name email phone profileImage role' },
      { path: 'veterinarianId', select: 'name email phone profileImage role' },
      { path: 'businessId', select: 'name fullName email phone profileImage role' },
    ]);
    return conversation;
  } else {
    if (!appointmentId) {
      throw new Error('Appointment ID is required for veterinarian-pet owner conversation');
    }

    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) {
      throw new Error('Appointment not found');
    }

    if (!sameId(appointment.veterinarianId, veterinarianId) || !sameId(appointment.petOwnerId, petOwnerId)) {
      throw new Error('Appointment does not match the provided veterinarian and pet owner');
    }

    if (actorId && !sameId(actorId, veterinarianId) && !sameId(actorId, petOwnerId)) {
      throw new Error('You do not have access to this appointment chat');
    }

    // A conversation may have been created by an older version before the
    // appointment began. Enforce the start rule for both existing and new chats.
    assertAppointmentChatHasStarted(appointment);

    // One ongoing relationship chat is reused for each future appointment.
    // Any legacy appointment-specific conversations are merged into it first.
    let conversation = await consolidateVeterinarianPetOwnerConversations(
      veterinarianId,
      petOwnerId,
      appointment._id
    );

    if (conversation) {
      await conversation.populate('veterinarianId', 'name email phone profileImage');
      await conversation.populate('petOwnerId', 'name email phone profileImage');
      await conversation.populate('appointmentId', 'appointmentDate appointmentTime status');
    }

    const isNewAppointmentForConversation = conversation &&
      !sameId(conversation.appointmentId?._id || conversation.appointmentId, appointment._id);
    if (isNewAppointmentForConversation && !['CONFIRMED', 'COMPLETED'].includes(appointment.status)) {
      throw new Error('Appointment must be confirmed before communication can begin');
    }

    if (conversation && conversation.status === 'COMPLETED') {
      if (sameId(conversation.appointmentId?._id || conversation.appointmentId, appointment._id)) {
        throw new Error('This chat has been marked as completed by the veterinarian. No further messages can be sent.');
      }

      conversation.status = 'ACTIVE';
      conversation.completedAt = null;
      conversation.completedBy = null;
    }

    if (!conversation) {
      if (!['CONFIRMED', 'COMPLETED'].includes(appointment.status)) {
        throw new Error('Appointment must be confirmed before communication can begin');
      }

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
    } else if (isNewAppointmentForConversation) {
      conversation.appointmentId = appointment._id;
      conversation.lastMessageAt = new Date();
      await conversation.save();
      await conversation.populate('appointmentId', 'appointmentDate appointmentTime status');
    } else if (conversation.isModified()) {
      await conversation.save();
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

  // This is a one-time, lossless upgrade path for duplicate conversations
  // created under the older appointment-per-chat behaviour.
  await consolidateLegacyConversationsForUser(userId, userRole);

  let query = {};

  if (userRole === 'ADMIN') {
    query = { adminId: userId, conversationType: { $in: ALL_ADMIN_SUPPORT_CONVERSATION_TYPES } };
  } else if (userRole === 'VETERINARIAN') {
    query = {
      $or: [
        { veterinarianId: userId, conversationType: 'ADMIN_VETERINARIAN' },
        { veterinarianId: userId, conversationType: 'VETERINARIAN_PET_OWNER' }
      ]
    };
  } else if (userRole === 'PET_OWNER') {
    query = { petOwnerId: userId, conversationType: 'VETERINARIAN_PET_OWNER' };
  } else if (getAdminSupportTypeForRole(userRole)) {
    query = {
      businessId: userId,
      conversationType: getAdminSupportTypeForRole(userRole),
    };
  } else {
    throw new Error('Invalid role');
  }

  query = { ...query, mergedInto: null };

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
  const businessIds = [...new Set(conversationsRaw.map(c => c.businessId?.toString()).filter(Boolean))];
  const ownerIds = [...new Set(conversationsRaw.map(c => c.petOwnerId?.toString()).filter(Boolean))];
  const appointmentIds = [...new Set(conversationsRaw.map(c => c.appointmentId?.toString()).filter(Boolean))];

  const [admins, veterinarians, businesses, petOwners, appointments] = await Promise.all([
    adminIds.length > 0 ? User.find({ _id: { $in: adminIds } })
      .select('name email phone profileImage')
      .lean()
      .maxTimeMS(2000) : Promise.resolve([]),
    vetIds.length > 0 ? User.find({ _id: { $in: vetIds } })
      .select('name email phone profileImage')
      .lean()
      .maxTimeMS(2000) : Promise.resolve([]),
    businessIds.length > 0 ? User.find({ _id: { $in: businessIds } })
      .select('name fullName email phone profileImage role')
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
  const businessMap = {};
  businesses.forEach(b => { businessMap[b._id.toString()] = b; });
  const ownerMap = {};
  petOwners.forEach(o => { ownerMap[o._id.toString()] = o; });
  const appointmentMap = {};
  appointments.forEach(a => { appointmentMap[a._id.toString()] = a; });

  const conversations = conversationsRaw.map(c => ({
    ...c,
    adminId: c.adminId ? adminMap[c.adminId.toString()] : null,
    veterinarianId: c.veterinarianId ? vetMap[c.veterinarianId.toString()] : null,
    businessId: c.businessId ? businessMap[c.businessId.toString()] : null,
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
  let conversation = await Conversation.findById(conversationId);
  conversation = await resolveMergedConversation(conversation);
  if (!conversation) {
    throw new Error('Conversation not found');
  }
  assertConversationParticipant(conversation, userId);

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new Error('Invalid user ID');
  }

  const userObjectId = new mongoose.Types.ObjectId(userId);

  const result = await ChatMessage.updateMany(
    {
      conversationId: conversation._id,
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
    conversationQuery = { adminId: userId, conversationType: { $in: ALL_ADMIN_SUPPORT_CONVERSATION_TYPES } };
  } else if (userRole === 'VETERINARIAN') {
    conversationQuery = {
      $or: [
        { veterinarianId: userId, conversationType: 'ADMIN_VETERINARIAN' },
        { veterinarianId: userId, conversationType: 'VETERINARIAN_PET_OWNER' }
      ]
    };
  } else if (userRole === 'PET_OWNER') {
    conversationQuery = { petOwnerId: userId, conversationType: 'VETERINARIAN_PET_OWNER' };
  } else if (getAdminSupportTypeForRole(userRole)) {
    conversationQuery = {
      businessId: userId,
      conversationType: getAdminSupportTypeForRole(userRole),
    };
  } else {
    return 0;
  }

  conversationQuery = { ...conversationQuery, mergedInto: null };

  const conversations = await Conversation.find(conversationQuery).select('_id');
  const conversationIds = conversations.map(c => c._id);

  const unreadCount = await ChatMessage.countDocuments({
    conversationId: { $in: conversationIds },
    senderId: { $ne: userObjectId },
    'readBy.userId': { $ne: userObjectId }
  });

  return unreadCount;
};

/**
 * Mark conversation as completed (Veterinarian only)
 */
const markConversationComplete = async (conversationId, veterinarianId) => {
  let conversation = await Conversation.findById(conversationId);
  conversation = await resolveMergedConversation(conversation);
  if (!conversation) {
    throw new Error('Conversation not found');
  }

  if (conversation.conversationType !== 'VETERINARIAN_PET_OWNER') {
    throw new Error('Can only complete veterinarian-pet owner conversations');
  }

  if (conversation.veterinarianId.toString() !== veterinarianId) {
    throw new Error('Only the assigned veterinarian can mark this chat as completed');
  }

  if (conversation.status === 'COMPLETED') {
    throw new Error('Conversation is already marked as completed');
  }

  conversation.status = 'COMPLETED';
  conversation.completedAt = new Date();
  conversation.completedBy = veterinarianId;
  await conversation.save();

  return conversation;
};

module.exports = {
  sendMessage,
  getMessages,
  getOrCreateConversation,
  getConversations,
  markMessagesAsRead,
  getUnreadCount,
  markConversationComplete
};
