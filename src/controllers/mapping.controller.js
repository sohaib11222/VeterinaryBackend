const asyncHandler = require('../middleware/asyncHandler');
const mappingService = require('../services/mapping.service');
const { sendSuccess } = require('../utils/response');

/**
 * Get route from pet owner to clinic
 */
exports.getRoute = asyncHandler(async (req, res) => {
  const { fromLat, fromLng, toLat, toLng } = req.query;
  
  if (!fromLat || !fromLng || !toLat || !toLng) {
    return res.status(400).json({
      success: false,
      message: 'Missing required parameters: fromLat, fromLng, toLat, toLng'
    });
  }
  
  const result = await mappingService.getRoute(
    { lat: parseFloat(fromLat), lng: parseFloat(fromLng) },
    { lat: parseFloat(toLat), lng: parseFloat(toLng) }
  );
  return sendSuccess(res, 'OK', result);
});

/**
 * Get all clinics with coordinates
 */
exports.getClinicsWithCoordinates = asyncHandler(async (req, res) => {
  const result = await mappingService.getClinicsWithCoordinates();
  return sendSuccess(res, 'OK', result);
});

/**
 * Get nearby clinics
 */
exports.getNearbyClinics = asyncHandler(async (req, res) => {
  const { lat, lng, radius } = req.query;
  
  if (!lat || !lng) {
    return res.status(400).json({
      success: false,
      message: 'Missing required parameters: lat, lng'
    });
  }
  
  const result = await mappingService.getNearbyClinics(
    parseFloat(lat),
    parseFloat(lng),
    radius ? parseFloat(radius) : 10
  );
  return sendSuccess(res, 'OK', result);
});

/**
 * Get clinic location by ID
 */
exports.getClinicLocation = asyncHandler(async (req, res) => {
  const result = await mappingService.getClinicLocation(req.params.id);
  return sendSuccess(res, 'OK', result);
});
