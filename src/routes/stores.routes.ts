import { Router } from 'express';
import {
  getAllStores,
  getStoreById,
  createStore,
  updateStore,
  deleteStore,
} from '../controllers/stores.controller';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import { UserRole } from '@prisma/client';

const router = Router();

// All routes require authentication
router.use(authenticate);

// All roles can view stores (needed for dropdown selections, etc.)
router.get('/', getAllStores);
router.get('/:id', getStoreById);

// Only OWNER can create, update, or delete stores
router.post('/', authorize(UserRole.OWNER), createStore);
router.put('/:id', authorize(UserRole.OWNER), updateStore);
router.delete('/:id', authorize(UserRole.OWNER), deleteStore);

export default router;
