import { ApprovalStatus } from '@prisma/client';

export interface CreateProductDTO {
  name: string;
  description: string;
  category: string;
  price: number;
  stockQuantity: number;
  unit: string;
  minOrderQty: number;
  variants?: Array<{ type: string; value: string }>;
}

export interface UpdateProductDTO {
  name?: string;
  description?: string;
  category?: string;
  price?: number;
  stockQuantity?: number;
  unit?: string;
  minOrderQty?: number;
  variants?: Array<{ type: string; value: string }>;
}

export interface ProductResponse {
  id: string;
  name: string;
  description: string;
  category: string;
  price: number;
  stockQuantity: number;
  unit: string;
  minOrderQty: number;
  images: string[];
  variants: any;
  approvalStatus: ApprovalStatus;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}