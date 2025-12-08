import { Router } from 'express';
import {
  getSalesReport,
  getTopSellingProducts,
  getPaymentMethodBreakdown,
  getInventoryValueReport,
  exportReportCSV,
  exportReportPDF,
} from '../controllers/reports.controller';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import { UserRole } from '@prisma/client';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Only OWNER and MANAGER can access reports (financial data)
router.get('/sales', authorize(UserRole.OWNER, UserRole.MANAGER), getSalesReport);
router.get('/top-products', authorize(UserRole.OWNER, UserRole.MANAGER), getTopSellingProducts);
router.get('/payment-methods', authorize(UserRole.OWNER, UserRole.MANAGER), getPaymentMethodBreakdown);
router.get('/inventory-value', authorize(UserRole.OWNER, UserRole.MANAGER), getInventoryValueReport);

// Only OWNER and MANAGER can export reports
router.post('/export/csv', authorize(UserRole.OWNER, UserRole.MANAGER), exportReportCSV);
router.post('/export/pdf', authorize(UserRole.OWNER, UserRole.MANAGER), exportReportPDF);

export default router;
