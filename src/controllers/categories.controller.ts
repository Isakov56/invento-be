import { Request, Response } from 'express';
import prisma from '../config/database';
import { sendSuccess, sendError } from '../utils/response';

/**
 * Get all categories (TENANT-FILTERED)
 * Only returns categories belonging to the authenticated user's owner
 */
export const getAllCategories = async (req: Request, res: Response): Promise<Response> => {
  try {
    // CRITICAL: Filter by ownerId for tenant isolation
    if (!req.ownerId) {
      return sendError(res, 'Unauthorized - no tenant context', 401);
    }

    const categories = await prisma.category.findMany({
      where: {
        ownerId: req.ownerId, // TENANT FILTER
      },
      orderBy: {
        name: 'asc',
      },
      include: {
        _count: {
          select: { products: true },
        },
      },
    });

    return sendSuccess(res, categories, 'Categories retrieved successfully');
  } catch (error: any) {
    console.error('Get categories error:', error);
    return sendError(res, error.message || 'Failed to retrieve categories', 500);
  }
};

/**
 * Get a single category by ID (TENANT-FILTERED)
 * Only returns category if it belongs to the authenticated user's owner
 */
export const getCategoryById = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;

    // CRITICAL: Filter by ownerId for tenant isolation
    if (!req.ownerId) {
      return sendError(res, 'Unauthorized - no tenant context', 401);
    }

    const category = await prisma.category.findFirst({
      where: {
        id,
        ownerId: req.ownerId, // TENANT FILTER
      },
      include: {
        products: {
          where: {
            ownerId: req.ownerId, // Also filter products by owner
          },
          select: {
            id: true,
            name: true,
            imageUrl: true,
            isActive: true,
          },
        },
      },
    });

    if (!category) {
      return sendError(res, 'Category not found', 404);
    }

    return sendSuccess(res, category, 'Category retrieved successfully');
  } catch (error: any) {
    console.error('Get category error:', error);
    return sendError(res, error.message || 'Failed to retrieve category', 500);
  }
};

/**
 * Create a new category (TENANT-SCOPED)
 * Category will be created under the authenticated user's owner
 */
export const createCategory = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { name, description } = req.body;

    // CRITICAL: Ensure tenant context exists
    if (!req.ownerId) {
      return sendError(res, 'Unauthorized - no tenant context', 401);
    }

    // Validate required fields
    if (!name) {
      return sendError(res, 'Category name is required', 400);
    }

    // Check if category with same name already exists FOR THIS OWNER
    const existingCategory = await prisma.category.findFirst({
      where: {
        name: {
          equals: name,
          mode: 'insensitive',
        },
        ownerId: req.ownerId, // TENANT FILTER - only check within owner's categories
      },
    });

    if (existingCategory) {
      return sendError(res, 'Category with this name already exists', 409);
    }

    const category = await prisma.category.create({
      data: {
        name,
        description,
        ownerId: req.ownerId, // CRITICAL: Assign category to the authenticated owner
      },
    });

    return sendSuccess(res, category, 'Category created successfully', 201);
  } catch (error: any) {
    console.error('Create category error:', error);
    return sendError(res, error.message || 'Failed to create category', 500);
  }
};

/**
 * Update a category (TENANT-VALIDATED)
 * Can only update categories belonging to the authenticated user's owner
 */
export const updateCategory = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;

    // CRITICAL: Ensure tenant context exists
    if (!req.ownerId) {
      return sendError(res, 'Unauthorized - no tenant context', 401);
    }

    // Check if category exists AND belongs to this owner (TENANT VALIDATION)
    const existingCategory = await prisma.category.findFirst({
      where: {
        id,
        ownerId: req.ownerId, // CRITICAL: Ensure category belongs to this owner
      },
    });

    if (!existingCategory) {
      return sendError(res, 'Category not found', 404);
    }

    // If name is being updated, check for duplicates WITHIN THIS OWNER's categories
    if (name && name !== existingCategory.name) {
      const duplicateCategory = await prisma.category.findFirst({
        where: {
          name: {
            equals: name,
            mode: 'insensitive',
          },
          ownerId: req.ownerId, // TENANT FILTER
          id: {
            not: id,
          },
        },
      });

      if (duplicateCategory) {
        return sendError(res, 'Category with this name already exists', 409);
      }
    }

    const updatedCategory = await prisma.category.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
      },
    });

    return sendSuccess(res, updatedCategory, 'Category updated successfully');
  } catch (error: any) {
    console.error('Update category error:', error);
    return sendError(res, error.message || 'Failed to update category', 500);
  }
};

/**
 * Delete a category (TENANT-VALIDATED)
 * Can only delete categories belonging to the authenticated user's owner
 */
export const deleteCategory = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;

    // CRITICAL: Ensure tenant context exists
    if (!req.ownerId) {
      return sendError(res, 'Unauthorized - no tenant context', 401);
    }

    // Check if category exists AND belongs to this owner (TENANT VALIDATION)
    const category = await prisma.category.findFirst({
      where: {
        id,
        ownerId: req.ownerId, // CRITICAL: Ensure category belongs to this owner
      },
      include: {
        _count: {
          select: { products: true },
        },
      },
    });

    if (!category) {
      return sendError(res, 'Category not found', 404);
    }

    // Check if category has products
    if (category._count.products > 0) {
      return sendError(
        res,
        `Cannot delete category. It has ${category._count.products} product(s) associated with it`,
        400
      );
    }

    await prisma.category.delete({
      where: { id },
    });

    return sendSuccess(res, null, 'Category deleted successfully');
  } catch (error: any) {
    console.error('Delete category error:', error);
    return sendError(res, error.message || 'Failed to delete category', 500);
  }
};
