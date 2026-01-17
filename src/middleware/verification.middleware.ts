import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types/auth.types';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { validateMagicBytes } from '../utils/magicBytes.utils';

// Create uploads directory
const uploadDir = path.join(__dirname, '../../uploads/merchants');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// File filter
const fileFilter = (req: any, file: any, cb: any) => {
  const allowedTypes = /jpeg|jpg|png|pdf/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (extname && mimetype) {
    cb(null, true);
  } else {
    cb(new Error('Only images (JPEG, PNG) and PDFs are allowed'));
  }
};

// Multer upload
export const uploadVerificationFiles = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }
}).fields([
  { name: 'profilePicture', maxCount: 1 },
  { name: 'governmentId', maxCount: 1 },
  { name: 'businessLicense', maxCount: 1 },
  { name: 'productSample', maxCount: 1 }
]);

// Validate files with magic bytes
export const validateVerificationFiles = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const files = req.files as { [fieldname: string]: Express.Multer.File[] };

  if (!files?.governmentId) {
    return res.status(400).json({
      success: false,
      message: 'Government ID is required'
    });
  }

  if (!files?.productSample) {
    return res.status(400).json({
      success: false,
      message: 'Product sample is required'
    });
  }

  // Validate magic bytes for all uploaded files
  const filesToValidate: { file: Express.Multer.File; allowedTypes: string[] }[] = [];

  if (files.profilePicture && files.profilePicture[0]) {
    filesToValidate.push({ file: files.profilePicture[0], allowedTypes: ['jpeg', 'jpg', 'png'] });
  }
  if (files.governmentId && files.governmentId[0]) {
    filesToValidate.push({ file: files.governmentId[0], allowedTypes: ['jpeg', 'jpg', 'png', 'pdf'] });
  }
  if (files.businessLicense && files.businessLicense[0]) {
    filesToValidate.push({ file: files.businessLicense[0], allowedTypes: ['jpeg', 'jpg', 'png', 'pdf'] });
  }
  if (files.productSample && files.productSample[0]) {
    filesToValidate.push({ file: files.productSample[0], allowedTypes: ['jpeg', 'jpg', 'png'] });
  }

  // Check magic bytes for each file
  for (const { file, allowedTypes } of filesToValidate) {
    const isValid = validateMagicBytes(file.path, allowedTypes);
    
    if (!isValid) {
      // Delete all uploaded files
      Object.values(files).forEach(fileArray => {
        fileArray.forEach(f => {
          if (fs.existsSync(f.path)) {
            fs.unlinkSync(f.path);
          }
        });
      });

      return res.status(400).json({
        success: false,
        message: `Invalid file: ${file.originalname}. File signature does not match expected format.`
      });
    }
  }

  next();
};

// Validate data
export const validateVerificationData = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const { businessName, businessAddress } = req.body;

  if (!businessName?.trim()) {
    return res.status(400).json({
      success: false,
      message: 'Business name is required'
    });
  }

  if (!businessAddress?.trim()) {
    return res.status(400).json({
      success: false,
      message: 'Business address is required'
    });
  }

  next();
};