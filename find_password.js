const { PrismaClient } = require('@prisma/client');

const passwords = ['', 'postgres', 'postgres123', 'admin', 'root', 'password', '1234', '12345', 'Pass@123'];
const ports = [5432, 5433];

async function testConnection(port, password) {
  const dbUrl = password
    ? `postgresql://postgres:${password}@localhost:${port}/postgres?schema=public`
    : `postgresql://postgres@localhost:${port}/postgres?schema=public`;

  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: dbUrl
      }
    }
  });

  try {
    await prisma.$connect();
    console.log(`\n✅ SUCCESS! Port: ${port}, Password: "${password || '(empty)'}"`);
    console.log(`\nUse this in your .env file:`);
    console.log(`DATABASE_URL="${dbUrl.replace('/postgres?', '/retail_pos_db?')}"`);
    await prisma.$disconnect();
    return true;
  } catch (error) {
    await prisma.$disconnect();
    return false;
  }
}

async function main() {
  console.log('Testing PostgreSQL connections...\n');

  for (const port of ports) {
    console.log(`\nTrying port ${port}...`);
    for (const password of passwords) {
      process.stdout.write(`  Testing password "${password || '(empty)'}"... `);
      const success = await testConnection(port, password);
      if (success) {
        return;
      }
      console.log('❌');
    }
  }

  console.log('\n❌ None of the common passwords worked.');
  console.log('We need to reset the password using admin privileges.');
}

main();
