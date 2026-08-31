const asyncHandler = require('../middleware/asyncHandler');
const veterinarianService = require('../services/veterinarian.service');
const { sendSuccess } = require('../utils/response');
const PDFDocument = require('pdfkit');

/**
 * Upsert veterinarian profile
 */
exports.upsertProfile = asyncHandler(async (req, res) => {
  const result = await veterinarianService.upsertVeterinarianProfile(req.userId, req.body);
  return sendSuccess(res, 'Profile updated successfully', result);
});

/**
 * Get veterinarian profile (uses token for authenticated veterinarians)
 */
exports.getProfile = asyncHandler(async (req, res) => {
  const result = await veterinarianService.getVeterinarianProfile(req.userId);
  return sendSuccess(res, 'OK', result);
});

/**
 * Get veterinarian profile by user ID (public access)
 */
exports.getProfileById = asyncHandler(async (req, res) => {
  const result = await veterinarianService.getVeterinarianProfile(req.params.id);
  return sendSuccess(res, 'OK', result);
});

/**
 * List veterinarians with filtering
 */
exports.listVeterinarians = asyncHandler(async (req, res) => {
  const result = await veterinarianService.listVeterinarians(req.query);
  return sendSuccess(res, 'OK', result);
});

/**
 * Get veterinarian dashboard
 */
exports.getDashboard = asyncHandler(async (req, res) => {
  const result = await veterinarianService.getVeterinarianDashboard(req.userId);
  return sendSuccess(res, 'OK', result);
});

/**
 * Get veterinarian's reviews
 */
exports.getReviews = asyncHandler(async (req, res) => {
  const result = await veterinarianService.getVeterinarianReviews(req.userId, req.query);
  return sendSuccess(res, 'OK', result);
});

/**
 * Buy subscription plan
 */
exports.buySubscriptionPlan = asyncHandler(async (req, res) => {
  const result = await veterinarianService.buySubscriptionPlan(req.userId, req.body.planId);
  return sendSuccess(res, 'Subscription plan purchased successfully', result);
});

/**
 * Get current subscription
 */
exports.getMySubscription = asyncHandler(async (req, res) => {
  const result = await veterinarianService.getMySubscription(req.userId);
  return sendSuccess(res, 'OK', result);
});

exports.getInvoices = asyncHandler(async (req, res) => {
  const result = await veterinarianService.getVeterinarianInvoices(req.userId, req.query);
  return sendSuccess(res, 'OK', result);
});

exports.getInvoiceByTransactionId = asyncHandler(async (req, res) => {
  const result = await veterinarianService.getVeterinarianInvoiceByTransactionId(req.userId, req.params.transactionId);
  return sendSuccess(res, 'OK', result);
});

exports.downloadInvoicePdf = asyncHandler(async (req, res) => {
  const invoice = await veterinarianService.getVeterinarianInvoiceByTransactionId(req.userId, req.params.transactionId);
  const appointment = invoice?.relatedAppointmentId || {};
  const petOwner = appointment?.petOwnerId || invoice?.userId || {};
  const pet = appointment?.petId || {};
  const amount = Number(invoice?.amount || 0);
  const currency = invoice?.currency || 'EUR';
  const appointmentNumber = String(appointment?.appointmentNumber || invoice?._id || 'invoice').replace(/[^a-z0-9-_]/gi, '-');

  res.status(200);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="veterinary-invoice-${appointmentNumber}.pdf"`);

  const document = new PDFDocument({ margin: 50, size: 'A4' });
  document.info.Title = `Veterinary invoice ${appointmentNumber}`;
  document.pipe(res);

  const line = (label, value) => {
    document.font('Helvetica-Bold').text(label, { continued: true });
    document.font('Helvetica').text(` ${value || '—'}`);
  };
  const formatDate = (value) => value ? new Date(value).toLocaleString('it-IT') : '—';

  document.fillColor('#0b5d5a').font('Helvetica-Bold').fontSize(24).text('MyPetPlus');
  document.fillColor('#172033').fontSize(18).text('Veterinary invoice', { align: 'right' });
  document.moveDown(1.2);
  document.font('Helvetica').fontSize(10).fillColor('#5c667a').text(`Invoice reference: ${appointmentNumber}`);
  document.text(`Issued: ${formatDate(invoice?.createdAt)}`);
  document.moveDown(1.5);

  document.fillColor('#172033').font('Helvetica-Bold').fontSize(13).text('Appointment details');
  document.moveDown(0.4).fontSize(10).font('Helvetica').fillColor('#2f3a4f');
  line('Pet owner:', petOwner?.name || petOwner?.fullName || petOwner?.email);
  line('Pet:', pet?.name ? `${pet.name}${pet.species ? ` (${pet.species})` : ''}` : null);
  line('Appointment date:', appointment?.appointmentDate ? new Date(appointment.appointmentDate).toLocaleDateString('it-IT') : null);
  line('Appointment time:', appointment?.appointmentTime);
  document.moveDown(1.5);

  document.fillColor('#172033').font('Helvetica-Bold').fontSize(13).text('Payment summary');
  document.moveDown(0.5);
  document.roundedRect(50, document.y, 495, 58, 8).fill('#eef8f6');
  document.fillColor('#172033').font('Helvetica').fontSize(10).text('Consultation payment', 68, document.y + 13);
  document.font('Helvetica-Bold').fontSize(18).text(`${currency === 'EUR' ? '€' : `${currency} `}${amount.toFixed(2)}`, 68, document.y + 6, { align: 'right', width: 460 });
  document.moveDown(4.5);
  line('Payment status:', invoice?.status || 'SUCCESS');
  line('Payment method:', invoice?.provider || 'STRIPE');
  line('Transaction ID:', String(invoice?._id || '—'));
  document.moveDown(3);
  document.fillColor('#6b7280').font('Helvetica').fontSize(9).text('This invoice was generated electronically by MyPetPlus.', { align: 'center' });
  document.end();
});
