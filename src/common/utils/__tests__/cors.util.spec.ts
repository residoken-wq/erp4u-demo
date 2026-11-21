import { isCorsOriginAllowed } from '../cors.util';

describe('CORS Origin Allowed (isCorsOriginAllowed)', () => {
  const saasPattern = 'https://*.erp4u.conix.cloud';
  const rootDomain = 'https://erp4u.conix.cloud';

  describe('Wildcard Subdomain Matching (production)', () => {
    const allowed = [saasPattern];

    it('allows valid single-label subdomains', () => {
      expect(isCorsOriginAllowed('https://tenant1.erp4u.conix.cloud', allowed, 'production')).toBe(true);
      expect(isCorsOriginAllowed('https://my-tenant-1.erp4u.conix.cloud', allowed, 'production')).toBe(true);
      expect(isCorsOriginAllowed('https://a.erp4u.conix.cloud', allowed, 'production')).toBe(true);
      expect(isCorsOriginAllowed('https://0.erp4u.conix.cloud', allowed, 'production')).toBe(true);
    });

    it('allows valid subdomain with max length (63 chars)', () => {
      const label63 = 'a'.repeat(63);
      expect(isCorsOriginAllowed(`https://${label63}.erp4u.conix.cloud`, allowed, 'production')).toBe(true);
    });

    it('handles uppercase hostnames correctly', () => {
      expect(isCorsOriginAllowed('https://TENANT1.erp4u.conix.cloud', allowed, 'production')).toBe(true);
      expect(isCorsOriginAllowed('HTTPS://TENANT1.ERP4U.CONIX.CLOUD', allowed, 'production')).toBe(true);
    });

    it('does NOT match root domain itself unless explicitly listed', () => {
      expect(isCorsOriginAllowed(rootDomain, [saasPattern], 'production')).toBe(false);
      expect(isCorsOriginAllowed(rootDomain, [rootDomain, saasPattern], 'production')).toBe(true);
    });

    it('does NOT match multi-level subdomains', () => {
      expect(isCorsOriginAllowed('https://a.b.erp4u.conix.cloud', allowed, 'production')).toBe(false);
      expect(isCorsOriginAllowed('https://sub.tenant1.erp4u.conix.cloud', allowed, 'production')).toBe(false);
    });

    it('does NOT match fake or spoofed domains', () => {
      expect(isCorsOriginAllowed('https://evilerp4u.conix.cloud', allowed, 'production')).toBe(false);
      expect(isCorsOriginAllowed('https://x.erp4u.conix.cloud.evil.com', allowed, 'production')).toBe(false);
      expect(isCorsOriginAllowed('https://erp4u.conix.cloud.attacker.com', allowed, 'production')).toBe(false);
    });

    it('does NOT match when scheme is http and pattern is https', () => {
      expect(isCorsOriginAllowed('http://tenant1.erp4u.conix.cloud', allowed, 'production')).toBe(false);
    });

    it('does NOT match origin null (sandboxed iframe / opaque origin)', () => {
      expect(isCorsOriginAllowed('null', allowed, 'production')).toBe(false);
    });

    it('does NOT match invalid subdomain labels', () => {
      expect(isCorsOriginAllowed('https://-tenant.erp4u.conix.cloud', allowed, 'production')).toBe(false);
      expect(isCorsOriginAllowed('https://tenant-.erp4u.conix.cloud', allowed, 'production')).toBe(false);
      expect(isCorsOriginAllowed('https://tenant_1.erp4u.conix.cloud', allowed, 'production')).toBe(false);
      expect(isCorsOriginAllowed('https://.erp4u.conix.cloud', allowed, 'production')).toBe(false);
      const label64 = 'a'.repeat(64);
      expect(isCorsOriginAllowed(`https://${label64}.erp4u.conix.cloud`, allowed, 'production')).toBe(false);
    });

    it('enforces port restrictions', () => {
      // Pattern without port should not allow origin with non-default port
      expect(isCorsOriginAllowed('https://tenant1.erp4u.conix.cloud:8443', [saasPattern], 'production')).toBe(false);

      // Pattern with port matches only matching port
      const allowedWithPort = ['https://*.erp4u.conix.cloud:8443'];
      expect(isCorsOriginAllowed('https://tenant1.erp4u.conix.cloud:8443', allowedWithPort, 'production')).toBe(true);
      expect(isCorsOriginAllowed('https://tenant1.erp4u.conix.cloud', allowedWithPort, 'production')).toBe(false);
      expect(isCorsOriginAllowed('https://tenant1.erp4u.conix.cloud:9443', allowedWithPort, 'production')).toBe(false);
    });

    it('supports http wildcard pattern when explicitly configured', () => {
      const httpPattern = ['http://*.example.com:3000'];
      expect(isCorsOriginAllowed('http://dev.example.com:3000', httpPattern, 'production')).toBe(true);
      expect(isCorsOriginAllowed('https://dev.example.com:3000', httpPattern, 'production')).toBe(false);
      expect(isCorsOriginAllowed('http://dev.example.com', httpPattern, 'production')).toBe(false);
    });
  });

  describe('Legacy Behavior Preservation', () => {
    it('allows any origin in non-production environments', () => {
      expect(isCorsOriginAllowed('https://evil.com', ['https://trusted.com'], 'development')).toBe(true);
      expect(isCorsOriginAllowed('http://localhost:5173', [], 'test')).toBe(true);
      expect(isCorsOriginAllowed('null', [], 'development')).toBe(true);
    });

    it('allows undefined origin (same-origin / server-to-server / curl)', () => {
      expect(isCorsOriginAllowed(undefined, ['https://erp4u.conix.cloud'], 'production')).toBe(true);
      expect(isCorsOriginAllowed(undefined, [], 'production')).toBe(true);
    });

    it('allows wildcard * in allowedOrigins', () => {
      expect(isCorsOriginAllowed('https://any-site.com', ['*'], 'production')).toBe(true);
      expect(isCorsOriginAllowed('https://another.com', ['https://erp4u.conix.cloud', '*'], 'production')).toBe(true);
    });

    it('allows exact origin match in production', () => {
      const allowed = ['https://erp4u-demo.conix.cloud', 'https://erp4u.conix.cloud'];
      expect(isCorsOriginAllowed('https://erp4u-demo.conix.cloud', allowed, 'production')).toBe(true);
      expect(isCorsOriginAllowed('https://erp4u.conix.cloud', allowed, 'production')).toBe(true);
      expect(isCorsOriginAllowed('https://not-allowed.conix.cloud', allowed, 'production')).toBe(false);
    });

    it('handles invalid origin strings gracefully without throwing', () => {
      expect(isCorsOriginAllowed('not-a-url', [saasPattern], 'production')).toBe(false);
      expect(isCorsOriginAllowed('', [saasPattern], 'production')).toBe(true);
    });

    it('ignores malformed patterns in allowedOrigins gracefully', () => {
      const mixed = ['not-a-valid-url', 'https://*.', 'https://*.*.com', saasPattern];
      expect(isCorsOriginAllowed('https://tenant1.erp4u.conix.cloud', mixed, 'production')).toBe(true);
      expect(isCorsOriginAllowed('https://evil.com', mixed, 'production')).toBe(false);
    });
  });
});
