const asyncHandler = require('../middleware/asyncHandler');
const footerOptionService = require('../services/footerOption.service');
const { sendSuccess } = require('../utils/response');

exports.get = asyncHandler(async (req, res) => {
  const result = await footerOptionService.getFooterOptions();
  return sendSuccess(res, 'OK', result);
});

exports.update = asyncHandler(async (req, res) => {
  const result = await footerOptionService.updateFooterOptions(req.body);
  return sendSuccess(res, 'Footer options updated successfully', result);
});
