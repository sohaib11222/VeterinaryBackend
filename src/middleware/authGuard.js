const { verifyToken } = require('../utils/jwt');
const User = require('../models/User');
const { sendError } = require('../utils/response');
const { USER_STATUS } = require('../types/enums');

/**
 * Authentication guard middleware factory
 * Usage: 
 * - router.use(authGuard())
 * - router.get('/path', authGuard(['ADMIN']), controller)
 */
const authGuard = (allowedRoles = []) => {
  // Normalize roles array
  const roles = Array.isArray(allowedRoles) && allowedRoles.length > 0 && Array.isArray(allowedRoles[0])
    ? allowedRoles[0]
    : Array.isArray(allowedRoles) ? allowedRoles : [];

  return async (req, res, next) => {
    try {
      let token;

      // Get token from header
      if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
      }

      if (!token) {
        return sendError(res, 'Not authorized, no token', 401);
      }

      try {
        // Verify token
        const decoded = verifyToken(token);
        
        // Get user from token
        const user = await User.findById(decoded.userId)
          .select('-password')
          .lean()
          .maxTimeMS(2000);
        
        if (!user) {
          return sendError(res, 'User not found', 404);
        }

        // Check if user is blocked
        if (user.status === 'BLOCKED' || user.status === USER_STATUS.BLOCKED) {
          return sendError(res, 'User account is blocked', 403);
        }

        // Check role if roles are specified
        if (roles.length > 0) {
          const userRole = (user.role || '').toUpperCase();
          const normalizedRoles = roles.map(role => (role || '').toUpperCase());
          const isAuthorized = normalizedRoles.includes(userRole);

          if (!isAuthorized) {
            return sendError(res, 'Access denied. Insufficient permissions', 403);
          }
        }

        // Attach user to request
        req.userId = user._id.toString();
        req.userRole = user.role;
        req.user = user;
        
        next();
      } catch (error) {
        return sendError(res, 'Not authorized, token failed', 401);
      }
    } catch (error) {
      return sendError(res, 'Authentication error', 500);
    }
  };
};

/**
 * Role-based access control middleware
 */
const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.userRole) {
      return sendError(res, 'Not authorized', 401);
    }

    if (!roles.includes(req.userRole)) {
      return sendError(res, 'Access denied. Insufficient permissions', 403);
    }

    next();
  };
};

/**
 * Check if user is approved (for veterinarians)
 */
const requireApproved = async (req, res, next) => {
  try {
    const user = await User.findById(req.userId).maxTimeMS(2000);
    
    if (!user) {
      return sendError(res, 'User not found', 404);
    }

    if (user.status !== USER_STATUS.APPROVED) {
      return sendError(res, 'Account not approved. Please wait for admin approval', 403);
    }

    next();
  } catch (error) {
    return sendError(res, 'Authorization error', 500);
  }
};

module.exports = {
  authGuard,
  requireRole,
  requireApproved
};
