import { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { sendSuccess, sendError } from '../utils/response';
import config from '../config/env';
import prisma from '../config/database';

/**
 * Upload a single image
 */
export const uploadImage = async (req: Request, res: Response): Promise<Response> => {
  try {
    // Ensure tenant context exists
    if (!req.ownerId) {
      return sendError(res, 'Unauthorized - no tenant context', 401);
    }

    if (!req.file) {
      return sendError(res, 'No file uploaded', 400);
    }

    // Generate URL for the uploaded file
    const fileUrl = `/uploads/${req.file.filename}`;

    // Track file ownership in database
    const uploadedFile = await prisma.uploadedFile.create({
      data: {
        filename: req.file.filename,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        url: fileUrl,
        ownerId: req.ownerId,
      },
    });

    return sendSuccess(
      res,
      {
        id: uploadedFile.id,
        filename: uploadedFile.filename,
        originalName: uploadedFile.originalName,
        mimeType: uploadedFile.mimeType,
        size: uploadedFile.size,
        url: uploadedFile.url,
      },
      'Image uploaded successfully',
      201
    );
  } catch (error: any) {
    console.error('Upload image error:', error);
    return sendError(res, error.message || 'Failed to upload image', 500);
  }
};

/**
 * Upload multiple images
 */
export const uploadMultipleImages = async (req: Request, res: Response): Promise<Response> => {
  try {
    // Ensure tenant context exists
    if (!req.ownerId) {
      return sendError(res, 'Unauthorized - no tenant context', 401);
    }

    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
      return sendError(res, 'No files uploaded', 400);
    }

    // Track all files ownership in database
    const uploadedFiles = await Promise.all(
      files.map(async (file) => {
        const fileUrl = `/uploads/${file.filename}`;

        const uploadedFile = await prisma.uploadedFile.create({
          data: {
            filename: file.filename,
            originalName: file.originalname,
            mimeType: file.mimetype,
            size: file.size,
            url: fileUrl,
            ownerId: req.ownerId!,
          },
        });

        return {
          id: uploadedFile.id,
          filename: uploadedFile.filename,
          originalName: uploadedFile.originalName,
          mimeType: uploadedFile.mimeType,
          size: uploadedFile.size,
          url: uploadedFile.url,
        };
      })
    );

    return sendSuccess(
      res,
      uploadedFiles,
      `${uploadedFiles.length} image(s) uploaded successfully`,
      201
    );
  } catch (error: any) {
    console.error('Upload multiple images error:', error);
    return sendError(res, error.message || 'Failed to upload images', 500);
  }
};

/**
 * Delete an uploaded image
 */
export const deleteImage = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { filename } = req.params;

    // Ensure tenant context exists
    if (!req.ownerId) {
      return sendError(res, 'Unauthorized - no tenant context', 401);
    }

    if (!filename) {
      return sendError(res, 'Filename is required', 400);
    }

    // Find file in database and verify ownership
    const file = await prisma.uploadedFile.findFirst({
      where: {
        filename,
        ownerId: req.ownerId,
      },
    });

    if (!file) {
      return sendError(res, 'File not found', 404);
    }

    const filePath = path.join(config.uploadPath, filename);

    // Check if file exists on filesystem
    if (!fs.existsSync(filePath)) {
      // Delete database record even if file doesn't exist
      await prisma.uploadedFile.delete({
        where: { id: file.id },
      });
      return sendError(res, 'File not found on filesystem', 404);
    }

    // Delete file from filesystem
    fs.unlinkSync(filePath);

    // Delete database record
    await prisma.uploadedFile.delete({
      where: { id: file.id },
    });

    return sendSuccess(res, null, 'Image deleted successfully');
  } catch (error: any) {
    console.error('Delete image error:', error);
    return sendError(res, error.message || 'Failed to delete image', 500);
  }
};
