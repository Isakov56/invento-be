import { Request, Response } from 'express';
import prisma from '../config/database';
import { sendSuccess, sendError } from '../utils/response';
import { TransactionType, UserRole } from '@prisma/client';

/**
 * Get all transactions with optional filtering (TENANT-FILTERED)
 * Only returns transactions belonging to the authenticated user's owner
 */
export const getAllTransactions = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { storeId, cashierId, type, startDate, endDate } = req.query;

    // CRITICAL: Ensure tenant context exists
    if (!req.ownerId) {
      return sendError(res, 'Unauthorized - no tenant context', 401);
    }

    const where: any = {
      ownerId: req.ownerId, // TENANT FILTER - CRITICAL!
    };

    if (storeId) where.storeId = storeId as string;
    if (cashierId) where.cashierId = cashierId as string;
    if (type) where.type = type as TransactionType;

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate as string);
      if (endDate) where.createdAt.lte = new Date(endDate as string);
    }

    const transactions = await prisma.transaction.findMany({
      where,
      include: {
        cashier: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        store: {
          select: {
            id: true,
            name: true,
            city: true,
          },
        },
        items: {
          include: {
            productVariant: {
              include: {
                product: {
                  select: {
                    id: true,
                    name: true,
                    imageUrl: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return sendSuccess(res, transactions, 'Transactions retrieved successfully');
  } catch (error: any) {
    console.error('Get transactions error:', error);
    return sendError(res, error.message || 'Failed to retrieve transactions', 500);
  }
};

/**
 * Get a single transaction by ID (TENANT-FILTERED)
 * Only returns transaction if it belongs to the authenticated user's owner
 */
export const getTransactionById = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;

    // CRITICAL: Ensure tenant context exists
    if (!req.ownerId) {
      return sendError(res, 'Unauthorized - no tenant context', 401);
    }

    const transaction = await prisma.transaction.findFirst({
      where: {
        id,
        ownerId: req.ownerId, // TENANT FILTER
      },
      include: {
        cashier: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        store: {
          select: {
            id: true,
            name: true,
            address: true,
            city: true,
            state: true,
            phone: true,
          },
        },
        items: {
          include: {
            productVariant: {
              include: {
                product: {
                  select: {
                    id: true,
                    name: true,
                    description: true,
                    imageUrl: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!transaction) {
      return sendError(res, 'Transaction not found', 404);
    }

    return sendSuccess(res, transaction, 'Transaction retrieved successfully');
  } catch (error: any) {
    console.error('Get transaction error:', error);
    return sendError(res, error.message || 'Failed to retrieve transaction', 500);
  }
};

/**
 * Create a new transaction (sale) (TENANT-SCOPED)
 */
export const createTransaction = async (req: Request, res: Response): Promise<Response> => {
  try {
    const {
      storeId,
      cashierId,
      type = 'SALE',
      items,
      paymentMethod,
      amountPaid,
      notes,
    } = req.body;

    // CRITICAL: Ensure tenant context exists
    if (!req.ownerId) {
      return sendError(res, 'Unauthorized - no tenant context', 401);
    }

    // Validate required fields
    if (!storeId || !cashierId || !items || items.length === 0 || !paymentMethod) {
      return sendError(
        res,
        'Store, cashier, items, and payment method are required',
        400
      );
    }

    // Verify store exists AND belongs to this owner (TENANT VALIDATION)
    const store = await prisma.store.findFirst({
      where: {
        id: storeId,
        ownerId: req.ownerId, // TENANT FILTER
      },
    });
    if (!store) {
      return sendError(res, 'Store not found', 404);
    }

    // Verify cashier exists AND belongs to this owner (TENANT VALIDATION)
    // Case 1: Cashier/Manager creating their own transaction (their ownerId matches req.ownerId)
    // Case 2: Owner creating transaction as cashier (their id equals req.ownerId AND ownerId is null)
    const cashier = await prisma.user.findFirst({
      where: {
        id: cashierId,
        OR: [
          { ownerId: req.ownerId }, // Employee belongs to this owner
          { id: req.ownerId, role: UserRole.OWNER }, // User IS the owner
        ],
      },
    });

    if (!cashier) {
      return sendError(res, 'Cashier not found or does not belong to your organization', 404);
    }

    // Validate all product variants and check stock
    for (const item of items) {
      const variant = await prisma.productVariant.findUnique({
        where: { id: item.productVariantId },
        include: {
          product: true,
        },
      });

      // TENANT VALIDATION: Validate variant's product belongs to owner
      if (!variant || variant.product.ownerId !== req.ownerId) {
        return sendError(res, `Product variant ${item.productVariantId} not found`, 404);
      }

      if (type === 'SALE' && variant.stockQuantity < item.quantity) {
        return sendError(
          res,
          `Insufficient stock for variant ${variant.sku}. Available: ${variant.stockQuantity}, Requested: ${item.quantity}`,
          400
        );
      }
    }

    // Calculate totals
    let subtotal = 0;
    const transactionItems: Array<{
      productVariantId: string;
      quantity: number;
      unitPrice: number;
      discount: number;
      subtotal: number;
    }> = [];

    for (const item of items) {
      const variant = await prisma.productVariant.findUnique({
        where: { id: item.productVariantId },
      });

      const itemSubtotal = variant!.sellingPrice * item.quantity - (item.discount || 0);
      subtotal += itemSubtotal;

      transactionItems.push({
        productVariantId: item.productVariantId,
        quantity: item.quantity,
        unitPrice: variant!.sellingPrice,
        discount: item.discount || 0,
        subtotal: itemSubtotal,
      });
    }

    const tax = req.body.tax || 0;
    const discount = req.body.discount || 0;
    const total = subtotal + tax - discount;
    const change = (amountPaid || total) - total;

    // Generate transaction number
    const transactionNo = `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    // Create transaction and update stock in a transaction
    const transaction = await prisma.$transaction(async (tx) => {
      // Create transaction
      const newTransaction = await tx.transaction.create({
        data: {
          transactionNo,
          type,
          storeId,
          cashierId,
          ownerId: req.ownerId!, // CRITICAL: Assign transaction to the authenticated owner
          subtotal,
          tax,
          discount,
          total,
          paymentMethod,
          amountPaid: amountPaid || total,
          change: change > 0 ? change : 0,
          notes,
          items: {
            create: transactionItems,
          },
        },
        include: {
          items: {
            include: {
              productVariant: {
                include: {
                  product: true,
                },
              },
            },
          },
          cashier: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          store: {
            select: {
              id: true,
              name: true,
              address: true,
              city: true,
              state: true,
              phone: true,
            },
          },
        },
      });

      // Update stock quantities
      for (const item of items) {
        const stockChange = type === 'SALE' ? -item.quantity : item.quantity;
        await tx.productVariant.update({
          where: { id: item.productVariantId },
          data: {
            stockQuantity: {
              increment: stockChange,
            },
          },
        });
      }

      return newTransaction;
    });

    return sendSuccess(res, transaction, 'Transaction created successfully', 201);
  } catch (error: any) {
    console.error('Create transaction error:', error);
    return sendError(res, error.message || 'Failed to create transaction', 500);
  }
};

/**
 * Get transaction statistics (TENANT-FILTERED)
 * Only returns statistics for transactions belonging to the authenticated user's owner
 */
export const getTransactionStats = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { storeId, startDate, endDate } = req.query;

    // CRITICAL: Ensure tenant context exists
    if (!req.ownerId) {
      return sendError(res, 'Unauthorized - no tenant context', 401);
    }

    const where: any = {
      type: 'SALE',
      ownerId: req.ownerId, // TENANT FILTER - CRITICAL!
    };
    if (storeId) where.storeId = storeId as string;

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate as string);
      if (endDate) where.createdAt.lte = new Date(endDate as string);
    }

    const [totalRevenue, transactionCount, todayRevenue, todayTransactions] = await Promise.all([
      // Total revenue
      prisma.transaction.aggregate({
        where,
        _sum: { total: true },
      }),
      // Total transaction count
      prisma.transaction.count({ where }),
      // Today's revenue
      prisma.transaction.aggregate({
        where: {
          ...where,
          createdAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
          },
        },
        _sum: { total: true },
      }),
      // Today's transaction count
      prisma.transaction.count({
        where: {
          ...where,
          createdAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
          },
        },
      }),
    ]);

    const stats = {
      totalRevenue: totalRevenue._sum.total || 0,
      totalTransactions: transactionCount,
      todayRevenue: todayRevenue._sum.total || 0,
      todayTransactions,
    };

    return sendSuccess(res, stats, 'Transaction statistics retrieved successfully');
  } catch (error: any) {
    console.error('Get transaction stats error:', error);
    return sendError(res, error.message || 'Failed to retrieve transaction statistics', 500);
  }
};

/**
 * Get today's transactions (TENANT-FILTERED)
 * Only returns today's transactions belonging to the authenticated user's owner
 */
export const getTodayTransactions = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { storeId } = req.query;

    // CRITICAL: Ensure tenant context exists
    if (!req.ownerId) {
      return sendError(res, 'Unauthorized - no tenant context', 401);
    }

    const where: any = {
      ownerId: req.ownerId, // TENANT FILTER - CRITICAL!
      createdAt: {
        gte: new Date(new Date().setHours(0, 0, 0, 0)),
      },
    };

    if (storeId) where.storeId = storeId as string;

    const transactions = await prisma.transaction.findMany({
      where,
      include: {
        cashier: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        items: {
          include: {
            productVariant: {
              include: {
                product: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return sendSuccess(res, transactions, 'Today\'s transactions retrieved successfully');
  } catch (error: any) {
    console.error('Get today transactions error:', error);
    return sendError(res, error.message || 'Failed to retrieve today\'s transactions', 500);
  }
};
