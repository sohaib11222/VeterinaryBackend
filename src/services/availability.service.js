const VeterinarianAvailability = require('../models/VeterinarianAvailability');
const Appointment = require('../models/Appointment');

/**
 * Set veterinarian availability
 * @param {string} veterinarianId - Veterinarian user ID
 * @param {Object} data - Availability data
 * @returns {Promise<Object>} Created/updated availability
 */
const setAvailability = async (veterinarianId, data) => {
  const { date, timeSlots, isAvailable } = data;

  const availability = await VeterinarianAvailability.findOneAndUpdate(
    { veterinarianId, date: new Date(date) },
    {
      veterinarianId,
      date: new Date(date),
      timeSlots: timeSlots || [],
      isAvailable: isAvailable !== undefined ? isAvailable : true
    },
    { upsert: true, new: true }
  );

  return availability;
};

/**
 * Get veterinarian availability
 * @param {string} veterinarianId - Veterinarian user ID
 * @param {Object} options - Filter options
 * @returns {Promise<Array>} Availability records
 */
const getAvailability = async (veterinarianId, options = {}) => {
  const { fromDate, toDate } = options;

  const query = { veterinarianId };

  if (fromDate || toDate) {
    query.date = {};
    if (fromDate) {
      query.date.$gte = new Date(fromDate);
    }
    if (toDate) {
      query.date.$lte = new Date(toDate);
    }
  }

  const availability = await VeterinarianAvailability.find(query)
    .sort({ date: 1 })
    .populate('timeSlots.appointmentId');

  return availability;
};

/**
 * Get available time slots for a veterinarian on a specific date
 * @param {string} veterinarianId - Veterinarian user ID
 * @param {string} date - Date string
 * @returns {Promise<Array>} Available time slots
 */
const getAvailableSlots = async (veterinarianId, date) => {
  const availability = await VeterinarianAvailability.findOne({
    veterinarianId,
    date: new Date(date),
    isAvailable: true
  });

  if (!availability) {
    return [];
  }

  // Filter out booked slots
  const availableSlots = availability.timeSlots.filter(
    slot => slot.isAvailable && !slot.appointmentId
  );

  return availableSlots;
};

/**
 * Check if a time slot is available
 * @param {string} veterinarianId - Veterinarian user ID
 * @param {string} date - Date string
 * @param {string} timeSlot - Time slot (e.g., "09:00-10:00")
 * @returns {Promise<boolean>} True if available
 */
const isTimeSlotAvailable = async (veterinarianId, date, timeSlot) => {
  const [startTime, endTime] = timeSlot.split('-');
  
  const availability = await VeterinarianAvailability.findOne({
    veterinarianId,
    date: new Date(date),
    isAvailable: true,
    'timeSlots.startTime': startTime,
    'timeSlots.endTime': endTime,
    'timeSlots.isAvailable': true,
    'timeSlots.appointmentId': null
  });

  return !!availability;
};

/**
 * Book a time slot
 * @param {string} veterinarianId - Veterinarian user ID
 * @param {string} date - Date string
 * @param {string} timeSlot - Time slot
 * @param {string} appointmentId - Appointment ID
 * @returns {Promise<Object>} Updated availability
 */
const bookTimeSlot = async (veterinarianId, date, timeSlot, appointmentId) => {
  const [startTime, endTime] = timeSlot.split('-');
  
  const availability = await VeterinarianAvailability.findOne({
    veterinarianId,
    date: new Date(date)
  });

  if (!availability) {
    throw new Error('Availability not found for this date');
  }

  const slot = availability.timeSlots.find(
    s => s.startTime === startTime && s.endTime === endTime
  );

  if (!slot || !slot.isAvailable || slot.appointmentId) {
    throw new Error('Time slot is not available');
  }

  slot.isAvailable = false;
  slot.appointmentId = appointmentId;
  await availability.save();

  return availability;
};

/**
 * Release a time slot
 * @param {string} veterinarianId - Veterinarian user ID
 * @param {string} date - Date string
 * @param {string} timeSlot - Time slot
 * @returns {Promise<Object>} Updated availability
 */
const releaseTimeSlot = async (veterinarianId, date, timeSlot) => {
  const [startTime, endTime] = timeSlot.split('-');
  
  const availability = await VeterinarianAvailability.findOne({
    veterinarianId,
    date: new Date(date)
  });

  if (!availability) {
    return null;
  }

  const slot = availability.timeSlots.find(
    s => s.startTime === startTime && s.endTime === endTime
  );

  if (slot) {
    slot.isAvailable = true;
    slot.appointmentId = null;
    await availability.save();
  }

  return availability;
};

module.exports = {
  setAvailability,
  getAvailability,
  getAvailableSlots,
  isTimeSlotAvailable,
  bookTimeSlot,
  releaseTimeSlot
};
