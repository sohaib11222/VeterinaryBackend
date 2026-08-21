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

/** Accept a call that is ringing for the authenticated participant. */
router.post('/accept', asyncHandler(videoSessionController.acceptSession));

/**
 * End video session
 */
router.post('/end', asyncHandler(videoSessionController.endSession));

/** Calls currently ringing for the authenticated user. */
router.get('/incoming', asyncHandler(videoSessionController.getIncoming));

/**
 * Get session by appointment ID
 */
router.get('/appointment/:appointmentId', asyncHandler(videoSessionController.getByAppointment));

module.exports = router;
