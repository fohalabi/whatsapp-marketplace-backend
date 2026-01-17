import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { Request, Response, NextFunction } from 'express';
import { validateMagicBytes } from '../utils/magicBytes.utils';

// Create uploads directory if it doesn't exist
const uploadDir = path.join(__dirname, '../../uploads/products');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// File filter - only images
const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'));
  }
};

export const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: fileFilter,
});

// Magic bytes validation middleware (use this AFTER multer upload)
export const validateProductImage = (req: Request, res: Response, next: NextFunction) => {
  const file = req.file;
  const files = req.files as Express.Multer.File[] | undefined;

  const filesToValidate: Express.Multer.File[] = [];
  
  if (file) {
    filesToValidate.push(file);
  }
  
  if (files && Array.isArray(files)) {
    filesToValidate.push(...files);
  }

  if (filesToValidate.length === 0) {
    return next();
  }

  // Validate magic bytes for each uploaded file
  for (const uploadedFile of filesToValidate) {
    const isValid = validateMagicBytes(uploadedFile.path, ['jpeg', 'jpg', 'png', 'gif', 'webp']);
    
    if (!isValid) {
      // Delete all uploaded files
      filesToValidate.forEach(f => {
        if (fs.existsSync(f.path)) {
          fs.unlinkSync(f.path);
        }
      });

      return res.status(400).json({
        success: false,
        message: `Invalid image file: ${uploadedFile.originalname}. File signature does not match expected image format.`
      });
    }
  }

  next();
};