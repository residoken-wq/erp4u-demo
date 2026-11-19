import { Inject, Injectable, Optional } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import type { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import {
  DEFAULT_TENANT_CONTEXT,
  TenantContext,
} from '../tenancy/tenant-context';
import {
  FileGetResult,
  FileListItem,
  FilePutMeta,
  FilePutResult,
  FileStorage,
  scopeKeyForTenant,
} from './file-storage.interface';

export const LOCAL_STORAGE_OPTIONS = Symbol('LOCAL_STORAGE_OPTIONS');

export interface LocalFileStorageOptions {
  baseDir?: string;
  publicPrefix?: string;
}

const MIME_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx':
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx':
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

function guessContentType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_TYPES[ext] || 'application/octet-stream';
}

@Injectable()
export class LocalFileStorage implements FileStorage {
  private readonly baseDir: string;
  private readonly publicPrefix: string;

  constructor(
    @Optional()
    @Inject(LOCAL_STORAGE_OPTIONS)
    options?: LocalFileStorageOptions,
  ) {
    this.baseDir = path.resolve(
      options?.baseDir || path.join(process.cwd(), 'uploads'),
    );
    const rawPrefix = options?.publicPrefix ?? '/uploads';
    this.publicPrefix = rawPrefix.replace(/\/+$/, '');
  }

  private resolveSafePath(scopedKey: string): string {
    const targetPath = path.resolve(this.baseDir, ...scopedKey.split('/'));
    const baseWithSep = this.baseDir.endsWith(path.sep)
      ? this.baseDir
      : `${this.baseDir}${path.sep}`;
    if (targetPath !== this.baseDir && !targetPath.startsWith(baseWithSep)) {
      throw new Error(
        `Resolved storage path escapes base directory for key "${scopedKey}"`,
      );
    }
    return targetPath;
  }

  async put(
    key: string,
    data: Buffer | Readable,
    _meta?: FilePutMeta,
  ): Promise<FilePutResult> {
    const scopedKey = scopeKeyForTenant(key);
    const fullPath = this.resolveSafePath(scopedKey);

    await fs.promises.mkdir(path.dirname(fullPath), { recursive: true });

    if (Buffer.isBuffer(data)) {
      await fs.promises.writeFile(fullPath, data);
    } else {
      const writeStream = fs.createWriteStream(fullPath);
      await pipeline(data, writeStream);
    }

    const stat = await fs.promises.stat(fullPath);
    return {
      key: scopedKey,
      url: this.formatUrl(scopedKey),
      size: stat.size,
    };
  }

  async get(key: string): Promise<FileGetResult | null> {
    const scopedKey = scopeKeyForTenant(key);
    const fullPath = this.resolveSafePath(scopedKey);

    try {
      const stat = await fs.promises.stat(fullPath);
      if (!stat.isFile()) {
        return null;
      }
      return {
        stream: fs.createReadStream(fullPath),
        size: stat.size,
        contentType: guessContentType(fullPath),
        mtime: stat.mtime,
      };
    } catch (err: any) {
      if (err?.code === 'ENOENT' || err?.code === 'ENOTDIR') {
        return null;
      }
      throw err;
    }
  }

  async delete(key: string): Promise<boolean> {
    const scopedKey = scopeKeyForTenant(key);
    const fullPath = this.resolveSafePath(scopedKey);

    try {
      const stat = await fs.promises.stat(fullPath);
      if (!stat.isFile()) {
        return false;
      }
      await fs.promises.unlink(fullPath);
      return true;
    } catch (err: any) {
      if (err?.code === 'ENOENT' || err?.code === 'ENOTDIR') {
        return false;
      }
      throw err;
    }
  }

  url(key: string): string {
    const scopedKey = scopeKeyForTenant(key);
    return this.formatUrl(scopedKey);
  }

  async exists(key: string): Promise<boolean> {
    const scopedKey = scopeKeyForTenant(key);
    const fullPath = this.resolveSafePath(scopedKey);

    try {
      const stat = await fs.promises.stat(fullPath);
      return stat.isFile();
    } catch {
      return false;
    }
  }

  async list(prefix?: string): Promise<FileListItem[]> {
    const { tenantId } = TenantContext.current();
    const parts: string[] = [];

    if (tenantId !== DEFAULT_TENANT_CONTEXT.tenantId) {
      parts.push(tenantId);
    }

    if (prefix) {
      const cleanPrefix = prefix
        .replace(/\\/g, '/')
        .replace(/^\/+|\/+$/g, '')
        .trim();
      if (cleanPrefix) {
        const segs = cleanPrefix.split('/').filter(Boolean);
        for (const seg of segs) {
          if (seg === '.' || seg === '..') {
            throw new Error(`Invalid list prefix "${prefix}"`);
          }
        }
        parts.push(...segs);
      }
    }

    const dirPath =
      parts.length > 0
        ? this.resolveSafePath(parts.join('/'))
        : this.baseDir;

    let entries: fs.Dirent[];
    try {
      entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
    } catch (err: any) {
      if (err?.code === 'ENOENT') {
        return [];
      }
      throw err;
    }

    const items: FileListItem[] = [];
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const entryPath = path.join(dirPath, entry.name);
      const stat = await fs.promises.stat(entryPath);
      const scopedKey = [...parts, entry.name].join('/');
      items.push({
        key: scopedKey,
        name: entry.name,
        url: this.formatUrl(scopedKey),
        size: stat.size,
        modified: stat.mtime,
      });
    }

    return items;
  }

  private formatUrl(scopedKey: string): string {
    return `${this.publicPrefix}/${scopedKey}`;
  }
}
