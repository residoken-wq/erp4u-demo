import { MigrationInterface, QueryRunner } from 'typeorm';

export class InternalCommsUx1795317990000 implements MigrationInterface {
  name = 'InternalCommsUx1795317990000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Drop is_reviewed from discussions
    await queryRunner.query(
      `ALTER TABLE "discussions" DROP COLUMN IF EXISTS "is_reviewed"`,
    );

    // 2. Add edited_at to discussions
    await queryRunner.query(
      `ALTER TABLE "discussions" ADD "edited_at" TIMESTAMP`,
    );

    // 3. Add edited_at to discussion_comments
    await queryRunner.query(
      `ALTER TABLE "discussion_comments" ADD "edited_at" TIMESTAMP`,
    );

    // 4. Update legacy ANNOUNCEMENT discussions to GENERAL
    await queryRunner.query(
      `UPDATE "discussions" SET "type" = 'GENERAL' WHERE "type" = 'ANNOUNCEMENT'`,
    );

    // 5. Create table discussion_reads
    await queryRunner.query(
      `CREATE TABLE "discussion_reads" ("id" SERIAL NOT NULL, "discussion_id" integer NOT NULL, "user_id" integer NOT NULL, "last_read_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_7f67553957ebe4fe64693e91374" UNIQUE ("discussion_id", "user_id"), CONSTRAINT "PK_e913c6e125bed646337294b65a5" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_fdcaebf1c2c834208ace451352" ON "discussion_reads" ("discussion_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_6ca522300e1c2eba3dae71de0f" ON "discussion_reads" ("user_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "discussion_reads" ADD CONSTRAINT "FK_fdcaebf1c2c834208ace4513525" FOREIGN KEY ("discussion_id") REFERENCES "discussions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "discussion_reads" ADD CONSTRAINT "FK_6ca522300e1c2eba3dae71de0f3" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    // 6. Fix legacy notification links from /discussions?id=N to /workspace/discussions/N
    await queryRunner.query(
      `UPDATE "notifications" SET "link" = regexp_replace("link", '^/discussions\\?id=([0-9]+)', '/workspace/discussions/\\1') WHERE "link" LIKE '/discussions?id=%'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 1. Revert notification links
    await queryRunner.query(
      `UPDATE "notifications" SET "link" = regexp_replace("link", '^/workspace/discussions/([0-9]+)', '/discussions?id=\\1') WHERE "link" LIKE '/workspace/discussions/%'`,
    );

    // 2. Drop table discussion_reads
    await queryRunner.query(
      `ALTER TABLE "discussion_reads" DROP CONSTRAINT "FK_6ca522300e1c2eba3dae71de0f3"`,
    );
    await queryRunner.query(
      `ALTER TABLE "discussion_reads" DROP CONSTRAINT "FK_fdcaebf1c2c834208ace4513525"`,
    );
    await queryRunner.query(`DROP INDEX "IDX_6ca522300e1c2eba3dae71de0f"`);
    await queryRunner.query(`DROP INDEX "IDX_fdcaebf1c2c834208ace451352"`);
    await queryRunner.query(`DROP TABLE "discussion_reads"`);

    // 3. Drop edited_at from discussion_comments
    await queryRunner.query(
      `ALTER TABLE "discussion_comments" DROP COLUMN "edited_at"`,
    );

    // 4. Drop edited_at from discussions
    await queryRunner.query(
      `ALTER TABLE "discussions" DROP COLUMN "edited_at"`,
    );

    // 5. Restore is_reviewed on discussions
    await queryRunner.query(
      `ALTER TABLE "discussions" ADD "is_reviewed" boolean NOT NULL DEFAULT false`,
    );
  }
}
