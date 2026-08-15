import { EncryptionTransformer } from '../encryption.transformer';

describe('EncryptionTransformer', () => {
  let transformer: EncryptionTransformer;

  beforeEach(() => {
    process.env.ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    transformer = new EncryptionTransformer();
  });

  it('should encrypt and decrypt a string value correctly (Roundtrip)', () => {
    const original = '0903123456';
    const encrypted = transformer.to(original) as string;

    expect(encrypted).toBeDefined();
    expect(encrypted).not.toBe(original);
    expect(encrypted.split(':').length).toBe(3);

    const decrypted = transformer.from(encrypted);
    expect(decrypted).toBe(original);
  });

  it('should encrypt complex sensitive PII (tax code, legal representative, unicode name)', () => {
    const taxCode = '0317891234';
    const vietnameseName = 'Nguyễn Hoàng Hải';
    const email = 'hai.nh@ecoplast-vn.com';

    const encTax = transformer.to(taxCode) as string;
    const encName = transformer.to(vietnameseName) as string;
    const encEmail = transformer.to(email) as string;

    expect(transformer.from(encTax)).toBe(taxCode);
    expect(transformer.from(encName)).toBe(vietnameseName);
    expect(transformer.from(encEmail)).toBe(email);
  });

  it('should handle null and undefined gracefully', () => {
    expect(transformer.to(null)).toBeNull();
    expect(transformer.to(undefined)).toBeUndefined();
    expect(transformer.from(null)).toBeNull();
    expect(transformer.from(undefined)).toBeUndefined();
  });

  it('should return legacy unencrypted plaintext without crashing (Backward compatibility)', () => {
    const legacyPlaintext = 'Plaintext old data from before encryption';
    const result = transformer.from(legacyPlaintext);
    expect(result).toBe(legacyPlaintext);
  });
});
