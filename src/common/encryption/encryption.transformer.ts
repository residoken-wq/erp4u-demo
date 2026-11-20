import { ValueTransformer } from 'typeorm';
import * as crypto from 'crypto';
import { getEncryptionKey } from '../security/secrets';

/**
 * AES-256-GCM Column-Level Encryption Transformer
 * Securely encrypts PII (Personally Identifiable Information) before storing in DB,
 * and automatically decrypts upon retrieval.
 */
export class EncryptionTransformer implements ValueTransformer {
  private algorithm: crypto.CipherGCMTypes = 'aes-256-gcm';
  private key: Buffer | null = null;

  constructor() {
    // Key is lazily initialized on first encrypt/decrypt to avoid throwing on module import
  }

  private getKey(): Buffer {
    if (!this.key) {
      const rawKey = getEncryptionKey();
      this.key = crypto.createHash('sha256').update(String(rawKey)).digest();
    }
    return this.key;
  }

  /**
   * Encrypt value before saving to DB
   */
  to(value: string | null | undefined): string | null | undefined {
    if (value === null || value === undefined || value === '') {
      return value;
    }

    try {
      const iv = crypto.randomBytes(12); // Recommended 96 bits for GCM
      const cipher = crypto.createCipheriv(this.algorithm, this.getKey(), iv);
      
      let encrypted = cipher.update(String(value), 'utf8', 'hex');
      encrypted += cipher.final('hex');
      const authTag = cipher.getAuthTag().toString('hex');

      // Stored format: iv:authTag:ciphertext
      return `${iv.toString('hex')}:${authTag}:${encrypted}`;
    } catch (err) {
      console.error('[EncryptionTransformer] Error encrypting value:', err);
      return value;
    }
  }

  /**
   * Decrypt value when reading from DB
   */
  from(value: string | null | undefined): string | null | undefined {
    if (!value || typeof value !== 'string') {
      return value;
    }

    // Check if format matches iv:authTag:ciphertext
    const parts = value.split(':');
    if (parts.length !== 3) {
      // Legacy plaintext value (backward compatibility)
      return value;
    }

    const [ivHex, authTagHex, encryptedHex] = parts;
    if (ivHex.length !== 24 || authTagHex.length !== 32) {
      // Not a valid encrypted string, return as plaintext
      return value;
    }

    try {
      const iv = Buffer.from(ivHex, 'hex');
      const authTag = Buffer.from(authTagHex, 'hex');
      const decipher = crypto.createDecipheriv(this.algorithm, this.getKey(), iv);
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (err) {
      // In case of invalid key or unencrypted text matching colon format
      return value;
    }
  }
}
