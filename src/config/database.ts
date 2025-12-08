import { PrismaClient } from '@prisma/client';

// Initialize Prisma Client with connection pooling for serverless
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

// For serverless environments (Vercel), we don't call $connect() explicitly
// Prisma will connect lazily on first query
if (process.env.NODE_ENV === 'development') {
  prisma.$connect()
    .then(() => {
      console.log('✅ Database connected successfully');
    })
    .catch((error) => {
      console.error('❌ Database connection failed:', error);
    });
}

// Graceful shutdown (only for non-serverless environments)
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  process.on('beforeExit', async () => {
    await prisma.$disconnect();
  });
}

export default prisma;
