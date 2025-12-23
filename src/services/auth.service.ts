import prisma from '../config/database';
import { RegisterDTO, LoginDTO, JWTPayload } from '../types/auth.types';
import { hashPassword, comparePassword } from '../utils/password.utils';
import { generateToken } from '../utils/jwt.utils';

export class AuthService {
    async register(data: RegisterDTO) {
        const existingUser = await prisma.user.findUnique({
            where: { email: data.email }
        });

        if (existingUser) {
            throw new Error('User already exists');
        }

        const hashedPassword = await hashPassword(data.password);

        const user = await prisma.user.create({
            data: {
                email: data.email,
                password: hashedPassword,
                role: data.role || 'MERCHANT',
            },
        });

        const payload: JWTPayload = {
            userId: user.id,
            email: user.email,
            role: user.role,
        };

        const token = generateToken(payload);

        return {
            user: {
                id: user.id,
                email: user.email,
                role: user.role,
            },
            token
        };
    }

    async login(data: LoginDTO) {
        const user = await prisma.user.findUnique({
            where: { email: data.email },
        });

        if (!user) {
            throw new Error('Invalid credentials');
        }

        if (!user.isActive) {
            throw new Error('Account is deactivated');
        }

        const isPasswordValid = await comparePassword(data.password, user.password);

        if (!isPasswordValid) {
            throw new Error('Invalid credentials');
        }

        const payload: JWTPayload = {
            userId: user.id,
            email: user.email,
            role: user.role,
        };

        const token = generateToken(payload);

        return {
            user: {
                id: user.id,
                email: user.email,
                role: user.role,
            },
            token,
        };
    }
}