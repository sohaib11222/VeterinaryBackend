const express = require('express');
const router = express.Router();
const vaccineController = require('../controllers/vaccine.controller');
const { authGuard, requireRole } = require('../middleware/authGuard');
const asyncHandler = require('../middleware/asyncHandler');

router.use(authGuard());

router.get('/', asyncHandler(vaccineController.list));

router.use(requireRole('ADMIN'));

router.post('/', asyncHandler(vaccineController.create));
router.put('/:id', asyncHandler(vaccineController.update));
router.delete('/:id', asyncHandler(vaccineController.delete));

module.exports = router;
