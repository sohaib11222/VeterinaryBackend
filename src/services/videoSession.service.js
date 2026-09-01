const VideoSession = require('../models/VideoSession');
const Appointment = require('../models/Appointment');
const streamService = require('./stream.service');
const { computeAppointmentWindow } = require('../utils/appointmentTime');

// A ringing session is only an invitation, not an active call. Closing it on
// the server after a short period lets either participant start a new call in
// the same still-valid appointment window without manual database cleanup.
const RING_TIMEOUT_MS = 60 * 1000;

const createHttpError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const getId = (value) => (value?._id || value)?.toString?.() || String(value || '');

const expireUnansweredSession = async (session, now = new Date()) => {
  if (!session || session.status !== 'RINGING') return false;
  const ringingAt = session.ringingAt || session.createdAt;
  if (!ringingAt || now.getTime() - new Date(ringingAt).getTime() < RING_TIMEOUT_MS) return false;

  session.status = 'MISSED';
  session.endedAt = now;
  session.endedBy = null;
  session.duration = null;
  await session.save();
  return true;
};

const assertAppointmentWindow = (appointment) => {
  const { start, end } = computeAppointmentWindow(appointment);
  const now = new Date();
  if (now < start) {
    throw createHttpError('Video calling becomes available at the appointment start time');
  }
  if (now > end) {
    throw createHttpError('The appointment call window has ended');
  }
};

const loadAppointmentForParticipant = async (appointmentId, userId) => {
  const appointment = await Appointment.findById(appointmentId)
    .populate('veterinarianId', 'name fullName email profileImage')
    .populate('petOwnerId', 'name fullName email profileImage')
    .populate('petId', 'name');

  if (!appointment) throw createHttpError('Appointment not found', 404);
  if (appointment.status !== 'CONFIRMED') throw createHttpError('Appointment must be confirmed before video calling can start');
  if (appointment.bookingType !== 'ONLINE') throw createHttpError('Video calling is only available for online appointments');

  const veterinarianId = getId(appointment.veterinarianId);
  const petOwnerId = getId(appointment.petOwnerId);
  const currentUserId = getId(userId);
  if (currentUserId !== veterinarianId && currentUserId !== petOwnerId) {
    throw createHttpError('You are not a participant in this appointment', 403);
  }

  return { appointment, veterinarianId, petOwnerId, currentUserId };
};

const serializeSession = (session, currentUserId) => {
  const raw = session.toObject ? session.toObject() : session;
  const callerIsVeterinarian = getId(raw.initiatedBy) === getId(raw.veterinarianId);
  const caller = callerIsVeterinarian ? raw.veterinarianId : raw.petOwnerId;
  const recipient = callerIsVeterinarian ? raw.petOwnerId : raw.veterinarianId;
  return {
    ...raw,
    isIncoming: getId(raw.initiatedBy) !== getId(currentUserId),
    caller: caller && typeof caller === 'object'
      ? { _id: caller._id, name: caller.name || caller.fullName || caller.email || 'User', profileImage: caller.profileImage || null }
      : null,
    recipient: recipient && typeof recipient === 'object'
      ? { _id: recipient._id, name: recipient.name || recipient.fullName || recipient.email || 'User', profileImage: recipient.profileImage || null }
      : null,
  };
};

const getStreamCredentials = (session, userId, userName) => ({
  session,
  streamToken: streamService.generateUserToken(userId, userName),
  streamCallId: session.sessionId || session.callId,
  streamApiKey: streamService.getPublicApiKey(),
  // The browser creates the Stream call before showing the in-app ringing UI.
  // Sending both appointment participants prevents one user from creating a
  // single-member call that the other participant cannot subsequently join.
  streamMembers: [getId(session.veterinarianId), getId(session.petOwnerId)].filter(Boolean),
});

const startSession = async (appointmentId, userId, userName) => {
  const { appointment, veterinarianId, petOwnerId, currentUserId } = await loadAppointmentForParticipant(appointmentId, userId);
  assertAppointmentWindow(appointment);

  let session = await VideoSession.findOne({ appointmentId }).sort({ updatedAt: -1 });
  if (session?.status === 'RINGING') {
    const expired = await expireUnansweredSession(session);
    if (!expired) {
      if (getId(session.initiatedBy) !== currentUserId) {
        throw createHttpError('The other participant is already calling');
      }
      return getStreamCredentials(session, userId, userName);
    }
  }
  if (session?.status === 'ACTIVE') {
    // Never let a second create request replace an active shared call. Both
    // participants can rejoin this session; a new call is created only after
    // the current session is explicitly ended.
    throw createHttpError('This appointment call is already active', 409);
  }

  const streamCallId = `appointment-${appointmentId}-${Date.now()}`;
  const now = new Date();
  if (!session) {
    session = new VideoSession({ appointmentId, veterinarianId, petOwnerId });
  }
  session.sessionId = streamCallId;
  session.callId = streamCallId;
  session.status = 'RINGING';
  session.initiatedBy = userId;
  session.acceptedBy = null;
  session.ringingAt = now;
  session.acceptedAt = null;
  session.startedAt = null;
  session.endedAt = null;
  session.endedBy = null;
  session.duration = null;
  await session.save();

  appointment.videoSessionId = session._id;
  await appointment.save();

  return getStreamCredentials(session, userId, userName);
};

const acceptSession = async (sessionId, userId, userName) => {
  const session = await VideoSession.findById(sessionId)
    .populate('appointmentId')
    .populate('veterinarianId', 'name fullName email profileImage')
    .populate('petOwnerId', 'name fullName email profileImage');
  if (!session) throw createHttpError('Video call not found', 404);

  const appointment = session.appointmentId;
  const currentUserId = getId(userId);
  const isParticipant = currentUserId === getId(session.veterinarianId) || currentUserId === getId(session.petOwnerId);
  if (!isParticipant) throw createHttpError('You are not a participant in this call', 403);
  if (getId(session.initiatedBy) === currentUserId) throw createHttpError('The caller cannot accept their own call');
  await expireUnansweredSession(session);
  if (session.status !== 'RINGING') throw createHttpError('This call is no longer ringing');

  assertAppointmentWindow(appointment);
  const now = new Date();
  session.status = 'ACTIVE';
  session.acceptedBy = userId;
  session.acceptedAt = now;
  session.startedAt = now;
  await session.save();

  return getStreamCredentials(session, userId, userName);
};

const endSession = async (sessionId, userId) => {
  const session = await VideoSession.findById(sessionId);
  if (!session) throw createHttpError('Video call not found', 404);

  const currentUserId = getId(userId);
  const isParticipant = currentUserId === getId(session.veterinarianId) || currentUserId === getId(session.petOwnerId);
  if (!isParticipant) throw createHttpError('You are not a participant in this call', 403);

  if (session.status === 'RINGING') {
    session.status = getId(session.initiatedBy) === currentUserId ? 'MISSED' : 'DECLINED';
  } else if (session.status === 'ACTIVE') {
    session.status = 'ENDED';
  } else {
    // End is intentionally idempotent.  The client calls it both from the
    // End Call control and as a best-effort safeguard when the call room is
    // closed or refreshed.
    return session;
  }
  session.endedAt = new Date();
  session.endedBy = userId;
  session.duration = session.startedAt ? Math.floor((session.endedAt - session.startedAt) / 1000) : 0;
  await session.save();

  try {
    if (session.callId) await streamService.endCall(session.callId);
  } catch (error) {
    console.error('Error ending Stream call:', error);
  }
  return session;
};

const getSessionByAppointment = async (appointmentId, userId, userName) => {
  await loadAppointmentForParticipant(appointmentId, userId);
  const session = await VideoSession.findOne({ appointmentId })
    .populate('veterinarianId', 'name fullName email profileImage')
    .populate('petOwnerId', 'name fullName email profileImage')
    .sort({ updatedAt: -1 });
  if (!session) throw createHttpError('Video call not found', 404);
  await expireUnansweredSession(session);
  return getStreamCredentials(session, userId, userName);
};

const getIncomingSessions = async (userId) => {
  const sessions = await VideoSession.find({
    status: 'RINGING',
    $or: [{ veterinarianId: userId }, { petOwnerId: userId }],
    initiatedBy: { $ne: userId },
  })
    .populate('appointmentId', 'appointmentDate appointmentTime appointmentEndTime appointmentDuration appointmentNumber timezone timezoneOffset petId')
    .populate('veterinarianId', 'name fullName email profileImage')
    .populate('petOwnerId', 'name fullName email profileImage')
    .sort({ ringingAt: -1 });

  const activeSessions = [];
  for (const session of sessions) {
    try {
      if (await expireUnansweredSession(session)) continue;
      assertAppointmentWindow(session.appointmentId);
      activeSessions.push(serializeSession(session, userId));
    } catch {
      session.status = 'MISSED';
      session.endedAt = new Date();
      await session.save();
    }
  }
  return activeSessions;
};

module.exports = {
  startSession,
  acceptSession,
  endSession,
  getSessionByAppointment,
  getIncomingSessions,
};
