/**
 * Appointment times are stored as a calendar date plus a local clock time.
 * The browser supplies `timezoneOffset` using the application's convention:
 * minutes east of UTC are positive (Europe/Rome is +120 during CEST).  When an
 * IANA timezone is present it takes precedence, so daylight-saving changes are
 * calculated for the appointment date rather than for the day of booking.
 */
const isIanaTimeZone = (timeZone) => {
  if (typeof timeZone !== 'string' || !timeZone.includes('/')) return false;
  try {
    Intl.DateTimeFormat('en-US', { timeZone }).format();
    return true;
  } catch {
    return false;
  }
};

const getTimeZoneOffsetMinutes = (date, timeZone) => {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour12: false,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).formatToParts(date).reduce((result, part) => {
      if (part.type !== 'literal') result[part.type] = part.value;
      return result;
    }, {});

    const asUtc = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute),
      Number(parts.second)
    );
    return Math.round((asUtc - date.getTime()) / 60000);
  } catch {
    return null;
  }
};

const zonedDateTimeToUtcMs = ({ year, month, day, hour, minute }, timeZone) => {
  const wallClockAsUtc = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  const firstOffset = getTimeZoneOffsetMinutes(new Date(wallClockAsUtc), timeZone);
  if (!Number.isFinite(firstOffset)) return wallClockAsUtc;

  let utcMs = wallClockAsUtc - firstOffset * 60 * 1000;
  const correctedOffset = getTimeZoneOffsetMinutes(new Date(utcMs), timeZone);
  if (Number.isFinite(correctedOffset) && correctedOffset !== firstOffset) {
    utcMs = wallClockAsUtc - correctedOffset * 60 * 1000;
  }
  return utcMs;
};

const getAppointmentDateParts = (appointmentDate, appointment = null) => {
  const date = appointmentDate instanceof Date ? appointmentDate : new Date(appointmentDate);
  if (Number.isNaN(date.getTime())) throw new Error('Invalid appointment date');
  // Before timezone was persisted, some servers saved a local midnight as a
  // UTC timestamp. Preserve the intended calendar date for those records.
  // New appointments always carry an IANA timezone and are stored at UTC
  // midnight, so they intentionally skip this compatibility adjustment.
  const legacyOffset = Number(appointment?.timezoneOffset);
  const logicalDate = !isIanaTimeZone(appointment?.timezone) && Number.isFinite(legacyOffset)
    ? new Date(date.getTime() + legacyOffset * 60 * 1000)
    : date;
  return {
    year: logicalDate.getUTCFullYear(),
    month: logicalDate.getUTCMonth() + 1,
    day: logicalDate.getUTCDate(),
  };
};

const parseClockTime = (value, label = 'appointment') => {
  const [hour, minute] = String(value || '').split(':').map(Number);
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    throw new Error(`Invalid ${label} time`);
  }
  return { hour, minute };
};

const addCalendarDays = ({ year, month, day }, days) => {
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
};

const localAppointmentDateTimeToUtc = (dateParts, clock, appointment) => {
  const timeZone = isIanaTimeZone(appointment?.timezone) ? appointment.timezone : null;
  if (timeZone) {
    return new Date(zonedDateTimeToUtcMs({ ...dateParts, ...clock }, timeZone));
  }

  const storedOffset = Number(appointment?.timezoneOffset);
  const fallbackOffset = getTimeZoneOffsetMinutes(
    new Date(Date.UTC(dateParts.year, dateParts.month - 1, dateParts.day, 12, 0, 0, 0)),
    'Europe/Rome'
  );
  const offset = Number.isFinite(storedOffset)
    ? storedOffset
    : Number.isFinite(fallbackOffset)
      ? fallbackOffset
      : 0;

  return new Date(
    Date.UTC(dateParts.year, dateParts.month - 1, dateParts.day, clock.hour, clock.minute, 0, 0) -
      offset * 60 * 1000
  );
};

const getAppointmentStart = (appointment) => {
  const dateParts = getAppointmentDateParts(appointment?.appointmentDate, appointment);
  const clock = parseClockTime(appointment?.appointmentTime);
  return localAppointmentDateTimeToUtc(dateParts, clock, appointment);
};

const computeAppointmentWindow = (appointment) => {
  const dateParts = getAppointmentDateParts(appointment?.appointmentDate, appointment);
  const startClock = parseClockTime(appointment?.appointmentTime);
  const start = localAppointmentDateTimeToUtc(dateParts, startClock, appointment);

  let end = null;
  if (appointment?.appointmentEndTime) {
    const endClock = parseClockTime(appointment.appointmentEndTime, 'appointment end');
    const startsAtOrAfterEnd = startClock.hour * 60 + startClock.minute >= endClock.hour * 60 + endClock.minute;
    const endDateParts = startsAtOrAfterEnd ? addCalendarDays(dateParts, 1) : dateParts;
    end = localAppointmentDateTimeToUtc(endDateParts, endClock, appointment);
  }

  if (!end) {
    const duration = Number(appointment?.appointmentDuration);
    end = new Date(start.getTime() + (Number.isFinite(duration) && duration > 0 ? duration : 30) * 60 * 1000);
  }
  return { start, end };
};

module.exports = {
  isIanaTimeZone,
  getTimeZoneOffsetMinutes,
  getAppointmentDateParts,
  getAppointmentStart,
  computeAppointmentWindow,
};
