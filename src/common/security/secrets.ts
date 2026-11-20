import * as crypto from 'crypto';

const FORBIDDEN_JWT_SECRETS = new Set([
  'ERP4U_SECRET_KEY',
  'change-me-jwt-secret-min-32-chars-random-string',
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
]);

const FORBIDDEN_ENCRYPTION_KEYS = new Set([
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  'ERP4U_SECRET_KEY',
]);

const LEGACY_DEV_ENCRYPTION_KEY =
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

let ephemeralJwtSecret: string | null = null;
let hasWarnedJwt = false;
let hasWarnedEncryptionKey = false;

export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET?.trim();
  const isProduction = process.env.NODE_ENV === 'production';

  if (isProduction) {
    if (!secret || secret.length < 32 || FORBIDDEN_JWT_SECRETS.has(secret)) {
      throw new Error('JWT_SECRET is required in production (min 32 chars)');
    }
    return secret;
  }

  if (secret) {
    return secret;
  }

  if (!ephemeralJwtSecret) {
    ephemeralJwtSecret = crypto.randomBytes(32).toString('hex');
    if (!hasWarnedJwt) {
      console.warn(
        '[Security] JWT_SECRET is not configured in non-production environment. Generated ephemeral secret; tokens will become invalid upon restart.',
      );
      hasWarnedJwt = true;
    }
  }

  return ephemeralJwtSecret;
}

export function getEncryptionKey(): string {
  const key = process.env.ENCRYPTION_KEY?.trim();
  const isProduction = process.env.NODE_ENV === 'production';

  if (isProduction) {
    if (!key || key.length < 32 || FORBIDDEN_ENCRYPTION_KEYS.has(key)) {
      throw new Error('ENCRYPTION_KEY is required in production (min 32 chars)');
    }
    return key;
  }

  if (key) {
    return key;
  }

  if (!hasWarnedEncryptionKey) {
    console.warn(
      '[Security] ENCRYPTION_KEY is not configured in non-production environment. Using legacy dev encryption key.',
    );
    hasWarnedEncryptionKey = true;
  }

  return LEGACY_DEV_ENCRYPTION_KEY;
}

export function validateSecurityConfig(): void {
  getJwtSecret();
  getEncryptionKey();
}

export function _resetSecretsStateForTesting(): void {
  ephemeralJwtSecret = null;
  hasWarnedJwt = false;
  hasWarnedEncryptionKey = false;
}
