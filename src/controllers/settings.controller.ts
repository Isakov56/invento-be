import { Request, Response } from 'express';
import prisma from '../config/database';
import { sendSuccess, sendError } from '../utils/response';

/**
 * Get business settings (OWNER only)
 * Returns business-level settings for the authenticated owner
 */
export const getBusinessSettings = async (req: Request, res: Response): Promise<Response> => {
  try {
    // CRITICAL: Only owners can access business settings
    if (!req.ownerId) {
      return sendError(res, 'Unauthorized - no tenant context', 401);
    }

    // Get or create business settings
    let settings = await prisma.businessSettings.findUnique({
      where: {
        ownerId: req.ownerId,
      },
    });

    // If settings don't exist, create default settings
    if (!settings) {
      settings = await prisma.businessSettings.create({
        data: {
          ownerId: req.ownerId,
        },
      });
    }

    return sendSuccess(res, settings, 'Business settings retrieved successfully');
  } catch (error: any) {
    console.error('Get business settings error:', error);
    return sendError(res, error.message || 'Failed to retrieve business settings', 500);
  }
};

/**
 * Update business settings (OWNER only)
 * Updates business-level settings for the authenticated owner
 */
export const updateBusinessSettings = async (req: Request, res: Response): Promise<Response> => {
  try {
    const {
      businessName,
      businessLogo,
      taxRate,
      currency,
      receiptHeader,
      receiptFooter,
      autoPrintReceipt,
      defaultPaymentMethod,
      soundOnTransaction,
      lowStockThreshold,
    } = req.body;

    // CRITICAL: Only owners can update business settings
    if (!req.ownerId) {
      return sendError(res, 'Unauthorized - no tenant context', 401);
    }

    // Validate tax rate
    if (taxRate !== undefined && (taxRate < 0 || taxRate > 100)) {
      return sendError(res, 'Tax rate must be between 0 and 100', 400);
    }

    // Validate low stock threshold
    if (lowStockThreshold !== undefined && lowStockThreshold < 0) {
      return sendError(res, 'Low stock threshold must be non-negative', 400);
    }

    // Update or create settings
    const settings = await prisma.businessSettings.upsert({
      where: {
        ownerId: req.ownerId,
      },
      update: {
        ...(businessName !== undefined && { businessName }),
        ...(businessLogo !== undefined && { businessLogo }),
        ...(taxRate !== undefined && { taxRate }),
        ...(currency !== undefined && { currency }),
        ...(receiptHeader !== undefined && { receiptHeader }),
        ...(receiptFooter !== undefined && { receiptFooter }),
        ...(autoPrintReceipt !== undefined && { autoPrintReceipt }),
        ...(defaultPaymentMethod !== undefined && { defaultPaymentMethod }),
        ...(soundOnTransaction !== undefined && { soundOnTransaction }),
        ...(lowStockThreshold !== undefined && { lowStockThreshold }),
      },
      create: {
        ownerId: req.ownerId,
        businessName,
        businessLogo,
        taxRate: taxRate || 0,
        currency: currency || 'USD',
        receiptHeader,
        receiptFooter,
        autoPrintReceipt: autoPrintReceipt || false,
        defaultPaymentMethod: defaultPaymentMethod || 'cash',
        soundOnTransaction: soundOnTransaction !== undefined ? soundOnTransaction : true,
        lowStockThreshold: lowStockThreshold || 10,
      },
    });

    return sendSuccess(res, settings, 'Business settings updated successfully');
  } catch (error: any) {
    console.error('Update business settings error:', error);
    return sendError(res, error.message || 'Failed to update business settings', 500);
  }
};

/**
 * Get user preferences
 * Returns preferences for the authenticated user
 */
export const getUserPreferences = async (req: Request, res: Response): Promise<Response> => {
  try {
    if (!req.user?.userId) {
      return sendError(res, 'Unauthorized', 401);
    }

    const user = await prisma.user.findUnique({
      where: {
        id: req.user.userId,
      },
      select: {
        id: true,
        language: true,
        theme: true,
        notificationsEnabled: true,
        defaultStoreId: true,
      },
    });

    if (!user) {
      return sendError(res, 'User not found', 404);
    }

    return sendSuccess(res, user, 'User preferences retrieved successfully');
  } catch (error: any) {
    console.error('Get user preferences error:', error);
    return sendError(res, error.message || 'Failed to retrieve user preferences', 500);
  }
};

/**
 * Update user preferences
 * Updates preferences for the authenticated user
 */
export const updateUserPreferences = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { language, theme, notificationsEnabled, defaultStoreId } = req.body;

    if (!req.user?.userId) {
      return sendError(res, 'Unauthorized', 401);
    }

    // Validate language
    const validLanguages = ['en', 'ru', 'uz'];
    if (language && !validLanguages.includes(language)) {
      return sendError(res, 'Invalid language. Must be one of: en, ru, uz', 400);
    }

    // Validate theme
    const validThemes = ['light', 'dark'];
    if (theme && !validThemes.includes(theme)) {
      return sendError(res, 'Invalid theme. Must be one of: light, dark', 400);
    }

    // If defaultStoreId is provided, verify it belongs to the user's owner
    if (defaultStoreId && req.ownerId) {
      const store = await prisma.store.findFirst({
        where: {
          id: defaultStoreId,
          ownerId: req.ownerId,
        },
      });

      if (!store) {
        return sendError(res, 'Invalid store ID', 400);
      }
    }

    const user = await prisma.user.update({
      where: {
        id: req.user.userId,
      },
      data: {
        ...(language !== undefined && { language }),
        ...(theme !== undefined && { theme }),
        ...(notificationsEnabled !== undefined && { notificationsEnabled }),
        ...(defaultStoreId !== undefined && { defaultStoreId }),
      },
      select: {
        id: true,
        language: true,
        theme: true,
        notificationsEnabled: true,
        defaultStoreId: true,
      },
    });

    return sendSuccess(res, user, 'User preferences updated successfully');
  } catch (error: any) {
    console.error('Update user preferences error:', error);
    return sendError(res, error.message || 'Failed to update user preferences', 500);
  }
};
