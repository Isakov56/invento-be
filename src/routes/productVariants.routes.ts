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
// NOTE: More specific routes MUST come before generic /:id routes
router.get('/sku/:sku', getVariantBySku);
router.get('/barcode/:barcode', getVariantByBarcode);
router.get('/product/:productId', getProductVariants);

// Only OWNER and MANAGER can create, update, or delete variants
// NOTE: Specific action routes MUST come before generic /:id routes
router.post('/product/:productId', authorize(UserRole.OWNER, UserRole.MANAGER), createVariant);
router.patch('/:id/stock', authorize(UserRole.OWNER, UserRole.MANAGER), adjustStock);

// Generic /:id routes (GET, PATCH, DELETE) MUST come after specific routes
router.get('/:id', getVariantById);
router.patch('/:id', authorize(UserRole.OWNER, UserRole.MANAGER), updateVariant);
router.delete('/:id', authorize(UserRole.OWNER, UserRole.MANAGER), deleteVariant);

export default router;
