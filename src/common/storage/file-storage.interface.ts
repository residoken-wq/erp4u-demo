import type { Readable } from 'stream';
import {
  DEFAULT_TENANT_CONTEXT,
  TenantContext,
} from '../tenancy/tenant-context';

export const FILE_STORAGE = Symbol('FILE_STORAGE');

export interface FilePutMeta {
  contentType?: string;
  originalName?: string;
  size?: number;
  cacheControl?: string;
  metadata?: Record<string, string>;
}

export interface FilePutResult {
  /**
   * The tenant-scoped storage key (e.g. "photo.jpg" for default tenant,
   * "tenant_a/photo.jpg" for tenant_a).
   */
  key: string;
  /**
   * URL used to access the file (e.g. "/uploads/photo.jpg" for default tenant,
   * "/uploads/tenant_a/photo.jpg" for tenant_a).
   */
  url: string;
  size?: number;
}

export interface FileGetResult {
  stream: Readable;
  size?: number;
  contentType?: string;
  mtime?: Date;
}

export interface FileListItem {
  /** Tenant-scoped storage key */
  key: string;
  /** Basename of the file */
  name: string;
  /** Public/relative URL */
  url: string;
  size: number;
  modified: Date;
}

export interface FileStorage {
  put(
    key: string,
    data: Buffer | Readable,
    meta?: FilePutMeta,
  ): Promise<FilePutResult>;
  get(key: string): Promise<FileGetResult | null>;
  delete(key: string): Promise<boolean>;
  url(key: string): string;
  exists?(key: string): Promise<boolean>;
  list?(prefix?: string): Promise<FileListItem[]>;
}

const VALID_TENANT_ID_REGEX = /^[a-z0-9_-]{1,64}$/i;

/**
 * Sanitizes a logical storage key and applies the tenant prefix:
 * - Tenant `default`: no prefix (preserves legacy `/uploads/<filename>` paths).
 * - Other tenants: prefixed with `<tenantId>/` (unless already prefixed with the SAME `<tenantId>/`).
 * - Rejects empty keys, null bytes, and path traversal segments (`.`, `..`).
 */
export function scopeKeyForTenant(
  rawKey: string,
  tenantIdOverride?: string,
): string {
  if (typeof rawKey !== 'string') {
    throw new Error('Storage key must be a non-empty string');
  }
  if (rawKey.includes('\0')) {
    throw new Error('Invalid storage key: null bytes are not allowed');
  }

  const normalized = rawKey.replace(/\\/g, '/').replace(/^\/+/, '').trim();
  if (!normalized) {
    throw new Error('Storage key must be a non-empty string');
  }

  const segments = normalized.split('/').filter((s) => s.length > 0);
  if (segments.length === 0) {
    throw new Error('Storage key must be a non-empty string');
  }
  for (const seg of segments) {
    if (seg === '.' || seg === '..') {
      throw new Error(`Invalid storage key "${rawKey}": path traversal is forbidden`);
    }
  }

  const cleanKey = segments.join('/');
  const tenantId = tenantIdOverride ?? TenantContext.current().tenantId;

  if (!VALID_TENANT_ID_REGEX.test(tenantId)) {
    throw new Error(`Invalid tenantId "${tenantId}" for file storage scoping`);
  }

  if (tenantId === DEFAULT_TENANT_CONTEXT.tenantId) {
    return cleanKey;
  }

  const expectedPrefix = `${tenantId}/`;
  if (cleanKey.startsWith(expectedPrefix)) {
    return cleanKey;
  }

  return `${expectedPrefix}${cleanKey}`;
}
