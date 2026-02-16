/**
 * Request timeout middleware
 * Automatically sends timeout response if request takes too long
 */
const timeout = (ms = 30000) => { // 30 seconds default
  return (req, res, next) => {
    const startTime = Date.now();
    const timer = setTimeout(() => {
      if (!res.headersSent) {
        const elapsed = Date.now() - startTime;
        
        // Use req.originalUrl instead of req.path to avoid confusion with internal routing
        const displayPath = req.originalUrl || req.path;
        
        console.error(`[Timeout] Request ${req.method} ${displayPath} timed out after ${elapsed}ms`);
        console.error(`[Timeout] Query might be slow or database connection issue`);
        
        // Log more info about the request
        console.error(`[Timeout] Request Details:`, {
          method: req.method,
          path: displayPath,
          query: req.query,
          userId: req.userId,
          userRole: req.userRole,
          headers: {
            authorization: req.headers.authorization ? 'Present' : 'Missing',
            'content-type': req.headers['content-type']
          }
        });

        res.status(504).json({
          success: false,
          message: 'Request timeout - Server took too long to respond',
          path: displayPath,
          elapsed: elapsed,
          suggestion: 'Check database indexes and connection. Run: node fix_timeout_comprehensive.js'
        });
      }
    }, ms);

    // Clear timeout when response is sent
    const originalEnd = res.end;
    res.end = function(...args) {
      clearTimeout(timer);
      const elapsed = Date.now() - startTime;
      if (elapsed > 5000) {
        console.warn(`[Slow Request] ${req.method} ${req.path} took ${elapsed}ms`);
      }
      originalEnd.apply(this, args);
    };

    next();
  };
};

module.exports = timeout;
