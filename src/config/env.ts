import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

interface Config {
  port: number;
  nodeEnv: string;
  databaseUrl: string;
  jwtSecret: string;
  jwtExpiresIn: string;
  corsOrigin: string | string[];
  maxFileSize: number;
  uploadPath: string;
  cloudinaryCloudName?: string;
  cloudinaryApiKey?: string;
  cloudinaryApiSecret?: string;
}

// Parse CORS_ORIGIN - supports single URL or comma-separated URLs
const parseCorsOrigin = (origin: string | undefined): string | string[] => {
  if (!origin) return 'http://localhost:5173';

  // Check if multiple origins (comma-separated)
  if (origin.includes(',')) {
    return origin.split(',').map(url => url.trim());
  }

  return origin;
};

const config: Config = {
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: process.env.DATABASE_URL || '',
  jwtSecret: process.env.JWT_SECRET || 'fallback-secret-key',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  corsOrigin: parseCorsOrigin(process.env.CORS_ORIGIN),
  maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '5242880', 10),
  uploadPath: process.env.UPLOAD_PATH || './uploads',
  cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME,
  cloudinaryApiKey: process.env.CLOUDINARY_API_KEY,
  cloudinaryApiSecret: process.env.CLOUDINARY_API_SECRET,
};

// Validate required environment variables
if (!config.databaseUrl) {
  throw new Error('DATABASE_URL is not defined in environment variables');
}

if (config.jwtSecret === 'fallback-secret-key' && config.nodeEnv === 'production') {
  throw new Error('JWT_SECRET must be defined in production environment');
}

export default config;
