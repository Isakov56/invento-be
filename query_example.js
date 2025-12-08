const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Example 1: Get all users sorted by name
  const users = await prisma.user.findMany({
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true
    }
  });
  console.log('Users:', users);

  // Example 2: Get users with specific role
  const managers = await prisma.user.findMany({
    where: { role: 'MANAGER' }
  });
  console.log('\nManagers:', managers);

  // Example 3: Count products by category
  const categories = await prisma.category.findMany({
    include: {
      _count: {
        select: { products: true }
      }
    }
  });
  console.log('\nCategories with product count:', categories);

  // Example 4: Get recent transactions with items
  const transactions = await prisma.transaction.findMany({
    take: 10, // Limit to 10
    orderBy: { createdAt: 'desc' },
    include: {
      items: {
        include: {
          productVariant: {
            include: {
              product: true
            }
          }
        }
      },
      user: true
    }
  });
  console.log('\nRecent transactions:', JSON.stringify(transactions, null, 2));

  // Example 5: Complex filtering and sorting
  const products = await prisma.product.findMany({
    where: {
      stock: {
        gte: 10 // Greater than or equal to 10
      },
      isActive: true
    },
    orderBy: [
      { categoryId: 'asc' },
      { name: 'asc' }
    ],
    include: {
      category: true,
      variants: true
    }
  });
  console.log('\nProducts in stock:', products);

  // Example 6: Aggregation - Total sales
  const totalSales = await prisma.transaction.aggregate({
    _sum: {
      totalAmount: true
    },
    where: {
      type: 'SALE'
    }
  });
  console.log('\nTotal sales amount:', totalSales._sum.totalAmount);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
