/**
 * Validation middleware using Zod
 */
const validate = (schema) => {
  return (req, res, next) => {
    try {
      // Validate request body, query, and params
      const data = {
        body: req.body,
        query: req.query,
        params: req.params
      };

      const result = schema.safeParse(data);

      if (!result.success) {
        const errors = result.error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message
        }));

        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors
        });
      }

      // Replace request data with validated data
      req.body = result.data.body || req.body;
      req.query = result.data.query || req.query;
      req.params = result.data.params || req.params;

      next();
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Validation error',
        error: error.message
      });
    }
  };
};

module.exports = validate;
