import { Router } from 'express';
import {
  generateQRCode,
  generateBulkQRCodes,
  generateProductQRCodes,
  decodeQRCode,
} from '../controllers/qrcode.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

// All routes are protected
router.use(authenticate);

router.get('/variant/:variantId', generateQRCode);
router.post('/bulk', generateBulkQRCodes);
router.get('/product/:productId', generateProductQRCodes);
router.post('/decode', decodeQRCode);

export default router;
