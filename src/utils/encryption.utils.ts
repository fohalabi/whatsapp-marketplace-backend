import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

export class EncryptionService {
    private algorithm = 'aes-256-gcm';
    private key: Buffer;

    constructor() {
        // Use environment variable or generate key
        const encryptionKey = process.env.ENCRYPTION_KEY || this.generateKey();

        if (!encryptionKey || encryptionKey.length !== 64) {
            throw new Error('ENCRYPTION_KEY must be 64 characters (32 bytes) hex string');
        }

        this.key = Buffer.from(encryptionKey, 'hex');
    }

    private generateKey(): string {
        // Generate a key if none exists (for development)
        const key = crypto.randomBytes(32).toString('hex');
        console.warn('⚠️  Generated encryption key for development. Set ENCRYPTION_KEY in production.');
        console.warn('Generated key:', key);
        return key;
    }

    encrypt(text: string): { encrypted: string; iv: string; authTag: string } {
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv(this.algorithm, this.key, iv) as crypto.CipherGCM;

        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');

        const authTag = cipher.getAuthTag().toString('hex');

        return {
            encrypted,
            iv: iv.toString('hex'),
            authTag
        };
    }

    decrypt(encrypted: string, iv: string, authTag: string): string {
        const decipher = crypto.createDecipheriv(
            this.algorithm,
            this.key,
            Buffer.from(iv, 'hex')
        ) as crypto.DecipherGCM;

        decipher.setAuthTag(Buffer.from(authTag, 'hex'));

        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        return decrypted;
    }

    encryptObject(data: any): { encrypted: string; iv: string; authTag: string } {
        return this.encrypt(JSON.stringify(data));
    }

    decryptObject(encrypted: string, iv: string, authTag: string): any {
        const decrypted = this.decrypt(encrypted, iv, authTag);
        return JSON.parse(decrypted);
    }

    hashPhone(phone: string): string {
        // Hash phone number for searching while preserving privacy
        const salt = process.env.HASH_SALT || 'whatsapp-marketplace';
        return crypto
            .createHmac('sha256', salt)
            .update(phone)
            .digest('hex')
            .slice(0, 32); // Truncate for consistent length
    }

    generateMessageHash(content: string, timestamp: Date): string {
        // Generate unique hash for message deduplication
        return crypto
            .createHash('sha256')
            .update(content + timestamp.getTime().toString())
            .digest('hex');
    }
}

// Singleton instance
export const encryptionService = new EncryptionService();
export default encryptionService;