import { Request, Response } from 'express';
import prisma from '../config/database';
import { sendSuccess, sendError } from '../utils/response';

/**
 * Get all variants for a product (TENANT-FILTERED)
 * Only returns variants for products belonging to the authenticated user's owner
 */
export const getProductVariants = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { productId } = req.params;

    // CRITICAL: Ensure tenant context exists
    if (!req.ownerId) {
      return sendError(res, 'Unauthorized - no tenant context', 401);
    }

    // Verify product exists AND belongs to this owner (TENANT VALIDATION)
    const product = await prisma.product.findFirst({
      where: {
        id: productId,
        ownerId: req.ownerId, // TENANT FILTER
      },
    });

    if (!product) {
      return sendError(res, 'Product not found', 404);
    }

    const variants = await prisma.productVariant.findMany({
      where: { productId },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            imageUrl: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return sendSuccess(res, variants, 'Product variants retrieved successfully');
  } catch (error: any) {
    console.error('Get product variants error:', error);
    return sendError(res, error.message || 'Failed to retrieve product variants', 500);
  }
};

/**
 * Get a single variant by ID (TENANT-FILTERED)
 * Only returns variant if its product belongs to the authenticated user's owner
 */
export const getVariantById = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;

    // CRITICAL: Ensure tenant context exists
    if (!req.ownerId) {
      return sendError(res, 'Unauthorized - no tenant context', 401);
    }

    const variant = await prisma.productVariant.findUnique({
      where: { id },
      include: {
        product: {
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
        },
        _count: {
          select: { transactionItems: true },
        },
      },
    });

    // TENANT VALIDATION: Check variant exists AND product belongs to owner
    if (!variant || variant.product.ownerId !== req.ownerId) {
      return sendError(res, 'Product variant not found', 404);
    }

    return sendSuccess(res, variant, 'Product variant retrieved successfully');
  } catch (error: any) {
    console.error('Get variant error:', error);
    return sendError(res, error.message || 'Failed to retrieve product variant', 500);
  }
};

/**
 * Get variant by SKU (TENANT-FILTERED)
 * Only returns variant if its product belongs to the authenticated user's owner
 */
export const getVariantBySku = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { sku } = req.params;

    // CRITICAL: Ensure tenant context exists
    if (!req.ownerId) {
      return sendError(res, 'Unauthorized - no tenant context', 401);
    }

    const variant = await prisma.productVariant.findUnique({
      where: { sku },
      include: {
        product: {
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
        },
      },
    });

    // TENANT VALIDATION: Check variant exists AND product belongs to owner
    if (!variant || variant.product.ownerId !== req.ownerId) {
      return sendError(res, 'Product variant not found', 404);
    }

    return sendSuccess(res, variant, 'Product variant retrieved successfully');
  } catch (error: any) {
    console.error('Get variant by SKU error:', error);
    return sendError(res, error.message || 'Failed to retrieve product variant', 500);
  }
};

/**
 * Get variant by barcode (TENANT-FILTERED)
 * Only returns variant if its product belongs to the authenticated user's owner
 */
export const getVariantByBarcode = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { barcode } = req.params;

    // CRITICAL: Ensure tenant context exists
    if (!req.ownerId) {
      return sendError(res, 'Unauthorized - no tenant context', 401);
    }

    const variant = await prisma.productVariant.findUnique({
      where: { barcode },
      include: {
        product: {
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
        },
      },
    });

    // TENANT VALIDATION: Check variant exists AND product belongs to owner
    if (!variant || variant.product.ownerId !== req.ownerId) {
      return sendError(res, 'Product variant not found', 404);
    }

    return sendSuccess(res, variant, 'Product variant retrieved successfully');
  } catch (error: any) {
    console.error('Get variant by barcode error:', error);
    return sendError(res, error.message || 'Failed to retrieve product variant', 500);
  }
};

/**
 * Create a new product variant (TENANT-VALIDATED)
 * Can only create variants for products belonging to the authenticated user's owner
 */
export const createVariant = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { productId } = req.params;
    const {
      sku,
      size,
      color,
      barcode,
      qrCode,
      costPrice,
      sellingPrice,
      stockQuantity,
      lowStockThreshold,
    } = req.body;

    // CRITICAL: Ensure tenant context exists
    if (!req.ownerId) {
      return sendError(res, 'Unauthorized - no tenant context', 401);
    }

    // Validate required fields
    if (!sku || costPrice === undefined || sellingPrice === undefined) {
      return sendError(res, 'SKU, cost price, and selling price are required', 400);
    }

    // Verify product exists AND belongs to this owner (TENANT VALIDATION)
    const product = await prisma.product.findFirst({
      where: {
        id: productId,
        ownerId: req.ownerId, // CRITICAL: Ensure product belongs to this owner
      },
    });

    if (!product) {
      return sendError(res, 'Product not found', 404);
    }

    // Check if SKU already exists
    const existingSku = await prisma.productVariant.findUnique({
      where: { sku },
    });

    if (existingSku) {
      return sendError(res, 'SKU already exists', 409);
    }

    // Check if barcode already exists (if provided)
    if (barcode) {
      const existingBarcode = await prisma.productVariant.findUnique({
        where: { barcode },
      });

      if (existingBarcode) {
        return sendError(res, 'Barcode already exists', 409);
      }
    }

    // Check if QR code already exists (if provided)
    if (qrCode) {
      const existingQrCode = await prisma.productVariant.findUnique({
        where: { qrCode },
      });

      if (existingQrCode) {
        return sendError(res, 'QR code already exists', 409);
      }
    }

    const variant = await prisma.productVariant.create({
      data: {
        productId,
        sku,
        size,
        color,
        barcode,
        qrCode,
        costPrice,
        sellingPrice,
        stockQuantity: stockQuantity || 0,
        lowStockThreshold: lowStockThreshold || 10,
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            imageUrl: true,
          },
        },
      },
    });

    return sendSuccess(res, variant, 'Product variant created successfully', 201);
  } catch (error: any) {
    console.error('Create variant error:', error);
    return sendError(res, error.message || 'Failed to create product variant', 500);
  }
};

/**
 * Update a product variant (TENANT-VALIDATED)
 * Can only update variants for products belonging to the authenticated user's owner
 */
export const updateVariant = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;
    const {
      sku,
      size,
      color,
      barcode,
      qrCode,
      costPrice,
      sellingPrice,
      stockQuantity,
      lowStockThreshold,
    } = req.body;

    // CRITICAL: Ensure tenant context exists
    if (!req.ownerId) {
      return sendError(res, 'Unauthorized - no tenant context', 401);
    }

    // Check if variant exists AND belongs to this owner (TENANT VALIDATION)
    const existingVariant = await prisma.productVariant.findUnique({
      where: { id },
      include: {
        product: true,
      },
    });

    if (!existingVariant || existingVariant.product.ownerId !== req.ownerId) {
      return sendError(res, 'Product variant not found', 404);
    }

    // If SKU is being updated, check for duplicates
    if (sku && sku !== existingVariant.sku) {
      const duplicateSku = await prisma.productVariant.findUnique({
        where: { sku },
      });

      if (duplicateSku) {
        return sendError(res, 'SKU already exists', 409);
      }
    }

    // If barcode is being updated, check for duplicates
    if (barcode && barcode !== existingVariant.barcode) {
      const duplicateBarcode = await prisma.productVariant.findUnique({
        where: { barcode },
      });

      if (duplicateBarcode) {
        return sendError(res, 'Barcode already exists', 409);
      }
    }

    // If QR code is being updated, check for duplicates
    if (qrCode && qrCode !== existingVariant.qrCode) {
      const duplicateQrCode = await prisma.productVariant.findUnique({
        where: { qrCode },
      });

      if (duplicateQrCode) {
        return sendError(res, 'QR code already exists', 409);
      }
    }

    const updatedVariant = await prisma.productVariant.update({
      where: { id },
      data: {
        ...(sku && { sku }),
        ...(size !== undefined && { size }),
        ...(color !== undefined && { color }),
        ...(barcode !== undefined && { barcode }),
        ...(qrCode !== undefined && { qrCode }),
        ...(costPrice !== undefined && { costPrice }),
        ...(sellingPrice !== undefined && { sellingPrice }),
        ...(stockQuantity !== undefined && { stockQuantity }),
        ...(lowStockThreshold !== undefined && { lowStockThreshold }),
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            imageUrl: true,
          },
        },
      },
    });

    return sendSuccess(res, updatedVariant, 'Product variant updated successfully');
  } catch (error: any) {
    console.error('Update variant error:', error);
    return sendError(res, error.message || 'Failed to update product variant', 500);
  }
};

/**
 * Adjust stock quantity for a variant (TENANT-VALIDATED)
 * Can only adjust stock for variants of products belonging to the authenticated user's owner
 */
export const adjustStock = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;
    const { adjustment, reason } = req.body;

    // CRITICAL: Ensure tenant context exists
    if (!req.ownerId) {
      return sendError(res, 'Unauthorized - no tenant context', 401);
    }

    if (adjustment === undefined || adjustment === 0) {
      return sendError(res, 'Stock adjustment value is required and cannot be zero', 400);
    }

    const variant = await prisma.productVariant.findUnique({
      where: { id },
      include: {
        product: true,
      },
    });

    // TENANT VALIDATION: Check variant exists AND product belongs to owner
    if (!variant || variant.product.ownerId !== req.ownerId) {
      return sendError(res, 'Product variant not found', 404);
    }

    const newStockQuantity = variant.stockQuantity + adjustment;

    if (newStockQuantity < 0) {
      return sendError(res, 'Insufficient stock quantity', 400);
    }

    const updatedVariant = await prisma.productVariant.update({
      where: { id },
      data: {
        stockQuantity: newStockQuantity,
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            imageUrl: true,
          },
        },
      },
    });

    return sendSuccess(
      res,
      {
        variant: updatedVariant,
        previousStock: variant.stockQuantity,
        adjustment,
        newStock: newStockQuantity,
        reason,
      },
      'Stock adjusted successfully'
    );
  } catch (error: any) {
    console.error('Adjust stock error:', error);
    return sendError(res, error.message || 'Failed to adjust stock', 500);
  }
};

/**
 * Delete a product variant (TENANT-VALIDATED)
 * Can only delete variants for products belonging to the authenticated user's owner
 */
export const deleteVariant = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;

    // CRITICAL: Ensure tenant context exists
    if (!req.ownerId) {
      return sendError(res, 'Unauthorized - no tenant context', 401);
    }

    // Check if variant exists and has transactions
    const variant = await prisma.productVariant.findUnique({
      where: { id },
      include: {
        product: true,
        _count: {
          select: { transactionItems: true },
        },
      },
    });

    // TENANT VALIDATION: Check variant exists AND product belongs to owner
    if (!variant || variant.product.ownerId !== req.ownerId) {
      return sendError(res, 'Product variant not found', 404);
    }

    if (variant._count.transactionItems > 0) {
      return sendError(
        res,
        `Cannot delete variant. It has ${variant._count.transactionItems} transaction(s) associated with it`,
        400
      );
    }

    await prisma.productVariant.delete({
      where: { id },
    });

    return sendSuccess(res, null, 'Product variant deleted successfully');
  } catch (error: any) {
    console.error('Delete variant error:', error);
    return sendError(res, error.message || 'Failed to delete product variant', 500);
  }
};
