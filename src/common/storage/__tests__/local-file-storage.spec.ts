import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { Readable } from 'stream';
import { TenantContext } from '../../tenancy/tenant-context';
import { scopeKeyForTenant } from '../file-storage.interface';
import { LocalFileStorage } from '../local-file-storage.service';

async function streamToString(stream: Readable): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const c of stream) {
    chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c));
  }
  return Buffer.concat(chunks).toString('utf8');
}

describe('LocalFileStorage & tenant key scoping', () => {
  let tmpDir: string;
  let storage: LocalFileStorage;

  beforeEach(async () => {
    tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'erp4u-storage-'));
    storage = new LocalFileStorage({ baseDir: tmpDir, publicPrefix: '/uploads' });
  });

  afterEach(async () => {
    await fs.promises.rm(tmpDir, { recursive: true, force: true });
  });

  it('keeps legacy unprefixed keys and URLs for default tenant', async () => {
    const putRes = await TenantContext.run(
      { tenantId: 'default', schema: 'public' },
      () => storage.put('banner.png', Buffer.from('default-demo-bytes')),
    );

    expect(putRes.key).toBe('banner.png');
    expect(putRes.url).toBe('/uploads/banner.png');
    expect(fs.existsSync(path.join(tmpDir, 'banner.png'))).toBe(true);

    const got = await TenantContext.run(
      { tenantId: 'default', schema: 'public' },
      () => storage.get('banner.png'),
    );
    expect(got).not.toBeNull();
    expect(await streamToString(got!.stream)).toBe('default-demo-bytes');
  });

  it('prefixes keys with tenantId/ for non-default tenants and isolates reads/deletes/lists', async () => {
    const putA = await TenantContext.run(
      { tenantId: 'tenant_a', schema: 'tenant_a' },
      () => storage.put('doc.txt', Readable.from(['hello-from-tenant-a'])),
    );

    expect(putA.key).toBe('tenant_a/doc.txt');
    expect(putA.url).toBe('/uploads/tenant_a/doc.txt');
    expect(fs.existsSync(path.join(tmpDir, 'tenant_a', 'doc.txt'))).toBe(true);

    // tenant_a can read its own file
    const readA = await TenantContext.run(
      { tenantId: 'tenant_a', schema: 'tenant_a' },
      () => storage.get('doc.txt'),
    );
    expect(readA).not.toBeNull();
    expect(await streamToString(readA!.stream)).toBe('hello-from-tenant-a');

    // tenant_b CANNOT read tenant_a's file by bare name OR by tenant_a/ prefix
    const readB1 = await TenantContext.run(
      { tenantId: 'tenant_b', schema: 'tenant_b' },
      () => storage.get('doc.txt'),
    );
    const readB2 = await TenantContext.run(
      { tenantId: 'tenant_b', schema: 'tenant_b' },
      () => storage.get('tenant_a/doc.txt'),
    );
    expect(readB1).toBeNull();
    expect(readB2).toBeNull();

    // tenant_b list does not see tenant_a's file
    const listA = await TenantContext.run(
      { tenantId: 'tenant_a', schema: 'tenant_a' },
      () => storage.list(),
    );
    const listB = await TenantContext.run(
      { tenantId: 'tenant_b', schema: 'tenant_b' },
      () => storage.list(),
    );
    expect(listA.map((i) => i.key)).toEqual(['tenant_a/doc.txt']);
    expect(listB).toEqual([]);

    // tenant_b cannot delete tenant_a's file
    const delB = await TenantContext.run(
      { tenantId: 'tenant_b', schema: 'tenant_b' },
      () => storage.delete('doc.txt'),
    );
    expect(delB).toBe(false);
    expect(fs.existsSync(path.join(tmpDir, 'tenant_a', 'doc.txt'))).toBe(true);

    // tenant_a can delete its own file
    const delA = await TenantContext.run(
      { tenantId: 'tenant_a', schema: 'tenant_a' },
      () => storage.delete('doc.txt'),
    );
    expect(delA).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'tenant_a', 'doc.txt'))).toBe(false);
  });

  it('rejects path traversal and null bytes', () => {
    expect(() => scopeKeyForTenant('../secret.txt', 'tenant_a')).toThrow(
      /path traversal/i,
    );
    expect(() => scopeKeyForTenant('foo/../../bar.txt', 'default')).toThrow(
      /path traversal/i,
    );
    expect(() => scopeKeyForTenant('bad\0name.txt', 'default')).toThrow(
      /null bytes/i,
    );
  });
});
