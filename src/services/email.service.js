const nodemailer = require('nodemailer');
const env = require('../config/env');

let transporter;

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

const formatDate = (value) => {
  if (!value) return 'Not specified';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
};

const formatAmount = (value) => `€${Number(value || 0).toFixed(2)}`;

const detailsTable = (details) => {
  const rows = details
    .filter(([, value]) => value !== null && value !== undefined && value !== '')
    .map(([label, value]) => `
      <tr>
        <td style="padding:9px 0;color:#5f6b7a;font-size:14px;vertical-align:top;width:42%;">${escapeHtml(label)}</td>
        <td style="padding:9px 0;color:#1f2937;font-size:14px;font-weight:600;vertical-align:top;">${escapeHtml(value)}</td>
      </tr>`)
    .join('');

  return rows
    ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;border-top:1px solid #e5e7eb;border-bottom:1px solid #e5e7eb;margin:22px 0;">${rows}</table>`
    : '';
};

const emailLayout = ({ title, preview, body }) => `
  <!doctype html>
  <html lang="en">
    <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
    <body style="margin:0;padding:0;background:#f3f6fb;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
      <span style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;">${escapeHtml(preview || title)}</span>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f6fb;padding:28px 12px;">
        <tr><td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 4px 18px rgba(31,41,55,.08);">
            <tr><td style="background:linear-gradient(135deg,#1d5b8f,#2d92b5);padding:28px 34px;color:#ffffff;">
              <div style="font-size:24px;font-weight:700;">MyPetPlus</div>
              <div style="font-size:13px;opacity:.9;margin-top:4px;">Better care for every pet</div>
            </td></tr>
            <tr><td style="padding:32px 34px;">
              <h1 style="font-size:23px;line-height:1.35;margin:0 0 18px;color:#172033;">${escapeHtml(title)}</h1>
              ${body}
            </td></tr>
            <tr><td style="padding:18px 34px;background:#f8fafc;color:#6b7280;font-size:12px;line-height:1.5;">
              This is an automated MyPetPlus email. Please do not reply directly to this message.
            </td></tr>
          </table>
        </td></tr>
      </table>
    </body>
  </html>`;

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

const sendPasswordVerificationCodeEmail = async ({ name, email, code, purpose = 'reset' }) => {
  const displayName = name || 'there';
  const isChange = purpose === 'change';
  const action = isChange ? 'change your password' : 'reset your password';
  const safeCode = escapeHtml(code);

  return sendEmail({
    to: email,
    subject: `Your MyPetPlus ${isChange ? 'password change' : 'password reset'} code`,
    text: `Hi ${displayName},\n\nUse this verification code to ${action}: ${code}\n\nThis code expires in 10 minutes. If you did not request this, you can safely ignore this email.\n\nThe MyPetPlus Team`,
    html: emailLayout({
      title: isChange ? 'Confirm your password change' : 'Reset your password',
      preview: `Your verification code is ${code}`,
      body: `<p style="font-size:15px;line-height:1.65;margin:0;">Hi ${escapeHtml(displayName)},</p>
        <p style="font-size:15px;line-height:1.65;">Use the verification code below to ${escapeHtml(action)}.</p>
        <div style="margin:24px 0;padding:18px;background:#edf7fb;border:1px solid #c9e7f0;border-radius:10px;text-align:center;font-size:30px;letter-spacing:8px;font-weight:700;color:#1d5b8f;">${safeCode}</div>
        <p style="font-size:14px;line-height:1.65;color:#4b5563;">This code expires in 10 minutes and can only be used once. If you did not make this request, you can safely ignore this email.</p>`,
    }),
  });
};

const sendEmailVerificationCodeEmail = async ({ name, email, code }) => {
  const displayName = name || 'there';
  const safeCode = escapeHtml(code);

  return sendEmail({
    to: email,
    subject: 'Verify your MyPetPlus email address',
    text: `Hi ${displayName},\n\nUse this verification code to activate your MyPetPlus account: ${code}\n\nThis code expires in 10 minutes. If you did not create this account, you can safely ignore this email.\n\nThe MyPetPlus Team`,
    html: emailLayout({
      title: 'Verify your email address',
      preview: `Your MyPetPlus verification code is ${code}`,
      body: `<p style="font-size:15px;line-height:1.65;margin:0;">Hi ${escapeHtml(displayName)},</p>
        <p style="font-size:15px;line-height:1.65;">Thanks for joining MyPetPlus. Enter the verification code below to activate your pet owner account.</p>
        <div style="margin:24px 0;padding:18px;background:#edf7fb;border:1px solid #c9e7f0;border-radius:10px;text-align:center;font-size:30px;letter-spacing:8px;font-weight:700;color:#1d5b8f;">${safeCode}</div>
        <p style="font-size:14px;line-height:1.65;color:#4b5563;">This code expires in 10 minutes and can only be used once. If you did not create this account, you can safely ignore this email.</p>`,
    }),
  });
};

const sendAppointmentBookedEmail = async ({ veterinarian, petOwner, pet, appointment }) => {
  const doctorName = veterinarian?.name || 'Doctor';
  const patientName = petOwner?.name || 'A patient';
  const petName = pet?.name || 'the pet';
  const appointmentDate = formatDate(appointment?.appointmentDate);
  const appointmentTime = appointment?.appointmentTime || 'Not specified';
  const bookingType = appointment?.bookingType === 'ONLINE' ? 'Online consultation' : 'Clinic visit';
  const details = [
    ['Appointment reference', appointment?.appointmentNumber || appointment?._id],
    ['Patient', patientName],
    ['Pet', petName],
    ['Date', appointmentDate],
    ['Time', appointmentTime],
    ['Appointment type', bookingType],
    ['Reason for visit', appointment?.reason || 'Not specified'],
    ['Symptoms / notes', appointment?.petSymptoms || appointment?.emergencyDescription || 'Not specified'],
    ['Clinic', appointment?.clinicName || 'Not specified'],
  ];

  return sendEmail({
    to: veterinarian.email,
    subject: `New appointment request from ${patientName}`,
    text: `Hi ${doctorName},\n\n${patientName} has booked an appointment for ${petName} on ${appointmentDate} at ${appointmentTime}.\n\nPlease sign in to your MyPetPlus panel to accept or reject this appointment request.\n\nThe MyPetPlus Team`,
    html: emailLayout({
      title: 'New appointment request',
      preview: `${patientName} booked an appointment for ${petName}.`,
      body: `<p style="font-size:15px;line-height:1.65;margin:0;">Hi ${escapeHtml(doctorName)},</p>
        <p style="font-size:15px;line-height:1.65;">${escapeHtml(patientName)} has requested an appointment with you for ${escapeHtml(petName)}. Please review the details below and sign in to your MyPetPlus panel to <strong>accept or reject</strong> the request.</p>
        ${detailsTable(details)}
        <p style="font-size:14px;line-height:1.65;color:#4b5563;margin-bottom:0;">The appointment remains pending until you respond.</p>`,
    }),
  });
};

const sendAppointmentStatusEmail = async ({ petOwner, veterinarian, pet, appointment, status, reason }) => {
  const patientName = petOwner?.name || 'there';
  const doctorName = veterinarian?.name || 'your veterinarian';
  const petName = pet?.name || 'your pet';
  const accepted = String(status).toUpperCase() === 'CONFIRMED';
  const appointmentDate = formatDate(appointment?.appointmentDate);
  const appointmentTime = appointment?.appointmentTime || 'Not specified';
  const action = accepted ? 'accepted' : 'rejected';
  const details = [
    ['Appointment reference', appointment?.appointmentNumber || appointment?._id],
    ['Veterinarian', doctorName],
    ['Pet', petName],
    ['Date', appointmentDate],
    ['Time', appointmentTime],
    ...(!accepted && reason ? [['Reason', reason]] : []),
  ];

  return sendEmail({
    to: petOwner.email,
    subject: `Your appointment has been ${action}`,
    text: `Hi ${patientName},\n\nYour appointment for ${petName} with ${doctorName} on ${appointmentDate} at ${appointmentTime} has been ${action}.${!accepted && reason ? `\n\nReason: ${reason}` : ''}\n\nThe MyPetPlus Team`,
    html: emailLayout({
      title: accepted ? 'Your appointment has been accepted' : 'Your appointment has been rejected',
      preview: `Your appointment for ${petName} has been ${action}.`,
      body: `<p style="font-size:15px;line-height:1.65;margin:0;">Hi ${escapeHtml(patientName)},</p>
        <p style="font-size:15px;line-height:1.65;">${escapeHtml(doctorName)} has <strong>${action}</strong> your appointment request for ${escapeHtml(petName)}.</p>
        ${detailsTable(details)}
        <p style="font-size:14px;line-height:1.65;color:#4b5563;margin-bottom:0;">${accepted ? 'You can review the appointment in your MyPetPlus panel.' : 'Please sign in to your MyPetPlus panel if you would like to make another booking.'}</p>`,
    }),
  });
};

const sendNewOrderEmail = async ({ pharmacy, customer, order, products }) => {
  const pharmacyName = pharmacy?.name || 'Pharmacy';
  const customerName = customer?.name || 'A customer';
  const productLines = (products || [])
    .map((item) => `${item.name || 'Product'}${item.variantName ? ` (${item.variantName})` : ''} x${item.quantity} — ${formatAmount(item.total)}`)
    .join('\n');
  const productListHtml = (products || []).map((item) => `
    <tr><td style="padding:10px 0;border-bottom:1px solid #e5e7eb;font-size:14px;color:#1f2937;">
      <strong>${escapeHtml(item.name || 'Product')}</strong>${item.variantName ? `<br><span style="font-size:12px;color:#6b7280;">${escapeHtml(item.variantName)}</span>` : ''}
    </td><td style="padding:10px 0;border-bottom:1px solid #e5e7eb;font-size:14px;text-align:center;color:#1f2937;">${escapeHtml(item.quantity)}</td><td style="padding:10px 0;border-bottom:1px solid #e5e7eb;font-size:14px;text-align:right;color:#1f2937;font-weight:600;">${escapeHtml(formatAmount(item.total))}</td></tr>`).join('');
  const address = [
    order?.shippingAddress?.line1,
    order?.shippingAddress?.line2,
    [order?.shippingAddress?.zip, order?.shippingAddress?.city].filter(Boolean).join(' '),
    order?.shippingAddress?.state,
    order?.shippingAddress?.country,
  ].filter(Boolean).join(', ');

  return sendEmail({
    to: pharmacy.email,
    subject: `New order received: ${order?.orderNumber || 'MyPetPlus order'}`,
    text: `Hi ${pharmacyName},\n\nA new order has been received from ${customerName}.\n\nOrder: ${order?.orderNumber || order?._id}\nProducts:\n${productLines}\n\nOrder amount: ${formatAmount(order?.total)}\nDelivery address: ${address || 'Not specified'}\n\nPlease sign in to your MyPetPlus panel to review and manage this order.\n\nThe MyPetPlus Team`,
    html: emailLayout({
      title: 'You have received a new order',
      preview: `${customerName} placed order ${order?.orderNumber || ''}.`,
      body: `<p style="font-size:15px;line-height:1.65;margin:0;">Hi ${escapeHtml(pharmacyName)},</p>
        <p style="font-size:15px;line-height:1.65;">A new order has been received from <strong>${escapeHtml(customerName)}</strong>. Please sign in to your MyPetPlus panel to review and manage it.</p>
        ${detailsTable([
          ['Order reference', order?.orderNumber || order?._id],
          ['Customer', customerName],
          ['Customer email', customer?.email || 'Not specified'],
          ['Customer phone', customer?.phone || 'Not specified'],
          ['Order amount', formatAmount(order?.total)],
          ['Payment status', order?.paymentStatus || 'UNPAID'],
          ['Delivery address', address || 'Not specified'],
        ])}
        <h2 style="font-size:16px;margin:24px 0 8px;color:#172033;">Products ordered</h2>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
          <tr><th align="left" style="padding:8px 0;border-bottom:1px solid #d1d5db;font-size:12px;color:#6b7280;text-transform:uppercase;">Product</th><th align="center" style="padding:8px 0;border-bottom:1px solid #d1d5db;font-size:12px;color:#6b7280;text-transform:uppercase;">Qty</th><th align="right" style="padding:8px 0;border-bottom:1px solid #d1d5db;font-size:12px;color:#6b7280;text-transform:uppercase;">Total</th></tr>
          ${productListHtml}
        </table>`,
    }),
  });
};

const sendShippingFeeSetEmail = async ({ petOwner, pharmacy, order }) => {
  const patientName = petOwner?.name || 'there';
  const pharmacyName = pharmacy?.name || 'the pharmacy';
  const shippingFee = Number(order?.finalShipping ?? order?.shipping ?? 0);
  const total = Number(order?.total ?? 0);
  const promisedDeliveryDays = Number(order?.promisedDeliveryDays || 0);
  const expectedDeliveryDate = formatDate(order?.expectedDeliveryDate);
  const address = [
    order?.shippingAddress?.line1,
    order?.shippingAddress?.line2,
    [order?.shippingAddress?.zip, order?.shippingAddress?.city].filter(Boolean).join(' '),
    order?.shippingAddress?.state,
    order?.shippingAddress?.country,
  ].filter(Boolean).join(', ');

  return sendEmail({
    to: petOwner.email,
    subject: `Shipping fee set for order ${order?.orderNumber || ''}`.trim(),
    text: `Hi ${patientName},\n\n${pharmacyName} has set the shipping fee for your order.\n\nOrder: ${order?.orderNumber || order?._id}\nShipping fee: ${formatAmount(shippingFee)}\nUpdated total: ${formatAmount(total)}\nEstimated delivery: ${promisedDeliveryDays ? `${promisedDeliveryDays} Days` : '2-5 Days'}\nExpected delivery date: ${expectedDeliveryDate}\n\nYou can now complete payment in your MyPetPlus panel. The order will continue processing after payment is received.\n\nThe MyPetPlus Team`,
    html: emailLayout({
      title: 'Your order is ready for payment',
      preview: `The shipping fee for your order has been set.`,
      body: `<p style="font-size:15px;line-height:1.65;margin:0;">Hi ${escapeHtml(patientName)},</p>
        <p style="font-size:15px;line-height:1.65;">${escapeHtml(pharmacyName)} has set the shipping fee for your order. You can now complete payment in your MyPetPlus panel.</p>
        ${detailsTable([
          ['Order reference', order?.orderNumber || order?._id],
          ['Shipping fee', formatAmount(shippingFee)],
          ['Updated total', formatAmount(total)],
          ['Pharmacy delivery commitment', promisedDeliveryDays ? `${promisedDeliveryDays} Days` : '2-5 Days'],
          ['Expected delivery date', expectedDeliveryDate],
          ['Delivery address', address || 'Not specified'],
        ])}
        <div style="padding:14px 16px;background:#edf7fb;border:1px solid #c9e7f0;border-radius:8px;font-size:14px;line-height:1.6;color:#1f2937;">Your order will continue processing once payment has been received.</div>`,
    }),
  });
};

const sendContactQueryResolutionEmail = async ({ query, responseMessage }) => {
  const recipientName = query?.name || 'there';
  const responseHtml = escapeHtml(responseMessage).replace(/\r?\n/g, '<br />');

  return sendEmail({
    to: query.email,
    subject: 'Response to your MyPetPlus enquiry',
    text: `Hi ${recipientName},\n\nThank you for contacting MyPetPlus.\n\n${responseMessage}\n\nThe MyPetPlus Team`,
    html: emailLayout({
      title: 'Response to your enquiry',
      preview: 'MyPetPlus has responded to your Contact Us enquiry.',
      body: `<p style="font-size:15px;line-height:1.65;margin:0;">Hi ${escapeHtml(recipientName)},</p>
        <p style="font-size:15px;line-height:1.65;">Thank you for contacting MyPetPlus. Our team has reviewed your enquiry and provided the response below.</p>
        <div style="margin:20px 0;padding:18px;background:#f8fafc;border-left:4px solid #2d92b5;border-radius:4px;font-size:15px;line-height:1.7;color:#1f2937;">${responseHtml}</div>
        ${detailsTable([
          ['Your requested service', query?.services || 'Not specified'],
          ['Your original message', query?.message || 'Not specified'],
        ])}
        <p style="font-size:14px;line-height:1.65;color:#4b5563;margin-bottom:0;">If you need further assistance, please submit another enquiry and our team will be happy to help.</p>`,
    }),
  });
};

module.exports = {
  sendEmail,
  sendWelcomeEmail,
  sendApprovalEmail,
  sendPasswordVerificationCodeEmail,
  sendEmailVerificationCodeEmail,
  sendAppointmentBookedEmail,
  sendAppointmentStatusEmail,
  sendNewOrderEmail,
  sendShippingFeeSetEmail,
  sendContactQueryResolutionEmail,
};
