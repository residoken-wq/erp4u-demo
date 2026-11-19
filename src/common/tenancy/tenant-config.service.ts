import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource, In } from 'typeorm';
import { SystemConfig } from '../../system/system-config.entity';
import { EncryptionService } from '../encryption/encryption.service';
import { DEFAULT_TENANT_CONTEXT, TenantContext } from './tenant-context';

export interface TenantConfigGetOptions {
  /**
   * Optional env variable name(s) to check when falling back for the `default` tenant.
   * Defaults to `[key]`.
   */
  envKey?: string | string[];
  /**
   * Bypass in-memory per-tenant cache and read directly from tenant schema.
   */
  bypassCache?: boolean;
  /**
   * Allow fallback to process.env / ConfigService when tenant is `default`.
   * Defaults to `true`. Non-default tenants NEVER fall back to env regardless of this flag.
   */
  fallbackToEnv?: boolean;
}

export interface TenantConfigSetOptions {
  description?: string;
  /**
   * Explicitly mark value as secret (encrypted at rest using EncryptionService).
   * If omitted, auto-detected via `isSecretConfigKey(key)`.
   */
  secret?: boolean;
}

interface CacheEntry {
  value: string | undefined;
  expiresAt: number;
}

const KNOWN_SECRET_KEYS = new Set([
  'SMTP_PASS',
  'EASYINVOICE_PASSWORD',
  'ZALO_APP_SECRET',
  'ZALO_ACCESS_TOKEN',
  'ZALO_REFRESH_TOKEN',
  'TIKTOK_APP_SECRET',
  'GHTK_TOKEN',
  'GHTK_API_TOKEN',
  'LALAMOVE_API_SECRET',
  'GEMINI_API_KEY',
  'CHATBOT_LLM_API_KEY',
  'FIREBASE_PRIVATE_KEY',
  'FIREBASE_API_KEY',
]);

const SECRET_KEY_SUFFIX_REGEX =
  /(?:_PASS(?:WORD)?|_SECRET|_TOKEN|_API_KEY|_PRIVATE_KEY)$/i;

/**
 * Checks whether a configuration key represents a secret that must be encrypted at rest.
 */
export function isSecretConfigKey(key: string): boolean {
  const upper = (key || '').trim().toUpperCase();
  return KNOWN_SECRET_KEYS.has(upper) || SECRET_KEY_SUFFIX_REGEX.test(upper);
}

/**
 * Checks whether a string matches EncryptionService's AES-256-GCM format (`iv24hex:authTag32hex:cipherHex`).
 */
export function isEncryptedValue(value: string | null | undefined): boolean {
  if (!value || typeof value !== 'string') return false;
  const parts = value.split(':');
  if (parts.length !== 3) return false;
  const [ivHex, authTagHex, cipherHex] = parts;
  return (
    /^[0-9a-f]{24}$/i.test(ivHex) &&
    /^[0-9a-f]{32}$/i.test(authTagHex) &&
    /^[0-9a-f]*$/i.test(cipherHex)
  );
}

export const TENANT_CONFIG_CACHE_TTL_MS = 30_000; // 30s (<= 60s)
export const MAX_TENANT_CONFIG_CACHE_TTL_MS = 60_000;

@Injectable()
export class TenantConfigService {
  private readonly logger = new Logger(TenantConfigService.name);
  private readonly cache = new Map<string, Map<string, CacheEntry>>();
  private readonly cacheTtlMs: number;

  constructor(
    @Optional() private readonly dataSource?: DataSource,
    @Optional() private readonly encryptionService?: EncryptionService,
    @Optional() private readonly configService?: ConfigService,
  ) {
    this.cacheTtlMs = Math.min(
      TENANT_CONFIG_CACHE_TTL_MS,
      MAX_TENANT_CONFIG_CACHE_TTL_MS,
    );
  }

  /**
   * Returns a tenant-scoped config value from `system_configs` in the current tenant's schema.
   * Falls back to environment variables ONLY when the active tenant is `default`.
   * Encrypted values are transparently decrypted via EncryptionService.
   */
  async get(
    key: string,
    options?: TenantConfigGetOptions,
  ): Promise<string | undefined> {
    const { tenantId } = TenantContext.current();
    const allowEnvFallback =
      tenantId === DEFAULT_TENANT_CONTEXT.tenantId &&
      options?.fallbackToEnv !== false;
    const cacheKey = this.buildCacheKey(key, options?.envKey, allowEnvFallback);

    if (!options?.bypassCache) {
      const cached = this.getCached(tenantId, cacheKey);
      if (cached !== null) {
        return cached.value;
      }
    }

    const dbValue = await this.readFromDb(key);
    let resolved: string | undefined;

    if (dbValue !== undefined) {
      resolved = this.decryptIfNeeded(dbValue);
    } else if (allowEnvFallback) {
      resolved = this.readFromEnv(key, options?.envKey);
    }

    this.setCached(tenantId, cacheKey, resolved);
    return resolved;
  }

  /**
   * Like `get()`, but throws a descriptive error if the key is missing or empty.
   * Never includes secret values in error messages.
   */
  async getRequired(
    key: string,
    options?: TenantConfigGetOptions,
  ): Promise<string> {
    const { tenantId } = TenantContext.current();
    const value = await this.get(key, options);
    if (value === undefined || value === '') {
      throw new Error(
        `Missing required tenant configuration "${key}" for tenant "${tenantId}"`,
      );
    }
    return value;
  }

  /**
   * Batch-reads multiple configuration keys for the current tenant in at most one DB query
   * for uncached keys.
   */
  async getMany(
    keys: string[],
    options?: {
      envKeyMap?: Record<string, string | string[]>;
      bypassCache?: boolean;
      fallbackToEnv?: boolean;
    },
  ): Promise<Record<string, string | undefined>> {
    const { tenantId } = TenantContext.current();
    const allowEnvFallback =
      tenantId === DEFAULT_TENANT_CONTEXT.tenantId &&
      options?.fallbackToEnv !== false;
    const result: Record<string, string | undefined> = {};
    const missingKeys: string[] = [];

    for (const key of keys) {
      const envKey = options?.envKeyMap?.[key];
      const cacheKey = this.buildCacheKey(key, envKey, allowEnvFallback);
      if (!options?.bypassCache) {
        const cached = this.getCached(tenantId, cacheKey);
        if (cached !== null) {
          result[key] = cached.value;
          continue;
        }
      }
      missingKeys.push(key);
    }

    if (missingKeys.length > 0) {
      const dbMap = await this.readManyFromDb(missingKeys);
      for (const key of missingKeys) {
        const envKey = options?.envKeyMap?.[key];
        const cacheKey = this.buildCacheKey(key, envKey, allowEnvFallback);
        const raw = dbMap.get(key);
        let resolved: string | undefined;

        if (raw !== undefined) {
          resolved = this.decryptIfNeeded(raw);
        } else if (allowEnvFallback) {
          resolved = this.readFromEnv(key, envKey);
        }

        this.setCached(tenantId, cacheKey, resolved);
        result[key] = resolved;
      }
    }

    return result;
  }

  /**
   * Persists a configuration key into `system_configs` in the current tenant's schema.
   * Secret values are encrypted via EncryptionService before storage.
   * Immediately invalidates the current tenant's cache for this key.
   */
  async set(
    key: string,
    value: string,
    options?: TenantConfigSetOptions,
  ): Promise<void> {
    if (!this.dataSource) {
      throw new Error('TenantConfigService: DataSource is not available');
    }

    const { tenantId } = TenantContext.current();
    const shouldEncrypt = options?.secret ?? isSecretConfigKey(key);
    const storedValue =
      shouldEncrypt && value && !isEncryptedValue(value) && this.encryptionService
        ? this.encryptionService.encrypt(value)
        : value;

    const repo = this.dataSource.getRepository(SystemConfig);
    let item = await repo.findOne({ where: { key } });
    if (!item) {
      item = repo.create({
        key,
        value: storedValue,
        description: options?.description,
      });
    } else {
      item.value = storedValue;
      if (options?.description !== undefined) {
        item.description = options.description;
      }
    }
    await repo.save(item);
    this.invalidateCache(tenantId, key);
  }

  /**
   * Invalidates cached entries.
   * - No args: clears all tenants
   * - tenantId only: clears all keys for that tenant
   * - tenantId + key: clears cached variants of that key for that tenant
   */
  invalidateCache(tenantId?: string, key?: string): void {
    if (!tenantId) {
      this.cache.clear();
      return;
    }
    const tenantMap = this.cache.get(tenantId);
    if (!tenantMap) return;
    if (!key) {
      this.cache.delete(tenantId);
      return;
    }
    const prefix = `${key}|`;
    for (const k of Array.from(tenantMap.keys())) {
      if (k === key || k.startsWith(prefix)) {
        tenantMap.delete(k);
      }
    }
  }

  /**
   * Decrypts a value if it matches the AES-256-GCM ciphertext format and EncryptionService is available.
   * Safe for legacy plaintext values.
   */
  decryptIfNeeded(value: string): string {
    if (!value || !this.encryptionService) {
      return value;
    }
    if (isEncryptedValue(value)) {
      return this.encryptionService.decrypt(value);
    }
    return value;
  }

  private buildCacheKey(
    key: string,
    envKey?: string | string[],
    allowEnvFallback?: boolean,
  ): string {
    const envPart = Array.isArray(envKey)
      ? envKey.join(',')
      : envKey || key;
    return `${key}|${allowEnvFallback ? '1' : '0'}|${envPart}`;
  }

  private getCached(tenantId: string, cacheKey: string): CacheEntry | null {
    const tenantMap = this.cache.get(tenantId);
    if (!tenantMap) return null;
    const entry = tenantMap.get(cacheKey);
    if (!entry) return null;
    if (Date.now() >= entry.expiresAt) {
      tenantMap.delete(cacheKey);
      return null;
    }
    return entry;
  }

  private setCached(
    tenantId: string,
    cacheKey: string,
    value: string | undefined,
  ): void {
    let tenantMap = this.cache.get(tenantId);
    if (!tenantMap) {
      tenantMap = new Map<string, CacheEntry>();
      this.cache.set(tenantId, tenantMap);
    }
    tenantMap.set(cacheKey, {
      value,
      expiresAt: Date.now() + this.cacheTtlMs,
    });
  }

  private async readFromDb(key: string): Promise<string | undefined> {
    if (!this.dataSource) return undefined;
    try {
      const repo = this.dataSource.getRepository(SystemConfig);
      const row = await repo.findOne({ where: { key } });
      if (row && row.value !== null && row.value !== undefined && row.value !== '') {
        return row.value;
      }
      return undefined;
    } catch (err: any) {
      this.logger.warn(
        `Failed to read tenant config key "${key}" from database: ${err?.message || 'unknown error'}`,
      );
      return undefined;
    }
  }

  private async readManyFromDb(keys: string[]): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    if (!this.dataSource || keys.length === 0) return map;
    try {
      const repo = this.dataSource.getRepository(SystemConfig);
      const rows = await repo.find({ where: { key: In(keys) } });
      for (const row of rows) {
        if (row.value !== null && row.value !== undefined && row.value !== '') {
          map.set(row.key, row.value);
        }
      }
    } catch (err: any) {
      this.logger.warn(
        `Failed to batch-read tenant config keys from database: ${err?.message || 'unknown error'}`,
      );
    }
    return map;
  }

  private readFromEnv(
    key: string,
    envKey?: string | string[],
  ): string | undefined {
    const candidates = envKey
      ? Array.isArray(envKey)
        ? envKey
        : [envKey]
      : [key];

    for (const candidate of candidates) {
      const fromConfig = this.configService?.get<string | number>(candidate);
      if (
        fromConfig !== undefined &&
        fromConfig !== null &&
        String(fromConfig) !== ''
      ) {
        return String(fromConfig);
      }
      const fromProcess = process.env[candidate];
      if (fromProcess !== undefined && fromProcess !== '') {
        return fromProcess;
      }
    }
    return undefined;
  }
}
