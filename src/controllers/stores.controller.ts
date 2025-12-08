import { Request, Response } from 'express';
import prisma from '../config/database';
import { sendSuccess, sendError } from '../utils/response';

/**
 * Get all stores (TENANT-FILTERED)
 * Only returns stores belonging to the authenticated user's owner
 */
export const getAllStores = async (req: Request, res: Response): Promise<Response> => {
  try {
    // CRITICAL: Filter by ownerId for tenant isolation
    if (!req.ownerId) {
      return sendError(res, 'Unauthorized - no tenant context', 401);
    }

    const stores = await prisma.store.findMany({
      where: {
        ownerId: req.ownerId, // TENANT FILTER
      },
      orderBy: {
        name: 'asc',
      },
    });

    return sendSuccess(res, stores, 'Stores retrieved successfully');
  } catch (error: any) {
    console.error('Get stores error:', error);
    return sendError(res, error.message || 'Failed to retrieve stores', 500);
  }
};

/**
 * Get a single store by ID (TENANT-FILTERED)
 * Only returns store if it belongs to the authenticated user's owner
 */
export const getStoreById = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;

    // CRITICAL: Filter by ownerId for tenant isolation
    if (!req.ownerId) {
      return sendError(res, 'Unauthorized - no tenant context', 401);
    }

    const store = await prisma.store.findFirst({
      where: {
        id,
        ownerId: req.ownerId, // TENANT FILTER - ensures user can only access their own stores
      },
      include: {
        _count: {
          select: {
            employees: true,
            products: true,
            transactions: true,
          },
        },
      },
    });

    if (!store) {
      return sendError(res, 'Store not found', 404);
    }

    return sendSuccess(res, store, 'Store retrieved successfully');
  } catch (error: any) {
    console.error('Get store error:', error);
    return sendError(res, error.message || 'Failed to retrieve store', 500);
  }
};

/**
 * Create a new store (TENANT-SCOPED)
 * Store will be created under the authenticated user's owner
 */
export const createStore = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { name, address, city, state, zipCode, phone, email, isActive } = req.body;

    // CRITICAL: Ensure tenant context exists
    if (!req.ownerId) {
      return sendError(res, 'Unauthorized - no tenant context', 401);
    }

    // Validate required fields
    if (!name || !address || !city || !state || !zipCode || !phone) {
      return sendError(
        res,
        'Store name, address, city, state, zip code, and phone are required',
        400
      );
    }

    const store = await prisma.store.create({
      data: {
        name,
        address,
        city,
        state,
        zipCode,
        phone,
        email,
        isActive: isActive !== undefined ? isActive : true,
        ownerId: req.ownerId, // CRITICAL: Assign store to the authenticated owner
      },
    });

    return sendSuccess(res, store, 'Store created successfully', 201);
  } catch (error: any) {
    console.error('Create store error:', error);
    return sendError(res, error.message || 'Failed to create store', 500);
  }
};

/**
 * Update a store (TENANT-VALIDATED)
 * Can only update stores belonging to the authenticated user's owner
 */
export const updateStore = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;
    const { name, address, city, state, zipCode, phone, email, isActive } = req.body;

    // CRITICAL: Ensure tenant context exists
    if (!req.ownerId) {
      return sendError(res, 'Unauthorized - no tenant context', 401);
    }

    // Check if store exists AND belongs to this owner (TENANT VALIDATION)
    const existingStore = await prisma.store.findFirst({
      where: {
        id,
        ownerId: req.ownerId, // CRITICAL: Ensure store belongs to this owner
      },
    });

    if (!existingStore) {
      return sendError(res, 'Store not found', 404);
    }

    const updatedStore = await prisma.store.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(address !== undefined && { address }),
        ...(city !== undefined && { city }),
        ...(state !== undefined && { state }),
        ...(zipCode !== undefined && { zipCode }),
        ...(phone !== undefined && { phone }),
        ...(email !== undefined && { email }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    return sendSuccess(res, updatedStore, 'Store updated successfully');
  } catch (error: any) {
    console.error('Update store error:', error);
    return sendError(res, error.message || 'Failed to update store', 500);
  }
};

/**
 * Delete a store (TENANT-VALIDATED)
 * Can only delete stores belonging to the authenticated user's owner
 */
export const deleteStore = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;

    // CRITICAL: Ensure tenant context exists
    if (!req.ownerId) {
      return sendError(res, 'Unauthorized - no tenant context', 401);
    }

    // Check if store exists AND belongs to this owner (TENANT VALIDATION)
    const store = await prisma.store.findFirst({
      where: {
        id,
        ownerId: req.ownerId, // CRITICAL: Ensure store belongs to this owner
      },
      include: {
        _count: {
          select: {
            employees: true,
            products: true,
            transactions: true,
          },
        },
      },
    });

    if (!store) {
      return sendError(res, 'Store not found', 404);
    }

    // Check if store has associated records
    if (
      store._count.employees > 0 ||
      store._count.products > 0 ||
      store._count.transactions > 0
    ) {
      return sendError(
        res,
        'Cannot delete store. It has associated employees, products, or transactions. Consider deactivating instead.',
        400
      );
    }

    // Delete store
    await prisma.store.delete({
      where: { id },
    });

    return sendSuccess(res, null, 'Store deleted successfully');
  } catch (error: any) {
    console.error('Delete store error:', error);
    return sendError(res, error.message || 'Failed to delete store', 500);
  }
};
