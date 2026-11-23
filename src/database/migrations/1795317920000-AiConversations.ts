import { MigrationInterface, QueryRunner } from "typeorm";

export class AiConversations1795317920000 implements MigrationInterface {
  name = "AiConversations1795317920000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "ai_conversations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" integer NOT NULL, "title" character varying(200) NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_60db12765b82858ba00c8aa4ae2" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_8411e13be3bac6d57f91d630b1" ON "ai_conversations" ("user_id", "updated_at" DESC) `,
    );
    await queryRunner.query(
      `ALTER TABLE "ai_conversations" ADD CONSTRAINT "FK_12fdbf99ca0da93085d61edd3bb" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `CREATE TABLE "ai_conversation_messages" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "conversation_id" uuid NOT NULL, "role" character varying(20) NOT NULL, "content" text NOT NULL, "tool_steps" jsonb, "sources" jsonb, "audit_log_id" uuid, "error_code" character varying(50), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "CHK_5131654e16111e82314dcea072" CHECK ("role" IN ('user', 'assistant')), CONSTRAINT "PK_ff230e9ba9eecf7f23be22920ae" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_13ea192555c0f5a9f59ffb3e95" ON "ai_conversation_messages" ("conversation_id", "created_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_d2aa36fecb3b12a8a021eef097" ON "ai_conversation_messages" ("created_at") `,
    );
    await queryRunner.query(
      `ALTER TABLE "ai_conversation_messages" ADD CONSTRAINT "FK_f4e707d653504a28c94c12120f7" FOREIGN KEY ("conversation_id") REFERENCES "ai_conversations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "ai_conversation_messages" ADD CONSTRAINT "FK_827f3e06f6ff1c418134f1ca980" FOREIGN KEY ("audit_log_id") REFERENCES "ai_audit_log"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "ai_conversation_messages" DROP CONSTRAINT "FK_827f3e06f6ff1c418134f1ca980"`,
    );
    await queryRunner.query(
      `ALTER TABLE "ai_conversation_messages" DROP CONSTRAINT "FK_f4e707d653504a28c94c12120f7"`,
    );
    await queryRunner.query(`DROP INDEX "IDX_d2aa36fecb3b12a8a021eef097"`);
    await queryRunner.query(`DROP INDEX "IDX_13ea192555c0f5a9f59ffb3e95"`);
    await queryRunner.query(`DROP TABLE "ai_conversation_messages"`);
    await queryRunner.query(
      `ALTER TABLE "ai_conversations" DROP CONSTRAINT "FK_12fdbf99ca0da93085d61edd3bb"`,
    );
    await queryRunner.query(`DROP INDEX "IDX_8411e13be3bac6d57f91d630b1"`);
    await queryRunner.query(`DROP TABLE "ai_conversations"`);
  }
}
