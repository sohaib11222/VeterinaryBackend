const express = require('express');
const router = express.Router();
const videoSessionController = require('../controllers/videoSession.controller');
const { authGuard } = require('../middleware/authGuard');
const asyncHandler = require('../middleware/asyncHandler');

router.use(authGuard());

/**
 * Start video session
 */
router.post('/create', asyncHandler(videoSessionController.startSession));

/**
 * End video session
 */
router.post('/end', asyncHandler(videoSessionController.endSession));

/**
 * Get session by appointment ID
 */
router.get('/appointment/:appointmentId', asyncHandler(videoSessionController.getByAppointment));

module.exports = router;
