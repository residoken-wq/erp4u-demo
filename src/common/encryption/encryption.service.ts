import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { getEncryptionKey } from '../security/secrets';

@Injectable()
export class EncryptionService {
  private readonly logger = new Logger(EncryptionService.name);
  private readonly algorithm = 'aes-256-gcm';
  private key: Buffer | null = null;

  constructor() {
    this.logger.log('🔒 Encryption service initialized (AES-256-GCM)');
  }

  private getKey(): Buffer {
    if (!this.key) {
      const rawKey = getEncryptionKey();
      this.key = crypto.createHash('sha256').update(String(rawKey)).digest();
    }
    return this.key;
  }

  encrypt(plaintext: string): string {
    if (!plaintext) return plaintext;
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(this.algorithm, this.getKey(), iv);
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
  }

  decrypt(ciphertext: string): string {
    if (!ciphertext || typeof ciphertext !== 'string') return ciphertext;
    const parts = ciphertext.split(':');
    if (parts.length !== 3) return ciphertext;
    try {
      const iv = Buffer.from(parts[0], 'hex');
      const authTag = Buffer.from(parts[1], 'hex');
      const decipher = crypto.createDecipheriv(this.algorithm, this.getKey(), iv);
      decipher.setAuthTag(authTag);
      let decrypted = decipher.update(parts[2], 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (e) {
      return ciphertext;
    }
  }

  static generateKey(): string {
    return crypto.randomBytes(32).toString('hex');
  }
}
