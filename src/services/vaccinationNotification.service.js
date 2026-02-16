const Vaccination = require('../models/Vaccination');
const Notification = require('../models/Notification');
const Pet = require('../models/Pet');

const getStartOfDay = (d) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

const addDays = (d, days) => {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
};

const buildWindow = (baseDayStart, daysAhead) => {
  const start = addDays(baseDayStart, daysAhead);
  const end = addDays(baseDayStart, daysAhead + 1);
  return { start, end };
};

const sendVaccinationDueNotifications = async (options = {}) => {
  const reminderDaysList = Array.isArray(options.reminderDaysList) && options.reminderDaysList.length > 0
    ? options.reminderDaysList
    : [30, 7, 1, 0];

  const now = new Date();
  const todayStart = getStartOfDay(now);

  let sent = 0;

  for (const daysAhead of reminderDaysList) {
    const { start, end } = buildWindow(todayStart, daysAhead);

    const vaccinationsRaw = await Vaccination.find({
      isCompleted: true,
      nextDueDate: { $gte: start, $lt: end },
    })
      .select('petId petOwnerId vaccinationType nextDueDate')
      .lean()
      .maxTimeMS(4000);

    if (!vaccinationsRaw || vaccinationsRaw.length === 0) continue;

    const petIds = [...new Set(vaccinationsRaw.map(v => v.petId?.toString()).filter(Boolean))];
    const pets = petIds.length > 0
      ? await Pet.find({ _id: { $in: petIds } }).select('name').lean().maxTimeMS(3000)
      : [];
    const petMap = {};
    pets.forEach(p => { petMap[p._id.toString()] = p; });

    for (const v of vaccinationsRaw) {
      const userId = v.petOwnerId?.toString();
      const vaccinationId = v._id?.toString();
      if (!userId || !vaccinationId) continue;

      const existing = await Notification.findOne({
        userId,
        type: 'VACCINATION',
        'data.vaccinationId': vaccinationId,
        'data.reminderDays': daysAhead,
        createdAt: { $gte: todayStart },
      })
        .lean()
        .maxTimeMS(2000);

      if (existing) continue;

      const pet = v.petId ? petMap[v.petId.toString()] : null;
      const petName = pet?.name || 'your pet';
      const vaccineName = v.vaccinationType || 'Vaccination';
      const dueDate = v.nextDueDate ? new Date(v.nextDueDate).toLocaleDateString() : '';

      const title = daysAhead === 0
        ? 'Vaccination Due Today'
        : `Vaccination Due in ${daysAhead} Day${daysAhead === 1 ? '' : 's'}`;

      const body = daysAhead === 0
        ? `${vaccineName} is due today for ${petName}.`
        : `${vaccineName} is due in ${daysAhead} day${daysAhead === 1 ? '' : 's'} for ${petName} (due ${dueDate}).`;

      await Notification.create({
        userId,
        title,
        body,
        type: 'VACCINATION',
        data: {
          vaccinationId,
          petId: v.petId,
          reminderDays: daysAhead,
          dueDate: v.nextDueDate,
        },
      });

      sent += 1;
    }
  }

  return { sent };
};

module.exports = {
  sendVaccinationDueNotifications,
};
