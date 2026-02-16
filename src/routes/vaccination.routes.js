const express = require('express');
const router = express.Router();
const vaccinationController = require('../controllers/vaccination.controller');
const { authGuard, requireRole } = require('../middleware/authGuard');
const asyncHandler = require('../middleware/asyncHandler');

router.use(authGuard());

/**
 * Get vaccinations
 */
router.get('/', asyncHandler(vaccinationController.list));

/**
 * Get upcoming vaccinations
 */
router.get('/upcoming', asyncHandler(vaccinationController.getUpcoming));

router.use(requireRole('VETERINARIAN', 'ADMIN'));

/**
 * Create vaccination
 */
router.post('/', asyncHandler(vaccinationController.create));

/**
 * Update vaccination
 */
router.put('/:id', asyncHandler(vaccinationController.update));

/**
 * Delete vaccination
 */
router.delete('/:id', asyncHandler(vaccinationController.delete));

module.exports = router;
