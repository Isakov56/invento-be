import { Router } from 'express';
import {
  getAllTransactions,
  getTransactionById,
  createTransaction,
  getTransactionStats,
  getTodayTransactions,
} from '../controllers/transactions.controller';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import { UserRole } from '@prisma/client';

const router = Router();

// All routes require authentication
router.use(authenticate);

// All roles can create transactions (POS operation)
router.post('/', createTransaction);

// Only OWNER and MANAGER can view transaction lists, stats, and details
router.get('/', authorize(UserRole.OWNER, UserRole.MANAGER), getAllTransactions);
router.get('/stats', authorize(UserRole.OWNER, UserRole.MANAGER), getTransactionStats);
router.get('/today', authorize(UserRole.OWNER, UserRole.MANAGER), getTodayTransactions);
router.get('/:id', authorize(UserRole.OWNER, UserRole.MANAGER), getTransactionById);

export default router;
