const VideoSession = require('../models/VideoSession');
const Appointment = require('../models/Appointment');
const streamService = require('./stream.service');

/**
 * Check if current time is within appointment window
 */
const getTimeZoneOffsetMinutes = (date, timeZone) => {
  try {
    const dtf = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    const parts = dtf.formatToParts(date).reduce((acc, p) => {
      if (p.type !== 'literal') acc[p.type] = p.value;
      return acc;
    }, {});
    const asUTC = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute),
      Number(parts.second)
    );
    return (asUTC - date.getTime()) / 60000;
  } catch {
    return null;
  }
};

const zonedDateTimeToUtcMs = ({ year, month, day, hour, minute }, timeZone) => {
  let guess = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  let offset = getTimeZoneOffsetMinutes(new Date(guess), timeZone);
  if (typeof offset !== 'number' || !Number.isFinite(offset)) {
    return guess;
  }
  let utcMs = guess - offset * 60 * 1000;
  // Re-check once to handle DST transitions
  const offset2 = getTimeZoneOffsetMinutes(new Date(utcMs), timeZone);
  if (typeof offset2 === 'number' && Number.isFinite(offset2) && offset2 !== offset) {
    utcMs = guess - offset2 * 60 * 1000;
  }
  return utcMs;
};

const computeAppointmentWindow = (appointment) => {
  const appointmentDateUTC = appointment.appointmentDate instanceof Date
    ? appointment.appointmentDate
    : new Date(appointment.appointmentDate);

  // appointmentDate is stored as date-only; use UTC parts to avoid server-local timezone shifts.
  const baseYear = appointmentDateUTC.getUTCFullYear();
  const baseMonth = appointmentDateUTC.getUTCMonth() + 1;
  const baseDay = appointmentDateUTC.getUTCDate();

  const [startHours, startMinutes] = String(appointment.appointmentTime || '').split(':').map(Number);
  if (!Number.isFinite(startHours) || !Number.isFinite(startMinutes)) {
    throw new Error('Invalid appointment time');
  }

  const duration = appointment.appointmentDuration || 30;

  const tzOffsetMinutes =
    typeof appointment.timezoneOffset === 'number' && Number.isFinite(appointment.timezoneOffset)
      ? appointment.timezoneOffset
      : null;
  const tzNameRaw = typeof appointment.timezone === 'string' ? appointment.timezone : null;
  const timeZone = tzNameRaw && tzNameRaw.includes('/') ? tzNameRaw : 'Europe/Rome';

  // If we have a numeric offset, follow the proven offset-based algorithm (myDoctor/react-conversion)
  if (tzOffsetMinutes !== null) {
    const appointmentDateInTz = new Date(appointmentDateUTC.getTime() + tzOffsetMinutes * 60 * 1000);
    const year = appointmentDateInTz.getUTCFullYear();
    const month = appointmentDateInTz.getUTCMonth();
    const day = appointmentDateInTz.getUTCDate();

    const appointmentStartDateTimeUTC = new Date(Date.UTC(year, month, day, startHours, startMinutes, 0, 0));
    const start = new Date(appointmentStartDateTimeUTC.getTime() - tzOffsetMinutes * 60 * 1000);

    let end;
    if (appointment.appointmentEndTime) {
      const [endHours, endMinutes] = String(appointment.appointmentEndTime || '').split(':').map(Number);
      if (Number.isFinite(endHours) && Number.isFinite(endMinutes)) {
        const startTimeMinutes = startHours * 60 + startMinutes;
        const endTimeMinutes = endHours * 60 + endMinutes;

        let endYear = year;
        let endMonth = month;
        let endDay = day;

        if (endTimeMinutes < startTimeMinutes && startTimeMinutes - endTimeMinutes > 12 * 60) {
          const nextDay = new Date(Date.UTC(year, month, day + 1));
          endYear = nextDay.getUTCFullYear();
          endMonth = nextDay.getUTCMonth();
          endDay = nextDay.getUTCDate();
        }

        const appointmentEndDateTimeUTC = new Date(Date.UTC(endYear, endMonth, endDay, endHours, endMinutes, 0, 0));
        end = new Date(appointmentEndDateTimeUTC.getTime() - tzOffsetMinutes * 60 * 1000);
      }
    }
    if (!end) {
      end = new Date(start.getTime() + duration * 60 * 1000);
    }

    return { start, end };
  }

  // Otherwise, use IANA timezone conversion (DST-safe) for Italy.
  const startUtcMs = zonedDateTimeToUtcMs(
    { year: baseYear, month: baseMonth, day: baseDay, hour: startHours, minute: startMinutes },
    timeZone
  );
  const start = new Date(startUtcMs);

  let end;
  if (appointment.appointmentEndTime) {
    const [endHours, endMinutes] = String(appointment.appointmentEndTime || '').split(':').map(Number);
    if (Number.isFinite(endHours) && Number.isFinite(endMinutes)) {
      const startTimeMinutes = startHours * 60 + startMinutes;
      const endTimeMinutes = endHours * 60 + endMinutes;
      let endYear = baseYear;
      let endMonth = baseMonth;
      let endDay = baseDay;
      if (endTimeMinutes < startTimeMinutes && startTimeMinutes - endTimeMinutes > 12 * 60) {
        const next = new Date(Date.UTC(baseYear, baseMonth - 1, baseDay + 1));
        endYear = next.getUTCFullYear();
        endMonth = next.getUTCMonth() + 1;
        endDay = next.getUTCDate();
      }
      const endUtcMs = zonedDateTimeToUtcMs(
        { year: endYear, month: endMonth, day: endDay, hour: endHours, minute: endMinutes },
        timeZone
      );
      end = new Date(endUtcMs);
    }
  }
  if (!end) {
    end = new Date(start.getTime() + duration * 60 * 1000);
  }

  return { start, end };
};

const isWithinAppointmentWindow = (appointment) => {
  const now = new Date();
  const { start, end } = computeAppointmentWindow(appointment);

  const bufferTime = 2 * 60 * 1000;
  const windowStart = new Date(start.getTime() - bufferTime);
  const windowEnd = end;

  // Check expiry first for clearer messaging
  if (now > windowEnd) {
    return { isValid: false, message: 'Communication window has expired' };
  }

  if (now < windowStart) {
    return { isValid: false, message: 'Communication will be available 2 minutes before the appointment time' };
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
