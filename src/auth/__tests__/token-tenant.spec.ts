import { UnauthorizedException } from '@nestjs/common';
import { assertTokenTenant } from '../token-tenant';
import {
  DEFAULT_TENANT_CONTEXT,
  TenantContext,
} from '../../common/tenancy/tenant-context';

describe('Token Tenant Binding (SEC-2 Unit)', () => {
  const originalEnvStrict = process.env.TENANCY_STRICT;

  beforeEach(() => {
    delete process.env.TENANCY_STRICT;
  });

  afterAll(() => {
    if (originalEnvStrict !== undefined) {
      process.env.TENANCY_STRICT = originalEnvStrict;
    } else {
      delete process.env.TENANCY_STRICT;
    }
  });

  it('tid khớp → qua', () => {
    // 1. tenant_a matches
    TenantContext.run({ tenantId: 'tenant_a', schema: 'tenant_a' }, () => {
      expect(() => assertTokenTenant({ tid: 'tenant_a', sub: 1 })).not.toThrow();
    });

    // 2. default tenant matches
    TenantContext.run(DEFAULT_TENANT_CONTEXT, () => {
      expect(() => assertTokenTenant({ tid: 'default', sub: 1 })).not.toThrow();
    });
  });

  it('tid khác → 401', () => {
    // Running in tenant_a context, token has tid: 'tenant_b'
    TenantContext.run({ tenantId: 'tenant_a', schema: 'tenant_a' }, () => {
      expect(() => assertTokenTenant({ tid: 'tenant_b', sub: 1 })).toThrow(
        UnauthorizedException,
      );
      expect(() => assertTokenTenant({ tid: 'tenant_b', sub: 1 })).toThrow(
        'TOKEN_TENANT_MISMATCH',
      );
    });

    // Running in tenant_b context, token has tid: 'tenant_a'
    TenantContext.run({ tenantId: 'tenant_b', schema: 'tenant_b' }, () => {
      expect(() => assertTokenTenant({ tid: 'tenant_a', sub: 1 })).toThrow(
        UnauthorizedException,
      );
      expect(() => assertTokenTenant({ tid: 'tenant_a', sub: 1 })).toThrow(
        'TOKEN_TENANT_MISMATCH',
      );
    });

    // Running in default context, token has tid: 'tenant_a'
    TenantContext.run(DEFAULT_TENANT_CONTEXT, () => {
      expect(() => assertTokenTenant({ tid: 'tenant_a', sub: 1 })).toThrow(
        UnauthorizedException,
      );
    });
  });

  it('không tid + default + non-strict → qua', () => {
    delete process.env.TENANCY_STRICT;

    // In default tenant context
    TenantContext.run(DEFAULT_TENANT_CONTEXT, () => {
      expect(() => assertTokenTenant({ sub: 1, username: 'admin' })).not.toThrow();
      expect(() => assertTokenTenant({})).not.toThrow();
    });

    // Outside TenantContext.run under non-strict defaults to DEFAULT_TENANT_CONTEXT
    expect(() => assertTokenTenant({ sub: 1, username: 'admin' })).not.toThrow();
    expect(() => assertTokenTenant({})).not.toThrow();

    // Explicit TENANCY_STRICT=false
    process.env.TENANCY_STRICT = 'false';
    TenantContext.run(DEFAULT_TENANT_CONTEXT, () => {
      expect(() => assertTokenTenant({ sub: 1, username: 'admin' })).not.toThrow();
    });
  });

  it('không tid + strict → 401', () => {
    process.env.TENANCY_STRICT = 'true';

    // Inside default tenant context under strict mode
    TenantContext.run(DEFAULT_TENANT_CONTEXT, () => {
      expect(() => assertTokenTenant({ sub: 1, username: 'admin' })).toThrow(
        UnauthorizedException,
      );
      expect(() => assertTokenTenant({ sub: 1, username: 'admin' })).toThrow(
        'TOKEN_TENANT_MISMATCH',
      );
      expect(() => assertTokenTenant({})).toThrow(UnauthorizedException);
    });

    // Outside TenantContext.run under strict mode
    expect(() => assertTokenTenant({ sub: 1, username: 'admin' })).toThrow(
      UnauthorizedException,
    );
    expect(() => assertTokenTenant({})).toThrow('TOKEN_TENANT_MISMATCH');
  });

  it('không tid + tenant khác default → 401', () => {
    delete process.env.TENANCY_STRICT;

    // Running in tenant_a context without tid
    TenantContext.run({ tenantId: 'tenant_a', schema: 'tenant_a' }, () => {
      expect(() => assertTokenTenant({ sub: 1, username: 'admin' })).toThrow(
        UnauthorizedException,
      );
      expect(() => assertTokenTenant({ sub: 1, username: 'admin' })).toThrow(
        'TOKEN_TENANT_MISMATCH',
      );
      expect(() => assertTokenTenant({})).toThrow(UnauthorizedException);
    });

    // Running in tenant_b context without tid
    TenantContext.run({ tenantId: 'tenant_b', schema: 'tenant_b' }, () => {
      expect(() => assertTokenTenant({ sub: 1, username: 'admin' })).toThrow(
        UnauthorizedException,
      );
      expect(() => assertTokenTenant({ sub: 1, username: 'admin' })).toThrow(
        'TOKEN_TENANT_MISMATCH',
      );
    });
  });
});
