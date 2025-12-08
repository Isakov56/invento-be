import { Router } from 'express';
import {
  getAllProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  getLowStockProducts,
} from '../controllers/products.controller';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import { UserRole } from '@prisma/client';

const router = Router();

// All routes require authentication
router.use(authenticate);

// All roles can view products (CASHIER needs this for POS)
router.get('/', getAllProducts);
router.get('/low-stock', getLowStockProducts);
router.get('/:id', getProductById);

// Only OWNER and MANAGER can create, update, or delete products
router.post('/', authorize(UserRole.OWNER, UserRole.MANAGER), createProduct);
router.put('/:id', authorize(UserRole.OWNER, UserRole.MANAGER), updateProduct);
router.delete('/:id', authorize(UserRole.OWNER, UserRole.MANAGER), deleteProduct);

export default router;
