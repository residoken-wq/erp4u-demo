import {
  getJwtSecret,
  getEncryptionKey,
  validateSecurityConfig,
  _resetSecretsStateForTesting,
} from '../secrets';

describe('Security Secrets Configuration', () => {
  const origEnv = process.env;

  beforeEach(() => {
    process.env = { ...origEnv };
    _resetSecretsStateForTesting();
  });

  afterAll(() => {
    process.env = origEnv;
    _resetSecretsStateForTesting();
  });

  describe('production mode', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
    });

    it('should throw when JWT_SECRET is missing', () => {
      delete process.env.JWT_SECRET;
      expect(() => getJwtSecret()).toThrow('JWT_SECRET is required in production (min 32 chars)');
    });

    it('should throw when JWT_SECRET is shorter than 32 characters', () => {
      process.env.JWT_SECRET = 'too-short-jwt-secret';
      expect(() => getJwtSecret()).toThrow('JWT_SECRET is required in production (min 32 chars)');
    });

    it('should throw when JWT_SECRET matches legacy default string', () => {
      process.env.JWT_SECRET = 'ERP4U_SECRET_KEY';
      expect(() => getJwtSecret()).toThrow('JWT_SECRET is required in production (min 32 chars)');
    });

    it('should return JWT_SECRET when valid in production', () => {
      const validSecret = 'valid-production-jwt-secret-min-32-chars-random';
      process.env.JWT_SECRET = validSecret;
      expect(getJwtSecret()).toBe(validSecret);
    });

    it('should throw when ENCRYPTION_KEY is missing in production', () => {
      delete process.env.ENCRYPTION_KEY;
      expect(() => getEncryptionKey()).toThrow('ENCRYPTION_KEY is required in production (min 32 chars)');
    });

    it('should throw when ENCRYPTION_KEY is shorter than 32 characters', () => {
      process.env.ENCRYPTION_KEY = 'too-short-key';
      expect(() => getEncryptionKey()).toThrow('ENCRYPTION_KEY is required in production (min 32 chars)');
    });

    it('should throw when ENCRYPTION_KEY matches legacy default string', () => {
      process.env.ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
      expect(() => getEncryptionKey()).toThrow('ENCRYPTION_KEY is required in production (min 32 chars)');
    });

    it('should return ENCRYPTION_KEY when valid in production', () => {
      const validKey = 'valid-production-encryption-key-0123456789abcdef0123456789abcdef';
      process.env.ENCRYPTION_KEY = validKey;
      expect(getEncryptionKey()).toBe(validKey);
    });

    it('validateSecurityConfig throws if either secret is invalid in production', () => {
      delete process.env.JWT_SECRET;
      process.env.ENCRYPTION_KEY = 'valid-production-encryption-key-0123456789abcdef0123456789abcdef';
      expect(() => validateSecurityConfig()).toThrow('JWT_SECRET is required in production (min 32 chars)');

      process.env.JWT_SECRET = 'valid-production-jwt-secret-min-32-chars-random';
      delete process.env.ENCRYPTION_KEY;
      expect(() => validateSecurityConfig()).toThrow('ENCRYPTION_KEY is required in production (min 32 chars)');
    });

    it('validateSecurityConfig succeeds when both secrets are valid in production', () => {
      process.env.JWT_SECRET = 'valid-production-jwt-secret-min-32-chars-random';
      process.env.ENCRYPTION_KEY = 'valid-production-encryption-key-0123456789abcdef0123456789abcdef';
      expect(() => validateSecurityConfig()).not.toThrow();
    });
  });

  describe('non-production mode (development / test)', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'development';
    });

    it('should generate ephemeral random secret when JWT_SECRET is missing and remain stable in process', () => {
      delete process.env.JWT_SECRET;
      const secret1 = getJwtSecret();
      expect(typeof secret1).toBe('string');
      expect(secret1.length).toBeGreaterThanOrEqual(32);

      const secret2 = getJwtSecret();
      expect(secret2).toBe(secret1);
    });

    it('should return configured JWT_SECRET when provided in non-production', () => {
      process.env.JWT_SECRET = 'my-custom-dev-secret';
      expect(getJwtSecret()).toBe('my-custom-dev-secret');
    });

    it('should fallback to legacy dev key when ENCRYPTION_KEY is missing in non-production', () => {
      delete process.env.ENCRYPTION_KEY;
      const key = getEncryptionKey();
      expect(key).toBe('0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef');
    });

    it('should return configured ENCRYPTION_KEY when provided in non-production', () => {
      process.env.ENCRYPTION_KEY = 'custom-dev-encryption-key';
      expect(getEncryptionKey()).toBe('custom-dev-encryption-key');
    });
  });
});
