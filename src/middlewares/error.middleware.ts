import { Request, Response, NextFunction } from 'express';
import { sendError } from '../utils/response';

/**
 * Global error handling middleware
 */
export const errorHandler = (
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
): Response => {
  console.error('Error:', err);

  // Prisma error handling
  if (err.code === 'P2002') {
    return sendError(res, 'A record with this value already exists', 409);
  }

  if (err.code === 'P2025') {
    return sendError(res, 'Record not found', 404);
  }

  // Validation errors
  if (err.name === 'ValidationError') {
    return sendError(res, err.message, 400);
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return sendError(res, 'Invalid token', 401);
  }

  if (err.name === 'TokenExpiredError') {
    return sendError(res, 'Token expired', 401);
  }

  // Default error
  return sendError(
    res,
    err.message || 'Internal server error',
    err.statusCode || 500
  );
};

/**
 * 404 handler
 */
export const notFoundHandler = (
  req: Request,
  res: Response,
  _next: NextFunction
): Response => {
  return sendError(res, `Route ${req.originalUrl} not found`, 404);
};
