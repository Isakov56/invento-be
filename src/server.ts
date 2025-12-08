import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import config from './config/env';
import authRoutes from './routes/auth.routes';
import categoriesRoutes from './routes/categories.routes';
import productsRoutes from './routes/products.routes';
import productVariantsRoutes from './routes/productVariants.routes';
import uploadRoutes from './routes/upload.routes';
import storesRoutes from './routes/stores.routes';
import transactionsRoutes from './routes/transactions.routes';
import qrcodeRoutes from './routes/qrcode.routes';
import reportsRoutes from './routes/reports.routes';
import settingsRoutes from './routes/settings.routes';
import { errorHandler, notFoundHandler } from './middlewares/error.middleware';
import { apiRateLimiter } from './middlewares/security.middleware';

// Initialize Express app
const app: Application = express();

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }, // Allow images to be loaded
}));

// CORS
app.use(cors({
  origin: config.corsOrigin,
  credentials: true,
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Apply rate limiting to all API routes
app.use('/api', apiRateLimiter);

// Serve static files (uploaded images)
app.use('/uploads', express.static(config.uploadPath));

// Health check route
app.get('/health', (_req, res) => {
  res.json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/variants', productVariantsRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/stores', storesRoutes);
app.use('/api/transactions', transactionsRoutes);
app.use('/api/qrcode', qrcodeRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/settings', settingsRoutes);

// 404 handler
app.use(notFoundHandler);

// Error handler (must be last)
app.use(errorHandler);

// Start server
const PORT = config.port;

app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
  console.log(`📝 Environment: ${config.nodeEnv}`);
  console.log(`🔗 API URL: http://localhost:${PORT}`);
});

export default app;
