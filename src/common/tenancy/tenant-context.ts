import { AsyncLocalStorage } from 'async_hooks';

export interface TenantContext {
  tenantId: string;
  schema: string;
}

export const TENANT_SCHEMA_REGEX = /^[a-z_][a-z0-9_]{0,62}$/;

export const DEFAULT_TENANT_CONTEXT: Readonly<TenantContext> = Object.freeze({
  tenantId: 'default',
  schema: 'public',
});

export function assertValidTenantSchema(schema: string): string {
  if (typeof schema !== 'string' || !TENANT_SCHEMA_REGEX.test(schema)) {
    throw new Error(
      `Invalid tenant schema "${String(schema)}": must match ${TENANT_SCHEMA_REGEX.source}`,
    );
  }
  return schema;
}

export function quoteSchemaIdentifier(schema: string): string {
  const valid = assertValidTenantSchema(schema);
  return `"${valid}"`;
}

export function buildSetSearchPathSql(schema: string): string {
  return `SET search_path TO ${quoteSchemaIdentifier(schema)}, public`;
}

export function isTenancyStrict(): boolean {
  return (process.env.TENANCY_STRICT || '').trim().toLowerCase() === 'true';
}

const tenantStorage = new AsyncLocalStorage<TenantContext>();

export const TenantContext = {
  run<T>(ctx: TenantContext, fn: () => T): T {
    if (!ctx || typeof ctx.tenantId !== 'string' || ctx.tenantId.trim() === '') {
      throw new Error('Invalid tenant context: tenantId must be a non-empty string');
    }
    assertValidTenantSchema(ctx.schema);
    return tenantStorage.run({ tenantId: ctx.tenantId, schema: ctx.schema }, fn);
  },

  current(): TenantContext {
    const store = tenantStorage.getStore();
    if (store) {
      assertValidTenantSchema(store.schema);
      return store;
    }
    if (isTenancyStrict()) {
      throw new Error(
        'TenantContext is not active (TENANCY_STRICT=true). Wrap execution in TenantContext.run(...).',
      );
    }
    return DEFAULT_TENANT_CONTEXT;
  },

  getStore(): TenantContext | undefined {
    return tenantStorage.getStore();
  },
};
