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

    async riderRegister(data: any) {
        const { email, password, firstName, lastName, phone, vehicleType, vehicleNumber, licensePlate } = data;

        // Validation
        if (!email || !password || !firstName || !lastName || !phone || !vehicleType) {
            throw new Error('All required fields must be provided');
        }

        // Check existing
        const existing = await prisma.user.findFirst({
            where: { OR: [{ email }, { phone }] },
        });

        if (existing) {
            throw new Error('User already exists');
        }

        const hashedPassword = await hashPassword(password);

        // Create user + rider
        const user = await prisma.user.create({
            data: {
            email,
            phone,
            password: hashedPassword,
            role: 'RIDER',
            rider: {
                create: {
                firstName,
                lastName,
                phone,
                email,
                vehicleType,
                vehicleNumber,
                licensePlate,
                },
            },
            },
            include: { rider: true },
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
            rider: user.rider,
            },
            token,
        };
    }
}