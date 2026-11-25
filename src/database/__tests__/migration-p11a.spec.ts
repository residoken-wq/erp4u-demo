import { InternalCommsSecurity1795317970000 } from '../migrations/1795317970000-InternalCommsSecurity';

describe('Migration 1795317970000 (InternalCommsSecurity)', () => {
  let migration: InternalCommsSecurity1795317970000;
  let mockQueryRunner: any;
  let queries: { query: string; params?: any[] }[];

  beforeEach(() => {
    migration = new InternalCommsSecurity1795317970000();
    queries = [];
    mockQueryRunner = {
      query: jest.fn(async (q: string, params?: any[]) => {
        queries.push({ query: q, params });
        if (q.includes('FROM "user_groups"')) {
          return [
            { id: 1, name: 'Kinh doanh' },
            { id: 2, name: 'Sản xuất' },
            { id: 3, name: 'Kế toán' },
          ];
        }
        if (q.includes('FROM "announcements"')) {
          return [
            { id: 10, target_departments: 'Kinh doanh, Kế toán' }, // fully matches groups 1 and 3
            { id: 20, target_departments: 'Kinh doanh, Phòng Không Tồn Tại' }, // does not fully match
            { id: 30, target_departments: null }, // empty/null
          ];
        }
        return [];
      }),
      hasColumn: jest.fn(async (table: string, col: string) => {
        return col === 'target_departments';
      }),
    };
  });

  it('runs up migration and maps target_departments to target_group_ids, deactivating unmatched', async () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    await migration.up(mockQueryRunner);

    // Checked sales_comments column additions
    expect(queries.some((q) => q.query.includes('ALTER TABLE "sales_comments" ADD "created_by_user_id"'))).toBe(true);
    expect(queries.some((q) => q.query.includes('ALTER TABLE "sales_comments" ADD "edited_at"'))).toBe(true);

    // Checked announcements target_group_ids addition
    expect(queries.some((q) => q.query.includes('ALTER TABLE "announcements" ADD "target_group_ids"'))).toBe(true);

    // Checked matched update for announcement 10
    const matchedUpdate = queries.find(
      (q) => q.query.includes('UPDATE "announcements" SET "target_group_ids"') && q.params?.[1] === 10,
    );
    expect(matchedUpdate).toBeDefined();
    expect(matchedUpdate?.params?.[0]).toEqual([1, 3]);

    // Checked deactivated update for announcement 20
    const deactivatedUpdate = queries.find(
      (q) => q.query.includes('UPDATE "announcements" SET "is_active" = false') && q.params?.[0] === 20,
    );
    expect(deactivatedUpdate).toBeDefined();

    // Checked target_departments drop
    expect(queries.some((q) => q.query.includes('ALTER TABLE "announcements" DROP COLUMN "target_departments"'))).toBe(true);

    // Checked log output
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('Deactivated 1 announcements due to unmatched target_departments'),
    );

    logSpy.mockRestore();
  });

  it('runs down migration cleanly', async () => {
    await migration.down(mockQueryRunner);

    expect(queries.some((q) => q.query.includes('ALTER TABLE "announcements" ADD "target_departments"'))).toBe(true);
    expect(queries.some((q) => q.query.includes('ALTER TABLE "announcements" DROP COLUMN "target_group_ids"'))).toBe(true);
    expect(queries.some((q) => q.query.includes('ALTER TABLE "sales_comments" DROP COLUMN "edited_at"'))).toBe(true);
    expect(queries.some((q) => q.query.includes('ALTER TABLE "sales_comments" DROP COLUMN "created_by_user_id"'))).toBe(true);
  });
});
