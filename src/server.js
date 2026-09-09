const app = require("./app");
const connectDB = require("./config/database");
const config = require("./config/env");
const { runAppointmentNotifications } = require("./workers/appointmentNotification.worker");
const { runVaccinationNotifications } = require("./workers/vaccinationNotification.worker");
const { runSubscriptionExpiryNotifications } = require("./workers/subscriptionExpiry.worker");
const { preparePetSitterConversationIndex } = require("./services/chat.service");

const PORT = config.PORT || 5000;

(async () => {
  try {
    await connectDB();
    console.log("✓ Connected to MongoDB");

    // Consolidate any legacy Pet Owner/Pet Sitter duplicates before creating
    // the unique active-pair index used to prevent duplicate conversations.
    await preparePetSitterConversationIndex();
    console.log("✓ Pet Sitter conversation uniqueness prepared");

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

    const checkSubscriptionExpiry = async () => {
      try {
        const result = await runSubscriptionExpiryNotifications();
        if (result.veterinarianCount || result.pharmacyCount) {
          console.log("✅ Subscription expiry notifications processed", result);
        }
      } catch (error) {
        console.error("Error in subscription expiry worker:", error);
      }
    };

    // Run once at startup and then every minute so expiry emails are sent
    // without waiting for a user to open a subscription page.
    await checkSubscriptionExpiry();
    setInterval(checkSubscriptionExpiry, 60 * 1000);
    console.log("✅ Subscription expiry worker started (runs every minute)");
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
