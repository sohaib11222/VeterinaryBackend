const express = require('express');
const router = express.Router();
const petController = require('../controllers/pet.controller');
const { authGuard, requireRole } = require('../middleware/authGuard');
const asyncHandler = require('../middleware/asyncHandler');

// All pet routes require authentication
router.use(authGuard());

// Pet Owner can manage their own pets
router.get('/', asyncHandler(petController.listPets));
router.post('/', asyncHandler(petController.createPet));
router.get('/:id', asyncHandler(petController.getPet));
router.put('/:id', asyncHandler(petController.updatePet));
router.delete('/:id', asyncHandler(petController.deletePet));

module.exports = router;
