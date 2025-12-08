import { Request, Response, NextFunction } from 'express';
import { verifyToken, JwtPayload } from '../utils/jwt';
import { sendError } from '../utils/response';
import { UserRole } from '@prisma/client';

// Extend Express Request type to include user and tenant context
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
      ownerId?: string; // Tenant context - the owner ID for filtering data
    }
  }
}

/**
 * Middleware to verify JWT token and extract tenant context
 */
export const authenticate = (
  req: Request,
  res: Response,
  next: NextFunction
): void | Response => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return sendError(res, 'No token provided', 401);
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify token
    const decoded = verifyToken(token);

    // Attach user to request
    req.user = decoded;

    // CRITICAL: Attach tenant context (ownerId) to request
    // This is used for filtering all queries to ensure data isolation
    req.ownerId = decoded.ownerId;

    next();
  } catch (error) {
    return sendError(res, 'Invalid or expired token', 401);
  }
};

/**
 * Middleware to check if user has required role
 */
export const authorize = (...allowedRoles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction): void | Response => {
    if (!req.user) {
      return sendError(res, 'Unauthorized', 401);
    }

    const userRole = req.user.role as UserRole;

    if (!allowedRoles.includes(userRole)) {
      return sendError(
        res,
        'You do not have permission to access this resource',
        403
      );
    }

    next();
  };
};

/**
 * Middleware to ensure tenant context exists (defense in depth)
 * Use this on routes that manipulate tenant-specific data
 */
export const requireTenant = (
  req: Request,
  res: Response,
  next: NextFunction
): void | Response => {
  if (!req.ownerId) {
    return sendError(
      res,
      'Unauthorized - no tenant context found. This should not happen.',
      401
    );
  }
  next();
};
