import { Router } from 'express';
import {
  getAllCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
} from '../controllers/categories.controller';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import { UserRole } from '@prisma/client';

const router = Router();

// All routes require authentication
router.use(authenticate);

// All roles can view categories (needed for POS, product selection, etc.)
router.get('/', getAllCategories);
router.get('/:id', getCategoryById);

// Only OWNER and MANAGER can create, update, or delete categories
router.post('/', authorize(UserRole.OWNER, UserRole.MANAGER), createCategory);
router.put('/:id', authorize(UserRole.OWNER, UserRole.MANAGER), updateCategory);
router.delete('/:id', authorize(UserRole.OWNER, UserRole.MANAGER), deleteCategory);

export default router;
