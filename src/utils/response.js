/**
 * Send success response
 */
const sendSuccess = (res, message = 'OK', data = null, statusCode = 200) => {
  const response = {
    success: true,
    message
  };
  
  if (data !== null) {
    response.data = data;
  }
  
  return res.status(statusCode).json(response);
};

/**
 * Send error response
 */
const sendError = (res, message = 'Error', statusCode = 400, errors = null) => {
  const response = {
    success: false,
    message
  };
  
  if (errors) {
    response.errors = errors;
  }
  
  return res.status(statusCode).json(response);
};

module.exports = {
  sendSuccess,
  sendError
};
