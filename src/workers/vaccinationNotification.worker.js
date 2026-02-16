const { sendVaccinationDueNotifications } = require('../services/vaccinationNotification.service');

const runVaccinationNotifications = async () => {
  try {
    await sendVaccinationDueNotifications();
  } catch (error) {
    console.error('Error in vaccination notifications:', error);
  }
};

if (require.main === module) {
  runVaccinationNotifications()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = {
  runVaccinationNotifications,
};
