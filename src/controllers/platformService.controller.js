const asyncHandler = require('../middleware/asyncHandler');
const service = require('../services/platformService.service');
const { sendSuccess } = require('../utils/response');

exports.list = asyncHandler(async (req, res) => sendSuccess(res, 'OK', await service.listServices()));
exports.listAdmin = asyncHandler(async (req, res) => sendSuccess(res, 'OK', await service.listServices({ includeInactive: true })));
exports.create = asyncHandler(async (req, res) => sendSuccess(res, 'Service created successfully', await service.createService(req.body), 201));
exports.update = asyncHandler(async (req, res) => sendSuccess(res, 'Service updated successfully', await service.updateService(req.params.id, req.body)));
exports.remove = asyncHandler(async (req, res) => { await service.deleteService(req.params.id); return sendSuccess(res, 'Service deleted successfully'); });
exports.myOfferings = asyncHandler(async (req, res) => sendSuccess(res, 'OK', await service.listMyOfferings(req.userId, req.userRole)));
exports.updateMyOfferings = asyncHandler(async (req, res) => sendSuccess(res, 'Service offerings updated successfully', await service.updateMyOfferings(req.userId, req.userRole, req.body.offerings)));
exports.providers = asyncHandler(async (req, res) => sendSuccess(res, 'OK', await service.listProviders(req.params.slug, req.query)));
