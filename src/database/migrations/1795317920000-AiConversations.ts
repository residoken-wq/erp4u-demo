import { MigrationInterface, QueryRunner } from "typeorm";

export class AiConversations1795317920000 implements MigrationInterface {
  name = "AiConversations1795317920000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "ai_conversations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" integer NOT NULL, "title" character varying(200) NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_ai_conversations" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ai_conversations_user_updated" ON "ai_conversations" ("user_id", "updated_at" DESC)`,
    );
    await queryRunner.query(
      `ALTER TABLE "ai_conversations" ADD CONSTRAINT "FK_ai_conversations_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `CREATE TABLE "ai_conversation_messages" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "conversation_id" uuid NOT NULL, "role" character varying(20) NOT NULL, "content" text NOT NULL, "tool_steps" jsonb, "sources" jsonb, "audit_log_id" uuid, "error_code" character varying(50), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "CHK_ai_conversation_messages_role" CHECK ("role" IN ('user', 'assistant')), CONSTRAINT "PK_ai_conversation_messages" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ai_conversation_messages_conv_created" ON "ai_conversation_messages" ("conversation_id", "created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ai_conversation_messages_created" ON "ai_conversation_messages" ("created_at")`,
    );
    await queryRunner.query(
      `ALTER TABLE "ai_conversation_messages" ADD CONSTRAINT "FK_ai_conversation_messages_conv" FOREIGN KEY ("conversation_id") REFERENCES "ai_conversations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "ai_conversation_messages" ADD CONSTRAINT "FK_ai_conversation_messages_audit" FOREIGN KEY ("audit_log_id") REFERENCES "ai_audit_log"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "ai_conversation_messages" DROP CONSTRAINT "FK_ai_conversation_messages_audit"`,
    );
    await queryRunner.query(
      `ALTER TABLE "ai_conversation_messages" DROP CONSTRAINT "FK_ai_conversation_messages_conv"`,
    );
    await queryRunner.query(`DROP INDEX "IDX_ai_conversation_messages_created"`);
    await queryRunner.query(`DROP INDEX "IDX_ai_conversation_messages_conv_created"`);
    await queryRunner.query(`DROP TABLE "ai_conversation_messages"`);
    await queryRunner.query(
      `ALTER TABLE "ai_conversations" DROP CONSTRAINT "FK_ai_conversations_user"`,
    );
    await queryRunner.query(`DROP INDEX "IDX_ai_conversations_user_updated"`);
    await queryRunner.query(`DROP TABLE "ai_conversations"`);
  }
}
