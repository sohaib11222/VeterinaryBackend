const asyncHandler = require('../middleware/asyncHandler');
const videoSessionService = require('../services/videoSession.service');
const { sendSuccess } = require('../utils/response');

const serializeSessionCredentials = (result) => ({
  sessionId: result.session._id,
  streamToken: result.streamToken,
  streamCallId: result.streamCallId,
  streamApiKey: result.streamApiKey,
  session: result.session,
});

/** Start a video session for the authenticated appointment participant. */
exports.startSession = asyncHandler(async (req, res) => {
  const { appointmentId, restartActive = false } = req.body;
  const userId = req.userId;
  const userName = req.user?.name || req.user?.email || 'User';

  if (!appointmentId) {
    return res.status(400).json({ success: false, message: 'Appointment ID is required' });
  }

  const result = await videoSessionService.startSession(
    appointmentId,
    userId,
    userName,
    { restartActive: restartActive === true }
  );
  return sendSuccess(res, 'Video session started', serializeSessionCredentials(result));
});

/** End a ringing or active session. The service intentionally makes this idempotent. */
exports.endSession = asyncHandler(async (req, res) => {
  const { sessionId } = req.body;
  if (!sessionId) {
    return res.status(400).json({ success: false, message: 'Video call ID is required' });
  }
  const result = await videoSessionService.endSession(sessionId, req.userId);
  return sendSuccess(res, 'Video session ended', result);
});

/** Accept an incoming call and return the receiver's immediate join credentials. */
exports.acceptSession = asyncHandler(async (req, res) => {
  const { sessionId } = req.body;
  if (!sessionId) {
    return res.status(400).json({ success: false, message: 'Video call ID is required' });
  }

  const result = await videoSessionService.acceptSession(
    sessionId,
    req.userId,
    req.user?.name || req.user?.email || 'User'
  );
  return sendSuccess(res, 'Video call accepted', serializeSessionCredentials(result));
});

/** Get the current session and a fresh token for the authenticated participant. */
exports.getByAppointment = asyncHandler(async (req, res) => {
  const { appointmentId } = req.params;
  const userId = req.userId;
  const userName = req.user?.name || req.user?.email || 'User';

  const result = await videoSessionService.getSessionByAppointment(appointmentId, userId, userName);
  return sendSuccess(res, 'OK', serializeSessionCredentials(result));
});

/** List calls currently ringing for the authenticated user. */
exports.getIncoming = asyncHandler(async (req, res) => {
  const sessions = await videoSessionService.getIncomingSessions(req.userId);
  return sendSuccess(res, 'OK', { sessions });
});
