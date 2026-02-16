/**
 * Add timeout to a promise
 * @param {Promise} promise - The promise to add timeout to
 * @param {number} ms - Timeout in milliseconds
 * @param {string} errorMessage - Error message if timeout occurs
 * @returns {Promise} Promise that rejects if timeout is reached
 */
const withTimeout = (promise, ms, errorMessage = 'Operation timed out') => {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(errorMessage)), ms)
    )
  ]);
};

module.exports = { withTimeout };
