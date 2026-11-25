import { MigrationInterface, QueryRunner } from 'typeorm';

export class InternalCommsSecurity1795317970000 implements MigrationInterface {
  name = 'InternalCommsSecurity1795317970000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. sales_comments: add created_by_user_id, edited_at
    await queryRunner.query(
      `ALTER TABLE "sales_comments" ADD "created_by_user_id" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_comments" ADD "edited_at" TIMESTAMP`,
    );

    // 2. announcements: add target_group_ids integer[]
    await queryRunner.query(
      `ALTER TABLE "announcements" ADD "target_group_ids" integer[]`,
    );

    // 3. Migrate target_departments -> target_group_ids
    const colCheck = await queryRunner.query(
      `SELECT column_name FROM information_schema.columns 
       WHERE table_name = 'announcements' 
         AND column_name = 'target_departments' 
         AND table_schema = ANY(current_schemas(false))`,
    );
    const hasTargetDepartments = colCheck && colCheck.length > 0;
    if (hasTargetDepartments) {
      let groups: { id: number; name: string }[] = [];
      try {
        groups = await queryRunner.query(`SELECT id, name FROM "user_groups"`);
      } catch (err) {
        groups = [];
      }

      const groupMap = new Map<string, number>();
      for (const g of groups) {
        if (g.name) {
          groupMap.set(g.name.trim().toLowerCase(), g.id);
        }
      }

      const announcements: {
        id: number;
        target_departments: string | null;
      }[] = await queryRunner.query(
        `SELECT id, target_departments FROM "announcements"`,
      );

      let deactivatedCount = 0;
      for (const ann of announcements) {
        const raw = (ann.target_departments || '').trim();
        if (!raw) {
          continue;
        }

        const depts = raw
          .split(',')
          .map((d) => d.trim())
          .filter(Boolean);
        const matchedIds: number[] = [];
        let allMatched = true;

        for (const dept of depts) {
          const groupId = groupMap.get(dept.toLowerCase());
          if (groupId !== undefined) {
            matchedIds.push(groupId);
          } else {
            allMatched = false;
          }
        }

        if (allMatched && matchedIds.length > 0) {
          await queryRunner.query(
            `UPDATE "announcements" SET "target_group_ids" = $1 WHERE id = $2`,
            [matchedIds, ann.id],
          );
        } else {
          // Deactivate record if not all target departments matched
          await queryRunner.query(
            `UPDATE "announcements" SET "is_active" = false WHERE id = $1`,
            [ann.id],
          );
          deactivatedCount++;
        }
      }

      console.log(
        `[Migration 1795317970000] Deactivated ${deactivatedCount} announcements due to unmatched target_departments`,
      );

      await queryRunner.query(
        `ALTER TABLE "announcements" DROP COLUMN "target_departments"`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "announcements" ADD "target_departments" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "announcements" DROP COLUMN "target_group_ids"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_comments" DROP COLUMN "edited_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_comments" DROP COLUMN "created_by_user_id"`,
    );
  }
}
