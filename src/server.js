const app = require("./app");
const connectDB = require("./config/database");
const config = require("./config/env");
const { runAppointmentNotifications } = require("./workers/appointmentNotification.worker");
const { runVaccinationNotifications } = require("./workers/vaccinationNotification.worker");

const PORT = config.PORT || 5000;

(async () => {
  try {
    await connectDB();
    console.log("✓ Connected to MongoDB");

    app.listen(PORT, () => {
      console.log(`✓ Veterinary Backend API running on port ${PORT}`);
      console.log(`✓ Environment: ${config.NODE_ENV || 'development'}`);
    });

    // Start appointment notification worker (runs every minute)
    setInterval(async () => {
      try {
        await runAppointmentNotifications();
      } catch (error) {
        console.error("Error in appointment notification worker:", error);
      }
    }, 60 * 1000); // Run every minute

    console.log("✅ Appointment notification worker started (runs every minute)");

    setInterval(async () => {
      try {
        await runVaccinationNotifications();
      } catch (error) {
        console.error("Error in vaccination notification worker:", error);
      }
    }, 60 * 60 * 1000);

    console.log("✅ Vaccination notification worker started (runs every hour)");
  } catch (error) {
    console.error("✗ Server start failed:", error.message);
    process.exit(1);
  }
})();

// Handle unhandled rejections
process.on("unhandledRejection", (err) => {
  console.error("UNHANDLED REJECTION 💥", err);
  process.exit(1);
});

// Handle uncaught exceptions
process.on("uncaughtException", (err) => {
  console.error("UNCAUGHT EXCEPTION 💥", err);
  process.exit(1);
});
