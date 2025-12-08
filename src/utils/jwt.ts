import jwt from 'jsonwebtoken';
import config from '../config/env';

export interface JwtPayload {
  userId: string;
  email: string;
  role: string;
  // Multi-tenancy: ownerId for tenant context
  // For OWNER role: ownerId === userId (they are their own tenant)
  // For MANAGER/CASHIER: ownerId is their business owner's ID
  ownerId: string;
}

/**
 * Generate JWT token
 */
export const generateToken = (payload: JwtPayload): string => {
  return jwt.sign(payload, config.jwtSecret as string, {
    expiresIn: config.jwtExpiresIn,
  } as any);
};

/**
 * Verify JWT token
 */
export const verifyToken = (token: string): JwtPayload => {
  try {
    const decoded = jwt.verify(token, config.jwtSecret) as JwtPayload;
    return decoded;
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
};

/**
 * Decode JWT token without verification (for debugging)
 */
export const decodeToken = (token: string): JwtPayload | null => {
  try {
    return jwt.decode(token) as JwtPayload;
  } catch (error) {
    return null;
  }
};
