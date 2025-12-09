/**
 * Fix product image URLs by matching them with uploaded files
 * This script fixes products that have relative URLs instead of Cloudinary URLs
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function fixProductImageUrls() {
  try {
    console.log('Starting image URL fix...');

    // Get all products with image URLs
    const products = await prisma.product.findMany({
      where: {
        imageUrl: {
          not: null,
        },
      },
    });

    console.log(`Found ${products.length} products with image URLs`);

    let fixedCount = 0;

    for (const product of products) {
      // If it's already a full URL, skip it
      if (product.imageUrl.startsWith('http://') || product.imageUrl.startsWith('https://')) {
        continue;
      }

      // Try to find the uploaded file by filename
      const filename = product.imageUrl.split('/').pop(); // Get filename from path
      
      const uploadedFile = await prisma.uploadedFile.findUnique({
        where: { filename },
      });

      if (uploadedFile && uploadedFile.url) {
        // Update product with the correct URL
        await prisma.product.update({
          where: { id: product.id },
          data: { imageUrl: uploadedFile.url },
        });
        
        console.log(`✅ Fixed product ${product.id}: ${product.name}`);
        fixedCount++;
      } else {
        console.log(`⚠️  Could not find uploaded file for ${product.id}: ${product.imageUrl}`);
      }
    }

    console.log(`\n✨ Fixed ${fixedCount} products`);
  } catch (error) {
    console.error('Error fixing image URLs:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixProductImageUrls();
