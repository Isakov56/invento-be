const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});

async function main() {
  try {
    await prisma.$connect();
    console.log('✅ Connected to database successfully!');

    const result = await prisma.$queryRaw`SELECT current_database(), version()`;
    console.log('Database info:', result);

  } catch (error) {
    console.error('❌ Connection error:', error.message);
    console.error('Full error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
