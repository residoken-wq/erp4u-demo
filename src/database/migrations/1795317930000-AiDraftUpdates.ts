import { MigrationInterface, QueryRunner } from 'typeorm';

export class AiDraftUpdates1795317930000 implements MigrationInterface {
  name = 'AiDraftUpdates1795317930000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "ai_drafts" DROP CONSTRAINT "CHK_816780c14d89e6f3a309a2195a"`,
    );
    await queryRunner.query(
      `ALTER TABLE "ai_drafts" ADD "error_code" character varying(50)`,
    );
    await queryRunner.query(
      `ALTER TABLE "ai_drafts" ADD CONSTRAINT "CHK_e0b8492f9d7f0aba16d4b9b0e6" CHECK ("status" IN ('pending', 'confirmed', 'rejected', 'expired', 'executing', 'failed'))`,
    );
    await queryRunner.query(
      `ALTER TABLE "ai_conversation_messages" ADD "drafts" jsonb`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "ai_conversation_messages" DROP COLUMN "drafts"`,
    );
    await queryRunner.query(
      `ALTER TABLE "ai_drafts" DROP CONSTRAINT "CHK_e0b8492f9d7f0aba16d4b9b0e6"`,
    );
    await queryRunner.query(
      `ALTER TABLE "ai_drafts" DROP COLUMN "error_code"`,
    );
    await queryRunner.query(
      `ALTER TABLE "ai_drafts" ADD CONSTRAINT "CHK_816780c14d89e6f3a309a2195a" CHECK ("status" IN ('pending', 'confirmed', 'rejected', 'expired'))`,
    );
  }
}
