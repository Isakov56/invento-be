const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('Releasing advisory locks...');
    await prisma.$executeRaw`SELECT pg_advisory_unlock_all()`;
    console.log('✅ Locks released');

    console.log('\nTerminating idle connections...');
    await prisma.$executeRaw`
      SELECT pg_terminate_backend(pid)
      FROM pg_stat_activity
      WHERE datname = 'retail_pos_db'
      AND pid <> pg_backend_pid()
      AND state = 'idle'
    `;
    console.log('✅ Idle connections terminated');
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
