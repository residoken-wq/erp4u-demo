import { InternalCommsUx1795317990000 } from '../migrations/1795317990000-InternalCommsUx';

describe('Migration 1795317990000 (InternalCommsUx)', () => {
  let migration: InternalCommsUx1795317990000;
  let mockQueryRunner: any;
  let queries: { query: string; params?: any[] }[];

  beforeEach(() => {
    migration = new InternalCommsUx1795317990000();
    queries = [];
    mockQueryRunner = {
      query: jest.fn(async (q: string, params?: any[]) => {
        queries.push({ query: q, params });
        return [];
      }),
    };
  });

  it('runs up migration cleanly', async () => {
    await migration.up(mockQueryRunner);

    // Drop is_reviewed
    expect(queries.some((q) => q.query.includes('DROP COLUMN IF EXISTS "is_reviewed"'))).toBe(true);

    // Add edited_at to discussions and discussion_comments
    expect(queries.some((q) => q.query.includes('ALTER TABLE "discussions" ADD "edited_at"'))).toBe(true);
    expect(queries.some((q) => q.query.includes('ALTER TABLE "discussion_comments" ADD "edited_at"'))).toBe(true);

    // Migrate ANNOUNCEMENT type to GENERAL
    expect(queries.some((q) => q.query.includes('UPDATE "discussions" SET "type" = \'GENERAL\' WHERE "type" = \'ANNOUNCEMENT\''))).toBe(true);

    // Create discussion_reads table
    expect(queries.some((q) => q.query.includes('CREATE TABLE "discussion_reads"'))).toBe(true);
    expect(queries.some((q) => q.query.includes('FK_fdcaebf1c2c834208ace4513525'))).toBe(true);
    expect(queries.some((q) => q.query.includes('FK_6ca522300e1c2eba3dae71de0f3'))).toBe(true);

    // Update legacy notification links
    expect(queries.some((q) => q.query.includes('UPDATE "notifications" SET "link"') && q.query.includes('/workspace/discussions/'))).toBe(true);
  });

  it('runs down migration cleanly', async () => {
    await migration.down(mockQueryRunner);

    // Drop discussion_reads
    expect(queries.some((q) => q.query.includes('DROP TABLE "discussion_reads"'))).toBe(true);

    // Drop edited_at
    expect(queries.some((q) => q.query.includes('ALTER TABLE "discussion_comments" DROP COLUMN "edited_at"'))).toBe(true);
    expect(queries.some((q) => q.query.includes('ALTER TABLE "discussions" DROP COLUMN "edited_at"'))).toBe(true);

    // Restore is_reviewed
    expect(queries.some((q) => q.query.includes('ALTER TABLE "discussions" ADD "is_reviewed"'))).toBe(true);
  });
});
