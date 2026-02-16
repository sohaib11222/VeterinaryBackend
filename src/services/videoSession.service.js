const VideoSession = require('../models/VideoSession');
const Appointment = require('../models/Appointment');
const streamService = require('./stream.service');

/**
 * Check if current time is within appointment window
 */
const isWithinAppointmentWindow = (appointment) => {
  const now = new Date();
  const appointmentDate = new Date(appointment.appointmentDate);
  const [hours, minutes] = appointment.appointmentTime.split(':').map(Number);
  appointmentDate.setHours(hours, minutes, 0, 0);

  const endTime = new Date(appointmentDate);
  endTime.setMinutes(endTime.getMinutes() + (appointment.appointmentDuration || 30));

  const bufferTime = 2 * 60 * 1000;
  const windowStart = new Date(appointmentDate.getTime() - bufferTime);
  const windowEnd = endTime;

  if (now < windowStart) {
    return { isValid: false, message: 'Communication will be available 2 minutes before the appointment time' };
  }

  if (now > windowEnd) {
    return { isValid: false, message: 'Communication window has expired' };
  }

  return { isValid: true };
};

/**
 * Start video session
 */
const startSession = async (appointmentId, userId, userName) => {
  const appointment = await Appointment.findById(appointmentId)
    .populate('veterinarianId', 'name')
    .populate('petOwnerId', 'name')
    .populate('petId', 'name');
  
  if (!appointment) {
    throw new Error('Appointment not found');
  }

  if (appointment.status !== 'CONFIRMED') {
    throw new Error('Appointment must be confirmed before video call can start');
  }

  if (appointment.bookingType !== 'ONLINE') {
    throw new Error('Video call is only available for online appointments');
  }

  // Check time window
  const timeWindowCheck = isWithinAppointmentWindow(appointment);
  if (!timeWindowCheck.isValid) {
    throw new Error(timeWindowCheck.message);
  }

  // Check if session already exists
  let session = await VideoSession.findOne({ appointmentId });
  const streamCallId = `appointment-${appointmentId}`;

  if (!session) {
    // Create Stream call (optional)
    try {
      await streamService.createCall(streamCallId, {
        appointmentId: appointmentId.toString(),
        veterinarianId: appointment.veterinarianId._id.toString(),
        petOwnerId: appointment.petOwnerId._id.toString()
      });
    } catch (error) {
      console.error('Failed to create Stream call:', error);
    }

    session = await VideoSession.create({
      appointmentId,
      veterinarianId: appointment.veterinarianId._id,
      petOwnerId: appointment.petOwnerId._id,
      sessionId: streamCallId,
      callId: streamCallId,
      startedAt: new Date()
    });

    appointment.videoSessionId = session._id;
    await appointment.save();
  } else {
    session.startedAt = new Date();
    await session.save();
  }

  // Generate Stream token
  const streamToken = streamService.generateUserToken(userId, userName);

  return {
    session,
    streamToken,
    streamCallId
  };
};

/**
 * End video session
 */
const endSession = async (sessionId) => {
  const session = await VideoSession.findById(sessionId);
  
  if (!session) {
    throw new Error('Video session not found');
  }

  if (session.callId) {
    try {
      await streamService.endCall(session.callId);
    } catch (error) {
      console.error('Error ending Stream call:', error);
    }
  }

  const duration = session.startedAt 
    ? Math.floor((new Date() - session.startedAt) / 1000)
    : null;

  session.endedAt = new Date();
  session.duration = duration;
  await session.save();

  return session;
};

/**
 * Get session by appointment ID
 */
const getSessionByAppointment = async (appointmentId, userId, userName) => {
  const session = await VideoSession.findOne({ appointmentId })
    .populate('veterinarianId', 'name email phone profileImage')
    .populate('petOwnerId', 'name email phone profileImage');
  
  if (!session) {
    throw new Error('Video session not found');
  }

  const streamToken = streamService.generateUserToken(userId, userName);

  return {
    session,
    streamToken,
    streamCallId: session.sessionId || session.callId
  };
};

module.exports = {
  startSession,
  endSession,
  getSessionByAppointment
};
