import { Router } from 'express';
import {
  getProductVariants,
  getVariantById,
  getVariantBySku,
  getVariantByBarcode,
  createVariant,
  updateVariant,
  adjustStock,
  deleteVariant,
} from '../controllers/productVariants.controller';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import { UserRole } from '@prisma/client';

const router = Router();

// All routes require authentication
router.use(authenticate);

// All roles can lookup/view variants (CASHIER needs this for POS scanning)
router.get('/sku/:sku', getVariantBySku);
router.get('/barcode/:barcode', getVariantByBarcode);
router.get('/product/:productId', getProductVariants);
router.get('/:id', getVariantById);

// Only OWNER and MANAGER can create, update, or delete variants
router.post('/product/:productId', authorize(UserRole.OWNER, UserRole.MANAGER), createVariant);
router.put('/:id', authorize(UserRole.OWNER, UserRole.MANAGER), updateVariant);
router.patch('/:id/stock', authorize(UserRole.OWNER, UserRole.MANAGER), adjustStock);
router.delete('/:id', authorize(UserRole.OWNER, UserRole.MANAGER), deleteVariant);

export default router;
