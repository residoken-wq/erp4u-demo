import { MigrationInterface, QueryRunner } from 'typeorm';

export class ProjectsPermissionModule1795317980000 implements MigrationInterface {
  name = 'ProjectsPermissionModule1795317980000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Sao chep quyen SALES sang PROJECTS cho cac nhom chua co dong PROJECTS
    await queryRunner.query(`
      INSERT INTO "group_permissions" ("module_code", "can_view", "can_create", "can_update", "can_delete", "view_cost_price", "group_id")
      SELECT 'PROJECTS', gp.can_view, gp.can_create, gp.can_update, gp.can_delete, gp.view_cost_price, gp.group_id
      FROM "group_permissions" gp
      WHERE gp.module_code = 'SALES'
      AND NOT EXISTS (
        SELECT 1 FROM "group_permissions" p
        WHERE p.group_id = gp.group_id AND p.module_code = 'PROJECTS'
      );
    `);

    // 2. Nhom khong co SALES -> dong PROJECTS toan false
    await queryRunner.query(`
      INSERT INTO "group_permissions" ("module_code", "can_view", "can_create", "can_update", "can_delete", "view_cost_price", "group_id")
      SELECT 'PROJECTS', false, false, false, false, false, ug.id
      FROM "user_groups" ug
      WHERE NOT EXISTS (
        SELECT 1 FROM "group_permissions" p
        WHERE p.group_id = ug.id AND p.module_code = 'PROJECTS'
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Xoa dong PROJECTS cua schema hien hanh
    await queryRunner.query(
      `DELETE FROM "group_permissions" WHERE module_code = 'PROJECTS'`,
    );
  }
}
