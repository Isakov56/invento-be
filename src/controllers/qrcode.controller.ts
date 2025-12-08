import { Request, Response } from 'express';
import QRCode from 'qrcode';
import bwipjs from 'bwip-js';
import prisma from '../config/database';
import { sendSuccess, sendError } from '../utils/response';

/**
 * Generate QR code for a product variant
 */
export const generateQRCode = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { variantId } = req.params;

    // Ensure tenant context exists
    if (!req.ownerId) {
      return sendError(res, 'Unauthorized - no tenant context', 401);
    }

    // Get variant with product (including ownerId for validation)
    const variant = await prisma.productVariant.findUnique({
      where: { id: variantId },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            ownerId: true,
          },
        },
      },
    });

    // Validate variant exists AND belongs to the authenticated owner
    if (!variant || variant.product.ownerId !== req.ownerId) {
      return sendError(res, 'Product variant not found', 404);
    }

    // Create QR code data (JSON with variant info)
    const qrData = JSON.stringify({
      variantId: variant.id,
      sku: variant.sku,
      productName: variant.product.name,
      price: variant.sellingPrice,
    });

    // Generate QR code as data URL
    const qrCodeDataURL = await QRCode.toDataURL(qrData, {
      errorCorrectionLevel: 'H',
      type: 'image/png',
      width: 300,
      margin: 2,
    });

    // Update variant with QR code if not exists
    if (!variant.qrCode) {
      await prisma.productVariant.update({
        where: { id: variantId },
        data: { qrCode: variant.sku }, // Store SKU as QR identifier
      });
    }

    return sendSuccess(
      res,
      {
        variantId: variant.id,
        sku: variant.sku,
        productName: variant.product.name,
        qrCodeDataURL,
        qrData,
      },
      'QR code generated successfully'
    );
  } catch (error: any) {
    console.error('Generate QR code error:', error);
    return sendError(res, error.message || 'Failed to generate QR code', 500);
  }
};

/**
 * Generate QR codes for multiple variants
 */
export const generateBulkQRCodes = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { variantIds } = req.body;

    // Ensure tenant context exists
    if (!req.ownerId) {
      return sendError(res, 'Unauthorized - no tenant context', 401);
    }

    if (!variantIds || !Array.isArray(variantIds) || variantIds.length === 0) {
      return sendError(res, 'Variant IDs array is required', 400);
    }

    const results = [];

    for (const variantId of variantIds) {
      const variant = await prisma.productVariant.findUnique({
        where: { id: variantId },
        include: {
          product: {
            select: {
              id: true,
              name: true,
              ownerId: true,
            },
          },
        },
      });

      // Validate variant exists AND belongs to the authenticated owner
      if (!variant || variant.product.ownerId !== req.ownerId) {
        results.push({
          variantId,
          success: false,
          error: 'Variant not found',
        });
        continue;
      }

      try {
        const qrData = JSON.stringify({
          variantId: variant.id,
          sku: variant.sku,
          productName: variant.product.name,
          price: variant.sellingPrice,
        });

        const qrCodeDataURL = await QRCode.toDataURL(qrData, {
          errorCorrectionLevel: 'H',
          type: 'image/png',
          width: 300,
          margin: 2,
        });

        // Update variant with QR code if not exists
        if (!variant.qrCode) {
          await prisma.productVariant.update({
            where: { id: variantId },
            data: { qrCode: variant.sku },
          });
        }

        results.push({
          variantId: variant.id,
          sku: variant.sku,
          productName: variant.product.name,
          qrCodeDataURL,
          success: true,
        });
      } catch (error: any) {
        results.push({
          variantId,
          success: false,
          error: error.message,
        });
      }
    }

    return sendSuccess(res, results, 'QR codes generated successfully');
  } catch (error: any) {
    console.error('Generate bulk QR codes error:', error);
    return sendError(res, error.message || 'Failed to generate QR codes', 500);
  }
};

/**
 * Generate QR codes or barcodes for all variants of a product
 */
export const generateProductQRCodes = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { productId } = req.params;
    const { codeType = 'qrcode' } = req.query; // 'qrcode' or 'barcode'

    // Ensure tenant context exists
    if (!req.ownerId) {
      return sendError(res, 'Unauthorized - no tenant context', 401);
    }

    // First verify the product belongs to this owner
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { ownerId: true },
    });

    if (!product || product.ownerId !== req.ownerId) {
      return sendError(res, 'Product not found', 404);
    }

    const variants = await prisma.productVariant.findMany({
      where: { productId },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            ownerId: true,
          },
        },
      },
    });

    if (variants.length === 0) {
      return sendError(res, 'No variants found for this product', 404);
    }

    const results = [];

    for (const variant of variants) {
      let codeDataURL: string;

      if (codeType === 'barcode') {
        // Generate barcode (Code128)
        const png = await bwipjs.toBuffer({
          bcid: 'code128',
          text: variant.sku,
          scale: 3,
          height: 10,
          includetext: true,
          textxalign: 'center',
        });
        codeDataURL = `data:image/png;base64,${png.toString('base64')}`;
      } else {
        // Generate QR code
        const qrData = JSON.stringify({
          variantId: variant.id,
          sku: variant.sku,
          productName: variant.product.name,
          price: variant.sellingPrice,
        });

        codeDataURL = await QRCode.toDataURL(qrData, {
          errorCorrectionLevel: 'H',
          type: 'image/png',
          width: 300,
          margin: 2,
        });
      }

      // Update variant with QR code if not exists
      if (!variant.qrCode) {
        await prisma.productVariant.update({
          where: { id: variant.id },
          data: { qrCode: variant.sku },
        });
      }

      results.push({
        variantId: variant.id,
        sku: variant.sku,
        productName: variant.product.name,
        size: variant.size,
        color: variant.color,
        price: variant.sellingPrice,
        qrCodeDataURL: codeDataURL,
        codeType,
      });
    }

    const message = codeType === 'barcode'
      ? 'Barcodes generated for all variants'
      : 'QR codes generated for all variants';

    return sendSuccess(res, results, message);
  } catch (error: any) {
    console.error('Generate product codes error:', error);
    return sendError(res, error.message || 'Failed to generate codes', 500);
  }
};

/**
 * Decode/scan QR code (get variant info)
 */
export const decodeQRCode = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { qrData } = req.body;

    // Ensure tenant context exists
    if (!req.ownerId) {
      return sendError(res, 'Unauthorized - no tenant context', 401);
    }

    if (!qrData) {
      return sendError(res, 'QR data is required', 400);
    }

    // Parse QR data
    const parsedData = JSON.parse(qrData);
    const { variantId } = parsedData;

    // Get full variant info with owner validation
    const variant = await prisma.productVariant.findUnique({
      where: { id: variantId },
      include: {
        product: {
          include: {
            category: true,
          },
        },
      },
    });

    // Validate variant exists AND belongs to the authenticated owner
    if (!variant || variant.product.ownerId !== req.ownerId) {
      return sendError(res, 'Product variant not found', 404);
    }

    return sendSuccess(
      res,
      {
        variant,
        scannedData: parsedData,
      },
      'QR code decoded successfully'
    );
  } catch (error: any) {
    console.error('Decode QR code error:', error);
    return sendError(res, error.message || 'Failed to decode QR code', 500);
  }
};
