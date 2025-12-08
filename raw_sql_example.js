const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Example 1: Raw SQL query
  const users = await prisma.$queryRaw`
    SELECT id, name, email, role
    FROM "User"
    WHERE role = 'MANAGER'
    ORDER BY name ASC
  `;
  console.log('Managers:', users);

  // Example 2: Complex query with JOIN
  const productsWithCategories = await prisma.$queryRaw`
    SELECT
      p.id,
      p.name as product_name,
      p.price,
      p.stock,
      c.name as category_name
    FROM "Product" p
    LEFT JOIN "Category" c ON p."categoryId" = c.id
    WHERE p.stock > 0
    ORDER BY c.name, p.name
  `;
  console.log('\nProducts with categories:', productsWithCategories);

  // Example 3: Aggregation query
  const salesStats = await prisma.$queryRaw`
    SELECT
      DATE(t."createdAt") as sale_date,
      COUNT(*) as transaction_count,
      SUM(t."totalAmount") as total_revenue
    FROM "Transaction" t
    WHERE t.type = 'SALE'
    GROUP BY DATE(t."createdAt")
    ORDER BY sale_date DESC
    LIMIT 7
  `;
  console.log('\nSales stats (last 7 days):', salesStats);

  // Example 4: Execute raw SQL (INSERT/UPDATE/DELETE)
  const result = await prisma.$executeRaw`
    UPDATE "Product"
    SET stock = stock - 1
    WHERE id = 'some-product-id' AND stock > 0
  `;
  console.log('\nRows affected:', result);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
