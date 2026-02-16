const express = require('express');
const router = express.Router();
const { authGuard } = require('../middleware/authGuard');
const asyncHandler = require('../middleware/asyncHandler');

const prescriptionController = require('../controllers/prescription.controller');
const prescriptionService = require('../services/prescription.service');
const { streamPrescriptionPdf } = require('../services/prescriptionPdf.service');

router.post(
  '/appointment/:appointmentId',
  authGuard(['VETERINARIAN']),
  asyncHandler(prescriptionController.upsertForAppointment)
);

router.get(
  '/appointment/:appointmentId',
  authGuard(['VETERINARIAN', 'PET_OWNER']),
  asyncHandler(prescriptionController.getByAppointment)
);

router.get(
  '/',
  authGuard(['PET_OWNER']),
  asyncHandler(prescriptionController.listMine)
);

router.get(
  '/:id',
  authGuard(['VETERINARIAN', 'PET_OWNER']),
  asyncHandler(prescriptionController.getById)
);

router.get(
  '/:id/pdf',
  authGuard(['VETERINARIAN', 'PET_OWNER']),
  asyncHandler(async (req, res) => {
    const prescription = await prescriptionService.getPrescriptionById(req.params.id, req.userId, req.userRole);
    streamPrescriptionPdf({ res, prescription });
  })
);

module.exports = router;
