import { MigrationInterface, QueryRunner } from "typeorm";

export class AiAuditLogAndDrafts1795317912602 implements MigrationInterface {
  name = "AiAuditLogAndDrafts1795317912602";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "ai_audit_log" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" integer, "feature" character varying(50) NOT NULL, "provider" character varying(30) NOT NULL, "model" character varying(100), "input_tokens" integer NOT NULL DEFAULT '0', "output_tokens" integer NOT NULL DEFAULT '0', "units" numeric(12,2) NOT NULL DEFAULT '0', "latency_ms" integer, "status" character varying(20) NOT NULL, "error_code" character varying(50), "prompt_redacted" text, "response_redacted" text, "tool_calls" jsonb, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_1edb3b612289b6a3cb04edb4039" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_1f0a7c22a2d50328d9ff24c006" ON "ai_audit_log" ("user_id", "created_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_6896f62d41a58f5c5d64a0d6f1" ON "ai_audit_log" ("created_at") `,
    );
    await queryRunner.query(
      `CREATE TABLE "ai_drafts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "kind" character varying(50) NOT NULL, "payload" jsonb NOT NULL, "status" character varying(20) NOT NULL DEFAULT 'pending', "created_by" integer NOT NULL, "confirmed_by" integer, "confirmed_at" TIMESTAMP WITH TIME ZONE, "result_ref" jsonb, "audit_log_id" uuid, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "CHK_816780c14d89e6f3a309a2195a" CHECK ("status" IN ('pending', 'confirmed', 'rejected', 'expired')), CONSTRAINT "PK_a83622f0d6fd52872e9585de51f" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_54eb02dd3bcc01786ea7538c21" ON "ai_drafts" ("status", "expires_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_0e180bef5df94edf55bb7e7f68" ON "ai_drafts" ("created_by", "status") `,
    );
    await queryRunner.query(
      `ALTER TABLE "ai_audit_log" ADD CONSTRAINT "FK_6a31119561b00b696dda48ac2fd" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "ai_drafts" ADD CONSTRAINT "FK_991592bc3c8f7ba733fc9902274" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "ai_drafts" ADD CONSTRAINT "FK_88d28fdf9f6176f4b9c9a0ebdfa" FOREIGN KEY ("confirmed_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "ai_drafts" ADD CONSTRAINT "FK_246b55a7fcd306644a96dea1f80" FOREIGN KEY ("audit_log_id") REFERENCES "ai_audit_log"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "ai_drafts" DROP CONSTRAINT "FK_246b55a7fcd306644a96dea1f80"`,
    );
    await queryRunner.query(
      `ALTER TABLE "ai_drafts" DROP CONSTRAINT "FK_88d28fdf9f6176f4b9c9a0ebdfa"`,
    );
    await queryRunner.query(
      `ALTER TABLE "ai_drafts" DROP CONSTRAINT "FK_991592bc3c8f7ba733fc9902274"`,
    );
    await queryRunner.query(
      `ALTER TABLE "ai_audit_log" DROP CONSTRAINT "FK_6a31119561b00b696dda48ac2fd"`,
    );
    await queryRunner.query(`DROP INDEX "IDX_0e180bef5df94edf55bb7e7f68"`);
    await queryRunner.query(`DROP INDEX "IDX_54eb02dd3bcc01786ea7538c21"`);
    await queryRunner.query(`DROP TABLE "ai_drafts"`);
    await queryRunner.query(`DROP INDEX "IDX_6896f62d41a58f5c5d64a0d6f1"`);
    await queryRunner.query(`DROP INDEX "IDX_1f0a7c22a2d50328d9ff24c006"`);
    await queryRunner.query(`DROP TABLE "ai_audit_log"`);
  }
}
