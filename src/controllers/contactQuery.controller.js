const asyncHandler = require('../middleware/asyncHandler');
const contactQueryService = require('../services/contactQuery.service');
const { sendSuccess } = require('../utils/response');

exports.create = asyncHandler(async (req, res) => {
  const result = await contactQueryService.createContactQuery(req.body);
  return sendSuccess(res, 'Your message has been sent successfully', result, 201);
});

exports.list = asyncHandler(async (req, res) => {
  const result = await contactQueryService.listContactQueries(req.query);
  return sendSuccess(res, 'OK', result);
});

exports.getById = asyncHandler(async (req, res) => {
  const result = await contactQueryService.getContactQuery(req.params.id);
  return sendSuccess(res, 'OK', result);
});

exports.update = asyncHandler(async (req, res) => {
  const result = await contactQueryService.updateContactQuery(req.params.id, req.body, req.userId);
  return sendSuccess(res, 'Contact query updated successfully', result);
});

exports.remove = asyncHandler(async (req, res) => {
  const result = await contactQueryService.deleteContactQuery(req.params.id);
  return sendSuccess(res, 'Contact query deleted successfully', result);
});
