import { MigrationInterface, QueryRunner } from 'typeorm';

export class AiVoiceInputMode1795317960000 implements MigrationInterface {
  name = 'AiVoiceInputMode1795317960000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "ai_conversation_messages" ADD "input_mode" character varying(10) NOT NULL DEFAULT 'text'`,
    );
    await queryRunner.query(
      `ALTER TABLE "ai_conversation_messages" ADD CONSTRAINT "CHK_6be2fa8d0cab5ef93e0a4b1be1" CHECK ("input_mode" IN ('text', 'voice'))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "ai_conversation_messages" DROP CONSTRAINT "CHK_6be2fa8d0cab5ef93e0a4b1be1"`,
    );
    await queryRunner.query(
      `ALTER TABLE "ai_conversation_messages" DROP COLUMN "input_mode"`,
    );
  }
}
