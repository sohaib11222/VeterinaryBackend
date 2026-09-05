const dotenv = require("dotenv");
dotenv.config();

const REQUIRED = ["MONGO_URI", "JWT_SECRET", "REFRESH_TOKEN_SECRET", "PORT"];

// Optional but recommended for video calls
const RECOMMENDED = ["STREAM_API_KEY", "STREAM_API_SECRET"];

REQUIRED.forEach((key) => {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
});

module.exports = {
  PORT: process.env.PORT,
  NODE_ENV: process.env.NODE_ENV,

  MONGO_URI: process.env.MONGO_URI,

  JWT_SECRET: process.env.JWT_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "7d",
  REFRESH_TOKEN_SECRET: process.env.REFRESH_TOKEN_SECRET,
  REFRESH_TOKEN_EXPIRES_IN: process.env.REFRESH_TOKEN_EXPIRES_IN || "30d",

  // uploads
  UPLOAD_PROFILE: process.env.UPLOAD_PROFILE || "uploads/profiles",
  UPLOAD_VETERINARIAN_DOCS: process.env.UPLOAD_VETERINARIAN_DOCS || "uploads/veterinarian-docs",
  UPLOAD_CLINIC: process.env.UPLOAD_CLINIC || "uploads/clinics",
  UPLOAD_PRODUCT: process.env.UPLOAD_PRODUCT || "uploads/products",
  UPLOAD_PET: process.env.UPLOAD_PET || "uploads/pets",
  UPLOAD_BLOG: process.env.UPLOAD_BLOG || "uploads/blogs",
  UPLOAD_PET_STORE: process.env.UPLOAD_PET_STORE || "uploads/pet-stores",
  UPLOAD_GENERAL: process.env.UPLOAD_GENERAL || "uploads/general",
  UPLOAD_MEDICAL_RECORDS: process.env.UPLOAD_MEDICAL_RECORDS || "uploads/medical-records",

  // email
  SMTP_HOST: process.env.SMTP_HOST || "smtp.aruba.it",
  SMTP_PORT: Number(process.env.SMTP_PORT || 587),
  SMTP_SECURE: String(
    process.env.SMTP_SECURE ?? (Number(process.env.SMTP_PORT || 587) === 465 ? "true" : "false")
  ).toLowerCase() === "true",
  SMTP_REQUIRE_TLS: String(process.env.SMTP_REQUIRE_TLS || "true").toLowerCase() !== "false",
  SMTP_USER: process.env.SMTP_USER,
  SMTP_PASS: process.env.SMTP_PASS,
  SMTP_FROM: process.env.SMTP_FROM || process.env.SMTP_USER,
  SMTP_FROM_NAME: process.env.SMTP_FROM_NAME || "MyPetPlus",

  // payment
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
  PAYPAL_CLIENT_ID: process.env.PAYPAL_CLIENT_ID,
  PAYPAL_SECRET: process.env.PAYPAL_SECRET,

  // Stream Video SDK
  STREAM_API_KEY: process.env.STREAM_API_KEY,
  STREAM_API_SECRET: process.env.STREAM_API_SECRET,

  // Redis (for BullMQ)
  REDIS_HOST: process.env.REDIS_HOST || "localhost",
  REDIS_PORT: process.env.REDIS_PORT || 6379,

  // Reschedule Request Configuration
  RESCHEDULE_REQUEST_DEADLINE_DAYS: process.env.RESCHEDULE_REQUEST_DEADLINE_DAYS || 7,
  RESCHEDULE_DEFAULT_FEE_PERCENTAGE: process.env.RESCHEDULE_DEFAULT_FEE_PERCENTAGE || 50,
  RESCHEDULE_MIN_FEE: process.env.RESCHEDULE_MIN_FEE || 5,
  RESCHEDULE_VETERINARIAN_RESPONSE_DEADLINE_HOURS: process.env.RESCHEDULE_VETERINARIAN_RESPONSE_DEADLINE_HOURS || 48,
  RESCHEDULE_PAYMENT_DEADLINE_HOURS: process.env.RESCHEDULE_PAYMENT_DEADLINE_HOURS || 24,

  TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
  TWILIO_VERIFY_SERVICE_SID: process.env.TWILIO_VERIFY_SERVICE_SID,

  // LeoX24 CRM integration. This is a server-to-server key only; never expose
  // it in either the public website or the CRM frontend.
  CRM_API_KEY: process.env.CRM_API_KEY || '',
};

// Warn if Stream credentials are missing (but don't fail startup)
if (!process.env.STREAM_API_KEY || !process.env.STREAM_API_SECRET) {
  console.warn('⚠️  WARNING: Stream API credentials are not set. Video calling will not work.');
  console.warn('⚠️  Please set STREAM_API_KEY and STREAM_API_SECRET in your .env file');
}
