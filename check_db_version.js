const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkVersion() {
  try {
    const result = await prisma.$queryRaw`SELECT version()`;
    console.log('\n📊 PostgreSQL Version:');
    console.log(result[0].version);

    // Extract just the version number
    const versionMatch = result[0].version.match(/PostgreSQL (\d+\.\d+)/);
    if (versionMatch) {
      console.log('\n✅ Version:', versionMatch[1]);
    }
  } catch (error) {
    console.error('❌ Error checking database version:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkVersion();
