import { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { v2 as cloudinary } from 'cloudinary';
import { sendSuccess, sendError } from '../utils/response';
import config from '../config/env';
import prisma from '../config/database';

// Configure Cloudinary if credentials are provided
if (config.cloudinaryCloudName && config.cloudinaryApiKey && config.cloudinaryApiSecret) {
  cloudinary.config({
    cloud_name: config.cloudinaryCloudName,
    api_key: config.cloudinaryApiKey,
    api_secret: config.cloudinaryApiSecret,
  });
}

const useCloudinary = config.cloudinaryCloudName && config.cloudinaryApiKey && config.cloudinaryApiSecret;

/**
 * Upload file to Cloudinary
 */
const uploadToCloudinary = (fileBuffer: Buffer, originalName: string): Promise<any> => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        resource_type: 'auto',
        public_id: `products/${Date.now()}-${originalName.replace(/\.[^/.]+$/, '')}`,
        overwrite: true,
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    );

    uploadStream.end(fileBuffer);
  });
};

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

    let fileUrl: string;
    let filename: string;

    if (useCloudinary && req.file.buffer) {
      // Upload to Cloudinary
      try {
        const cloudinaryResult = await uploadToCloudinary(req.file.buffer, req.file.originalname);
        fileUrl = cloudinaryResult.secure_url;
        filename = cloudinaryResult.public_id; // Use Cloudinary public_id as filename
      } catch (cloudinaryError: any) {
        console.error('Cloudinary upload error:', cloudinaryError);
        return sendError(res, 'Failed to upload to cloud storage', 500);
      }
    } else {
      // Local file storage
      fileUrl = `/uploads/${req.file.filename}`;
      filename = req.file.filename;
    }

    // Track file ownership in database
    const uploadedFile = await prisma.uploadedFile.create({
      data: {
        filename: filename,
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
        let fileUrl: string;
        let filename: string;

        if (useCloudinary && file.buffer) {
          // Upload to Cloudinary
          try {
            const cloudinaryResult = await uploadToCloudinary(file.buffer, file.originalname);
            fileUrl = cloudinaryResult.secure_url;
            filename = cloudinaryResult.public_id;
          } catch (cloudinaryError: any) {
            console.error('Cloudinary upload error:', cloudinaryError);
            throw new Error('Failed to upload to cloud storage');
          }
        } else {
          // Local file storage
          fileUrl = `/uploads/${file.filename}`;
          filename = file.filename;
        }

        const uploadedFile = await prisma.uploadedFile.create({
          data: {
            filename: filename,
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

    // Delete from Cloudinary if it was uploaded there
    if (useCloudinary && filename.includes('/')) {
      try {
        await cloudinary.uploader.destroy(filename);
      } catch (cloudinaryError: any) {
        console.error('Cloudinary deletion error:', cloudinaryError);
        // Continue with database deletion even if Cloudinary fails
      }
    } else {
      // Delete from local filesystem
      const filePath = path.join(config.uploadPath, filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

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
