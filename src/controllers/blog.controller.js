const asyncHandler = require('../middleware/asyncHandler');
const blogService = require('../services/blog.service');
const { sendSuccess } = require('../utils/response');

/**
 * Create blog post
 */
exports.create = asyncHandler(async (req, res) => {
  const blogData = {
    ...req.body,
    authorId: req.userId
  };
  const result = await blogService.createBlogPost(blogData);
  return sendSuccess(res, 'Blog post created successfully', result, 201);
});

/**
 * Update blog post
 */
exports.update = asyncHandler(async (req, res) => {
  const result = await blogService.updateBlogPost(req.params.id, req.body);
  return sendSuccess(res, 'Blog post updated successfully', result);
});

/**
 * Get blog post by ID
 */
exports.getById = asyncHandler(async (req, res) => {
  const result = await blogService.getBlogPost(req.params.id);
  return sendSuccess(res, 'OK', result);
});

/**
 * List blog posts with filtering
 */
exports.list = asyncHandler(async (req, res) => {
  const result = await blogService.listBlogPosts(req.query);
  return sendSuccess(res, 'OK', result);
});

/**
 * Delete blog post
 */
exports.delete = asyncHandler(async (req, res) => {
  await blogService.deleteBlogPost(req.params.id);
  return sendSuccess(res, 'Blog post deleted successfully');
});
