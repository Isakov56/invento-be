import { Router } from 'express';
import {
  register,
  login,
  getProfile,
  updateProfile,
  changePassword,
  createEmployee,
  getAllEmployees,
  updateEmployee,
  deleteEmployee,
} from '../controllers/auth.controller';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import { loginRateLimiter, registerRateLimiter } from '../middlewares/security.middleware';
import { UserRole } from '@prisma/client';

const router = Router();

// Public routes (with rate limiting)
router.post('/register', registerRateLimiter, register); // Public - creates OWNER only
router.post('/login', loginRateLimiter, login);

// Protected routes
router.get('/profile', authenticate, getProfile);
router.put('/profile', authenticate, updateProfile);
router.put('/change-password', authenticate, changePassword);

// Employee management routes (OWNER/MANAGER only)
router.post('/employees', authenticate, authorize(UserRole.OWNER, UserRole.MANAGER), createEmployee);
router.get('/employees', authenticate, authorize(UserRole.OWNER, UserRole.MANAGER), getAllEmployees);
router.put('/employees/:id', authenticate, authorize(UserRole.OWNER, UserRole.MANAGER), updateEmployee);
router.delete('/employees/:id', authenticate, authorize(UserRole.OWNER), deleteEmployee);

export default router;
