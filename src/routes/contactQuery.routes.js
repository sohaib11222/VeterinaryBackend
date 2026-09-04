const express = require('express');
const router = express.Router();
const controller = require('../controllers/contactQuery.controller');
const { authGuard } = require('../middleware/authGuard');
const asyncHandler = require('../middleware/asyncHandler');

router.post('/', asyncHandler(controller.create));
router.get('/', authGuard(['ADMIN']), asyncHandler(controller.list));
router.get('/:id', authGuard(['ADMIN']), asyncHandler(controller.getById));
router.patch('/:id', authGuard(['ADMIN']), asyncHandler(controller.update));
router.post('/:id/resolve', authGuard(['ADMIN']), asyncHandler(controller.resolve));
router.delete('/:id', authGuard(['ADMIN']), asyncHandler(controller.remove));

module.exports = router;
