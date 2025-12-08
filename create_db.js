const { PrismaClient } = require('@prisma/client');

// Connect to default postgres database first
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://postgres:postgres123@localhost:5433/postgres?schema=public'
    }
  }
});

async function main() {
  try {
    // Check if retail_pos_db exists
    const result = await prisma.$queryRaw`
      SELECT datname FROM pg_database WHERE datname = 'retail_pos_db'
    `;

    if (result.length > 0) {
      console.log('✅ Database retail_pos_db already exists!');
    } else {
      console.log('Creating retail_pos_db database...');
      await prisma.$executeRawUnsafe('CREATE DATABASE retail_pos_db');
      console.log('✅ Database retail_pos_db created successfully!');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
