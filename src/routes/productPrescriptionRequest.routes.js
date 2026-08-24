const express = require('express');
const router = express.Router();
const controller = require('../controllers/productPrescriptionRequest.controller');
const { authGuard } = require('../middleware/authGuard');
const asyncHandler = require('../middleware/asyncHandler');

router.get('/mine', authGuard(['PET_OWNER']), asyncHandler(controller.listMine));
router.get('/product/:productId/eligibility', authGuard(['PET_OWNER']), asyncHandler(controller.getEligibility));
router.post('/', authGuard(['PET_OWNER']), asyncHandler(controller.submit));

router.get('/pharmacy', authGuard(['PET_STORE']), asyncHandler(controller.listForPharmacy));
router.get('/pharmacy/pending-count', authGuard(['PET_STORE']), asyncHandler(controller.countPending));
router.put('/:id/review', authGuard(['PET_STORE']), asyncHandler(controller.review));

module.exports = router;
