const express = require('express');
const router = express.Router();
const controller = require('../controllers/footerOption.controller');
const { authGuard } = require('../middleware/authGuard');
const asyncHandler = require('../middleware/asyncHandler');

router.get('/', asyncHandler(controller.get));
router.put('/', authGuard(['ADMIN']), asyncHandler(controller.update));

module.exports = router;
