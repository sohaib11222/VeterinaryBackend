const nodemailer = require('nodemailer');
const env = require('../config/env');

let transporter;

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

const getTransporter = () => {
  if (transporter) return transporter;
  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS) return null;

  transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: Number(env.SMTP_PORT || 587),
    secure: env.SMTP_SECURE !== false,
    requireTLS: env.SMTP_REQUIRE_TLS !== false,
    connectionTimeout: 20000,
    greetingTimeout: 20000,
    socketTimeout: 30000,
    tls: {
      minVersion: 'TLSv1.2',
      servername: env.SMTP_HOST,
    },
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
    },
  });
  return transporter;
};

const sendEmail = async ({ to, subject, text, html }) => {
  const mailer = getTransporter();
  if (!mailer) {
    console.warn('[email] SMTP is not configured; skipping email:', subject);
    return { skipped: true };
  }

  try {
    const info = await mailer.sendMail({
      from: {
        address: env.SMTP_FROM || env.SMTP_USER,
        name: env.SMTP_FROM_NAME || 'MyPetPlus',
      },
      to,
      subject,
      text,
      html,
    });

    console.log('[email] SMTP message accepted', {
      messageId: info.messageId,
      acceptedCount: Array.isArray(info.accepted) ? info.accepted.length : 0,
      rejectedCount: Array.isArray(info.rejected) ? info.rejected.length : 0,
      response: info.response,
    });

    return { messageId: info.messageId };
  } catch (error) {
    console.error('[email] SMTP send failed', {
      code: error?.code,
      command: error?.command,
      responseCode: error?.responseCode,
      response: error?.response,
      message: error?.message,
    });
    throw error;
  }
};

const sendWelcomeEmail = async ({ name, email }) => {
  const displayName = name || 'there';
  const safeName = escapeHtml(displayName);
  return sendEmail({
    to: email,
    subject: 'Welcome to MyPetPlus',
    text: `Hi ${displayName},\n\nThank you for joining MyPetPlus. Welcome to the platform! We are happy to have you with us.\n\nThe MyPetPlus Team`,
    html: `<p>Hi ${safeName},</p><p>Thank you for joining <strong>MyPetPlus</strong>. Welcome to the platform! We are happy to have you with us.</p><p>The MyPetPlus Team</p>`,
  });
};

const sendApprovalEmail = async ({ name, email, role }) => {
  const displayName = name || 'there';
  const safeName = escapeHtml(displayName);
  const roleLabel = role === 'VETERINARIAN'
    ? 'Doctor'
    : role === 'PARAPHARMACY'
      ? 'Parapharmacy'
      : 'Pharmacy';

  return sendEmail({
    to: email,
    subject: 'Your MyPetPlus account has been approved',
    text: `Hi ${displayName},\n\nYour ${roleLabel} account has been approved. You can now log in to MyPetPlus and start using the platform. Welcome to MyPetPlus!\n\nThe MyPetPlus Team`,
    html: `<p>Hi ${safeName},</p><p>Your <strong>${roleLabel}</strong> account has been approved.</p><p>You can now log in to MyPetPlus and start using the platform. Welcome to MyPetPlus!</p><p>The MyPetPlus Team</p>`,
  });
};

module.exports = {
  sendEmail,
  sendWelcomeEmail,
  sendApprovalEmail,
};
