import { Role } from "@prisma/client";
import { Request } from "express";

export interface RegisterDTO {
    email: string;
    password: string;
    role?: Role;
}

export interface LoginDTO {
    email: string;
    password: string;
}

export interface JWTPayload {
    userId: string;
    email: string;
    role: Role;
}

export interface CustomJWTPayload extends JWTPayload {
  id: string;
  email: string;
  role: Role;
  merchantId?: string;
}

export interface AuthRequest extends Request {
  user?: CustomJWTPayload;
}