const mongoose = require('mongoose');

/**
 * Validate if a string is a valid MongoDB ObjectId
 * @param {string} id - The ID to validate
 * @returns {boolean} True if valid, false otherwise
 */
const isValidObjectId = (id) => {
  // HTTP inputs are strings, but values coming from Mongoose queries are
  // ObjectId instances. Both represent valid references in service code.
  return Boolean(id) && mongoose.Types.ObjectId.isValid(id);
};

/**
 * Validate ObjectId and throw error if invalid
 * @param {string} id - The ID to validate
 * @param {string} fieldName - Name of the field for error message
 * @throws {Error} If ID is invalid
 */
const validateObjectId = (id, fieldName = 'ID') => {
  if (!id) {
    throw new Error(`${fieldName} is required`);
  }
  if (!isValidObjectId(id)) {
    throw new Error(`Invalid ${fieldName} format`);
  }
};

module.exports = {
  isValidObjectId,
  validateObjectId
};
