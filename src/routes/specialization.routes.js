const express = require('express');
const router = express.Router();
const specializationController = require('../controllers/specialization.controller');
const { authGuard } = require('../middleware/authGuard');
const asyncHandler = require('../middleware/asyncHandler');

// Public routes
router.get('/', asyncHandler(specializationController.list));

// Admin routes - authGuard(['ADMIN']) must be invoked
router.use(authGuard(['ADMIN']));

/**
 * Create specialization
 */
router.post('/', asyncHandler(specializationController.create));

/**
 * Update specialization
 */
router.put('/:id', asyncHandler(specializationController.update));

/**
 * Delete specialization
 */
router.delete('/:id', asyncHandler(specializationController.delete));

module.exports = router;
