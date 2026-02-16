const asyncHandler = require('../middleware/asyncHandler');
const videoSessionService = require('../services/videoSession.service');
const { sendSuccess } = require('../utils/response');

/**
 * Start video session
 */
exports.startSession = asyncHandler(async (req, res) => {
  const { appointmentId } = req.body;
  const userId = req.userId;
  const userName = req.user?.name || req.user?.email || 'User';
  
  if (!appointmentId) {
    return res.status(400).json({
      success: false,
      message: 'Appointment ID is required'
    });
  }
  
  const result = await videoSessionService.startSession(
    appointmentId,
    userId,
    userName
  );
  
  return sendSuccess(res, 'Video session started', {
    sessionId: result.session._id,
    streamToken: result.streamToken,
    streamCallId: result.streamCallId,
    session: result.session
  });
});

/**
 * End video session
 */
exports.endSession = asyncHandler(async (req, res) => {
  const { sessionId } = req.body;
  const result = await videoSessionService.endSession(sessionId);
  return sendSuccess(res, 'Video session ended', result);
});

/**
 * Get session by appointment ID
 */
exports.getByAppointment = asyncHandler(async (req, res) => {
  const { appointmentId } = req.params;
  const userId = req.userId;
  const userName = req.user?.name || req.user?.email || 'User';
  
  const result = await videoSessionService.getSessionByAppointment(
    appointmentId,
    userId,
    userName
  );
  
  return sendSuccess(res, 'OK', {
    sessionId: result.session._id,
    streamToken: result.streamToken,
    streamCallId: result.streamCallId,
    session: result.session
  });
});
