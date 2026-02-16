const express = require('express');
const router = express.Router();
const productController = require('../controllers/product.controller');
const { authGuard, requireRole } = require('../middleware/authGuard');
const asyncHandler = require('../middleware/asyncHandler');

// Public routes
router.get('/', asyncHandler(productController.list));

// Protected routes
router.get(
  '/mine',
  authGuard(),
  requireRole('ADMIN', 'PET_STORE', 'PARAPHARMACY'),
  asyncHandler(productController.listMine)
);

router.get('/:id', asyncHandler(productController.getById));

// Protected routes
router.use(authGuard());

/**
 * Create product (Veterinarian, Pet Store, Admin)
 */
router.post('/', requireRole('ADMIN', 'PET_STORE', 'PARAPHARMACY'), asyncHandler(productController.create));

/**
 * Update product
 */
router.put('/:id', requireRole('ADMIN', 'PET_STORE', 'PARAPHARMACY'), asyncHandler(productController.update));

/**
 * Delete product
 */
router.delete('/:id', requireRole('ADMIN', 'PET_STORE', 'PARAPHARMACY'), asyncHandler(productController.delete));

module.exports = router;
