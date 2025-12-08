import { Router } from 'express';
import { uploadImage, uploadMultipleImages as uploadMultiple, deleteImage } from '../controllers/upload.controller';
import { uploadSingleImage, uploadMultipleImages } from '../middlewares/upload.middleware';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

// All routes are protected
router.use(authenticate);

// Single image upload
router.post('/image', uploadSingleImage, uploadImage);

// Multiple images upload
router.post('/images', uploadMultipleImages, uploadMultiple);

// Delete image
router.delete('/image/:filename', deleteImage);

export default router;
