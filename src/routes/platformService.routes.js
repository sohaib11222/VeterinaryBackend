const express = require('express');
const router = express.Router();
const controller = require('../controllers/platformService.controller');
const { authGuard } = require('../middleware/authGuard');
const asyncHandler = require('../middleware/asyncHandler');

router.get('/', asyncHandler(controller.list));
router.get('/admin/all', authGuard(['ADMIN']), asyncHandler(controller.listAdmin));
router.get('/mine', authGuard(['VETERINARIAN', 'PET_SITTER', 'PET_STORE', 'PARAPHARMACY']), asyncHandler(controller.myOfferings));
router.put('/mine', authGuard(['VETERINARIAN', 'PET_SITTER', 'PET_STORE', 'PARAPHARMACY']), asyncHandler(controller.updateMyOfferings));
router.get('/:slug/providers', asyncHandler(controller.providers));
router.post('/', authGuard(['ADMIN']), asyncHandler(controller.create));
router.put('/:id', authGuard(['ADMIN']), asyncHandler(controller.update));
router.delete('/:id', authGuard(['ADMIN']), asyncHandler(controller.remove));

module.exports = router;
