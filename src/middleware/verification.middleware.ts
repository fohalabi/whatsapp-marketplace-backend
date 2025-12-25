import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types/auth.types';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

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

// Validate files
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