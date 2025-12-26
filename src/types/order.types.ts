import { OrderStatus } from '@prisma/client';

export interface OrderItemDTO {
  productId: string;
  quantity: number;
  price: number;
}

export interface CreateOrderDTO {
  merchantId: string;
  orderItems: OrderItemDTO[];
  totalAmount: number;
  pickupTime: Date;
  orderNotes?: string;
}

export interface UpdateOrderStatusDTO {
  status: OrderStatus;
  rejectionReason?: string;
}

export interface OrderResponse {
  id: string;
  merchantId: string;
  totalAmount: number;
  status: OrderStatus;
  pickupTime: Date;
  orderNotes: string | null;
  orderItems: Array<{
    id: string;
    productId: string;
    productName: string;
    quantity: number;
    price: number;
  }>;
  createdAt: Date;
}