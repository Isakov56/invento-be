import { Request, Response } from 'express';
import prisma from '../config/database';
import { sendSuccess, sendError } from '../utils/response';

/**
 * Get all products with optional filtering (TENANT-FILTERED)
 * Only returns products belonging to the authenticated user's owner
 */
export const getAllProducts = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { categoryId, storeId, isActive, search } = req.query;

    // CRITICAL: Ensure tenant context exists
    if (!req.ownerId) {
      return sendError(res, 'Unauthorized - no tenant context', 401);
    }

    const where: any = {
      ownerId: req.ownerId, // TENANT FILTER - CRITICAL!
    };

    if (categoryId) where.categoryId = categoryId as string;
    if (storeId) where.storeId = storeId as string;
    if (isActive !== undefined) where.isActive = isActive === 'true';
    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { description: { contains: search as string, mode: 'insensitive' } },
        { brand: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    const products = await prisma.product.findMany({
      where,
      include: {
        category: {
          select: {
            id: true,
            name: true,
          },
        },
        store: {
          select: {
            id: true,
            name: true,
          },
        },
        variants: {
          select: {
            id: true,
            sku: true,
            size: true,
            color: true,
            sellingPrice: true,
            stockQuantity: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return sendSuccess(res, products, 'Products retrieved successfully');
  } catch (error: any) {
    console.error('Get products error:', error);
    return sendError(res, error.message || 'Failed to retrieve products', 500);
  }
};

/**
 * Get a single product by ID (TENANT-FILTERED)
 * Only returns product if it belongs to the authenticated user's owner
 */
export const getProductById = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;

    // CRITICAL: Ensure tenant context exists
    if (!req.ownerId) {
      return sendError(res, 'Unauthorized - no tenant context', 401);
    }

    const product = await prisma.product.findFirst({
      where: {
        id,
        ownerId: req.ownerId, // TENANT FILTER - ensures user can only access their own products
      },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
        store: {
          select: {
            id: true,
            name: true,
            address: true,
            city: true,
          },
        },
        variants: {
          include: {
            _count: {
              select: { transactionItems: true },
            },
          },
        },
      },
    });

    if (!product) {
      return sendError(res, 'Product not found', 404);
    }

    return sendSuccess(res, product, 'Product retrieved successfully');
  } catch (error: any) {
    console.error('Get product error:', error);
    return sendError(res, error.message || 'Failed to retrieve product', 500);
  }
};

/**
 * Create a new product (TENANT-SCOPED)
 * Product will be created under the authenticated user's owner
 */
export const createProduct = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { name, description, categoryId, storeId, brand, imageUrl, isActive } = req.body;

    // CRITICAL: Ensure tenant context exists
    if (!req.ownerId) {
      return sendError(res, 'Unauthorized - no tenant context', 401);
    }

    // Validate required fields
    if (!name || !categoryId || !storeId) {
      return sendError(res, 'Product name, category, and store are required', 400);
    }

    // Verify category exists AND belongs to this owner
    const category = await prisma.category.findFirst({
      where: {
        id: categoryId,
        ownerId: req.ownerId, // TENANT VALIDATION
      },
    });

    if (!category) {
      return sendError(res, 'Category not found', 404);
    }

    // Verify store exists AND belongs to this owner
    const store = await prisma.store.findFirst({
      where: {
        id: storeId,
        ownerId: req.ownerId, // TENANT VALIDATION
      },
    });

    if (!store) {
      return sendError(res, 'Store not found', 404);
    }

    const product = await prisma.product.create({
      data: {
        name,
        description,
        categoryId,
        storeId,
        brand,
        imageUrl,
        isActive: isActive !== undefined ? isActive : true,
        ownerId: req.ownerId, // CRITICAL: Assign product to the authenticated owner
      },
      include: {
        category: {
          select: {
            id: true,
            name: true,
          },
        },
        store: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return sendSuccess(res, product, 'Product created successfully', 201);
  } catch (error: any) {
    console.error('Create product error:', error);
    return sendError(res, error.message || 'Failed to create product', 500);
  }
};

/**
 * Update a product (TENANT-VALIDATED)
 * Can only update products belonging to the authenticated user's owner
 */
export const updateProduct = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;
    const { name, description, categoryId, storeId, brand, imageUrl, isActive } = req.body;

    // CRITICAL: Ensure tenant context exists
    if (!req.ownerId) {
      return sendError(res, 'Unauthorized - no tenant context', 401);
    }

    // Check if product exists AND belongs to this owner (TENANT VALIDATION)
    const existingProduct = await prisma.product.findFirst({
      where: {
        id,
        ownerId: req.ownerId, // CRITICAL: Ensure product belongs to this owner
      },
    });

    if (!existingProduct) {
      return sendError(res, 'Product not found', 404);
    }

    // If categoryId is being updated, verify it exists AND belongs to this owner
    if (categoryId && categoryId !== existingProduct.categoryId) {
      const category = await prisma.category.findFirst({
        where: {
          id: categoryId,
          ownerId: req.ownerId, // TENANT VALIDATION
        },
      });

      if (!category) {
        return sendError(res, 'Category not found', 404);
      }
    }

    // If storeId is being updated, verify it exists AND belongs to this owner
    if (storeId && storeId !== existingProduct.storeId) {
      const store = await prisma.store.findFirst({
        where: {
          id: storeId,
          ownerId: req.ownerId, // TENANT VALIDATION
        },
      });

      if (!store) {
        return sendError(res, 'Store not found', 404);
      }
    }

    const updatedProduct = await prisma.product.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(categoryId && { categoryId }),
        ...(storeId && { storeId }),
        ...(brand !== undefined && { brand }),
        ...(imageUrl !== undefined && { imageUrl }),
        ...(isActive !== undefined && { isActive }),
      },
      include: {
        category: {
          select: {
            id: true,
            name: true,
          },
        },
        store: {
          select: {
            id: true,
            name: true,
          },
        },
        variants: {
          select: {
            id: true,
            sku: true,
            size: true,
            color: true,
            sellingPrice: true,
            stockQuantity: true,
          },
        },
      },
    });

    return sendSuccess(res, updatedProduct, 'Product updated successfully');
  } catch (error: any) {
    console.error('Update product error:', error);
    return sendError(res, error.message || 'Failed to update product', 500);
  }
};

/**
 * Delete a product (TENANT-VALIDATED)
 * Can only delete products belonging to the authenticated user's owner
 */
export const deleteProduct = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;

    // CRITICAL: Ensure tenant context exists
    if (!req.ownerId) {
      return sendError(res, 'Unauthorized - no tenant context', 401);
    }

    // Check if product exists AND belongs to this owner (TENANT VALIDATION)
    const product = await prisma.product.findFirst({
      where: {
        id,
        ownerId: req.ownerId, // CRITICAL: Ensure product belongs to this owner
      },
      include: {
        variants: {
          include: {
            _count: {
              select: { transactionItems: true },
            },
          },
        },
      },
    });

    if (!product) {
      return sendError(res, 'Product not found', 404);
    }

    // Check if any variant has transactions
    const hasTransactions = product.variants.some(
      variant => variant._count.transactionItems > 0
    );

    if (hasTransactions) {
      return sendError(
        res,
        'Cannot delete product. It has transactions associated with it. Consider deactivating instead.',
        400
      );
    }

    // Delete product (variants will be cascade deleted)
    await prisma.product.delete({
      where: { id },
    });

    return sendSuccess(res, null, 'Product deleted successfully');
  } catch (error: any) {
    console.error('Delete product error:', error);
    return sendError(res, error.message || 'Failed to delete product', 500);
  }
};

/**
 * Get low stock products (TENANT-FILTERED)
 * Only returns low stock products belonging to the authenticated user's owner
 */
export const getLowStockProducts = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { storeId } = req.query;

    // CRITICAL: Ensure tenant context exists
    if (!req.ownerId) {
      return sendError(res, 'Unauthorized - no tenant context', 401);
    }

    const where: any = {
      isActive: true,
      ownerId: req.ownerId, // TENANT FILTER - CRITICAL!
    };

    if (storeId) where.storeId = storeId as string;

    const products = await prisma.product.findMany({
      where,
      include: {
        variants: {
          where: {
            stockQuantity: {
              lte: prisma.productVariant.fields.lowStockThreshold,
            },
          },
          select: {
            id: true,
            sku: true,
            size: true,
            color: true,
            stockQuantity: true,
            lowStockThreshold: true,
          },
        },
        category: {
          select: {
            id: true,
            name: true,
          },
        },
        store: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Filter out products with no low stock variants
    const lowStockProducts = products.filter(product => product.variants.length > 0);

    return sendSuccess(
      res,
      lowStockProducts,
      `Found ${lowStockProducts.length} product(s) with low stock`
    );
  } catch (error: any) {
    console.error('Get low stock products error:', error);
    return sendError(res, error.message || 'Failed to retrieve low stock products', 500);
  }
};
