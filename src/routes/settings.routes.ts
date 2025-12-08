import { Router } from 'express';
import {
  getBusinessSettings,
  updateBusinessSettings,
  getUserPreferences,
  updateUserPreferences,
} from '../controllers/settings.controller';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import { UserRole } from '@prisma/client';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Business settings routes (OWNER only)
router.get('/business', authorize(UserRole.OWNER), getBusinessSettings);
router.put('/business', authorize(UserRole.OWNER), updateBusinessSettings);

// User preferences routes (all authenticated users)
router.get('/user', getUserPreferences);
router.put('/user', updateUserPreferences);

export default router;
