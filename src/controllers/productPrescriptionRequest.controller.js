const asyncHandler = require('../middleware/asyncHandler');
const prescriptionRequestService = require('../services/productPrescriptionRequest.service');
const { sendSuccess } = require('../utils/response');

exports.submit = asyncHandler(async (req, res) => {
  const result = await prescriptionRequestService.submitRequest(req.userId, req.body);
  return sendSuccess(res, 'Prescription submitted for pharmacy review', result, 201);
});

exports.getEligibility = asyncHandler(async (req, res) => {
  const result = await prescriptionRequestService.getEligibility(req.userId, req.params.productId, req.query.variantId);
  return sendSuccess(res, 'OK', result);
});

exports.listMine = asyncHandler(async (req, res) => {
  const result = await prescriptionRequestService.listMine(req.userId, req.query);
  return sendSuccess(res, 'OK', result);
});

exports.listForPharmacy = asyncHandler(async (req, res) => {
  const result = await prescriptionRequestService.listForPharmacy(req.userId, req.query);
  return sendSuccess(res, 'OK', result);
});

exports.review = asyncHandler(async (req, res) => {
  const result = await prescriptionRequestService.reviewRequest(req.userId, req.params.id, req.body);
  return sendSuccess(res, 'Prescription request reviewed', result);
});

exports.countPending = asyncHandler(async (req, res) => {
  const result = await prescriptionRequestService.countPendingForPharmacy(req.userId);
  return sendSuccess(res, 'OK', result);
});
