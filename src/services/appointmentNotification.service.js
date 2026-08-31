const Appointment = require('../models/Appointment');
const Notification = require('../models/Notification');
const notificationService = require('./notification.service');
const { computeAppointmentWindow } = require('../utils/appointmentTime');

const getName = (user, fallback) => user?.name || user?.fullName || user?.email || fallback;

const sendOnce = async ({ userId, appointmentId, action, title, body, data = {} }) => {
  if (!userId) return false;
  const exists = await Notification.exists({
    userId,
    type: 'APPOINTMENT',
    'data.action': action,
    'data.appointmentId': String(appointmentId),
  });
  if (exists) return false;

  await notificationService.createNotification({
    userId,
    title,
    body,
    type: 'APPOINTMENT',
    data: { appointmentId: String(appointmentId), action, ...data },
  });
  return true;
};

const findConfirmedAppointments = () => Appointment.find({ status: 'CONFIRMED' })
  .populate('veterinarianId', 'name fullName email')
  .populate('petOwnerId', 'name fullName email')
  .populate('petId', 'name species');

/**
 * Send a one-time reminder about ten minutes before a confirmed appointment.
 * The shared appointment-time utility converts the stored appointment calendar
 * date, clock value, IANA timezone, and DST offset into one UTC timestamp.
 */
const sendUpcomingAppointmentNotifications = async () => {
  const now = new Date();
  const appointments = await findConfirmedAppointments();
  let sent = 0;

  for (const appointment of appointments) {
    try {
      const { start } = computeAppointmentWindow(appointment);
      const minutesUntilStart = (start.getTime() - now.getTime()) / 60000;
      // The worker runs every minute. A two-minute window makes the reminder
      // reliable when the worker starts a few seconds early or late.
      if (minutesUntilStart < 8.5 || minutesUntilStart > 10.5) continue;

      const petName = appointment.petId?.name || 'your pet';
      const vetName = getName(appointment.veterinarianId, 'your veterinarian');
      const ownerName = getName(appointment.petOwnerId, 'the pet owner');
      const sharedData = { appointmentTime: appointment.appointmentTime, minutesBefore: 10 };
      const created = await Promise.all([
        sendOnce({
          userId: appointment.veterinarianId?._id,
          appointmentId: appointment._id,
          action: 'APPOINTMENT_REMINDER_10_MIN',
          title: 'Appointment starts in 10 minutes',
          body: `Your appointment with ${ownerName} for ${petName} starts at ${appointment.appointmentTime}.`,
          data: sharedData,
        }),
        sendOnce({
          userId: appointment.petOwnerId?._id,
          appointmentId: appointment._id,
          action: 'APPOINTMENT_REMINDER_10_MIN',
          title: 'Appointment starts in 10 minutes',
          body: `Your appointment with Dr. ${vetName} for ${petName} starts at ${appointment.appointmentTime}.`,
          data: sharedData,
        }),
      ]);
      sent += created.filter(Boolean).length;
    } catch (error) {
      console.error('Appointment reminder failed:', appointment?._id, error);
    }
  }
  return { sent };
};

/**
 * Send the existing video-call start notification once the online appointment
 * has started. This uses the same timezone-safe start value as the reminder.
 */
const sendAppointmentTimeNotifications = async () => {
  const now = new Date();
  const appointments = await Appointment.find({ status: 'CONFIRMED', bookingType: 'ONLINE' })
    .populate('veterinarianId', 'name fullName email')
    .populate('petOwnerId', 'name fullName email')
    .populate('petId', 'name species');
  let sent = 0;

  for (const appointment of appointments) {
    try {
      const { start, end } = computeAppointmentWindow(appointment);
      const minutesFromStart = (now.getTime() - start.getTime()) / 60000;
      if (minutesFromStart < -0.25 || minutesFromStart > 1 || now > end) continue;

      const petName = appointment.petId?.name || 'your pet';
      const vetName = getName(appointment.veterinarianId, 'your veterinarian');
      const ownerName = getName(appointment.petOwnerId, 'the pet owner');
      const sharedData = { appointmentTime: appointment.appointmentTime };
      const created = await Promise.all([
        sendOnce({
          userId: appointment.veterinarianId?._id,
          appointmentId: appointment._id,
          action: 'VIDEO_CALL_START',
          title: 'Video call appointment time',
          body: `Your video appointment with ${ownerName} for ${petName} is ready to join.`,
          data: sharedData,
        }),
        sendOnce({
          userId: appointment.petOwnerId?._id,
          appointmentId: appointment._id,
          action: 'VIDEO_CALL_START',
          title: 'Video call appointment time',
          body: `Your video appointment with Dr. ${vetName} for ${petName} is ready to join.`,
          data: sharedData,
        }),
      ]);
      sent += created.filter(Boolean).length;
    } catch (error) {
      console.error('Appointment start notification failed:', appointment?._id, error);
    }
  }
  return { sent };
};

module.exports = { sendAppointmentTimeNotifications, sendUpcomingAppointmentNotifications };
