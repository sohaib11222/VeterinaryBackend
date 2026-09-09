const asyncHandler = require('../middleware/asyncHandler');
const path = require('path');
const petSitterService = require('../services/petSitter.service');
const { sendSuccess } = require('../utils/response');

exports.listPublic = asyncHandler(async (req, res) => sendSuccess(res, 'OK', await petSitterService.listPublic(req.query)));
exports.getPublic = asyncHandler(async (req, res) => sendSuccess(res, 'OK', await petSitterService.getProfileForUser(req.params.id, true)));
exports.getMine = asyncHandler(async (req, res) => sendSuccess(res, 'OK', await petSitterService.getProfileForUser(req.userId)));
exports.updateMine = asyncHandler(async (req, res) => sendSuccess(res, 'Profile updated successfully', await petSitterService.updateMyProfile(req.userId, req.body)));
exports.uploadDocuments = asyncHandler(async (req, res) => {
  const documents = (req.files || []).map((file) => ({
    fileUrl: `/uploads/${path.relative(path.join(process.cwd(), 'uploads'), file.path).replace(/\\/g, '/')}`,
    name: file.originalname,
    type: 'CERTIFICATION',
    uploadedAt: new Date(),
  }));
  return sendSuccess(res, 'Documents uploaded successfully', await petSitterService.addDocuments(req.userId, documents));
});
exports.listAdmin = asyncHandler(async (req, res) => sendSuccess(res, 'OK', await petSitterService.listAdmin(req.query)));
exports.updateStatus = asyncHandler(async (req, res) => sendSuccess(res, 'Pet sitter status updated', await petSitterService.setStatus(req.params.id, req.body.status)));
