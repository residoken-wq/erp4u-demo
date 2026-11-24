import { MigrationInterface, QueryRunner } from 'typeorm';

export class AiDocumentScans1795317950000 implements MigrationInterface {
  name = 'AiDocumentScans1795317950000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "ai_document_scans" (` +
        `"id" uuid NOT NULL DEFAULT uuid_generate_v4(), ` +
        `"kind" character varying(50) NOT NULL, ` +
        `"source" character varying(20) NOT NULL, ` +
        `"status" character varying(20) NOT NULL DEFAULT 'processing', ` +
        `"file_key" character varying(255) NOT NULL, ` +
        `"mime" character varying(100) NOT NULL, ` +
        `"size_bytes" integer NOT NULL, ` +
        `"page_count" integer NOT NULL DEFAULT '1', ` +
        `"sha256" character varying(64) NOT NULL, ` +
        `"extracted" jsonb, ` +
        `"field_confidence" jsonb, ` +
        `"warnings" jsonb, ` +
        `"error_code" character varying(50), ` +
        `"result_type" character varying(50), ` +
        `"result_id" character varying(100), ` +
        `"created_by" integer, ` +
        `"created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), ` +
        `"expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, ` +
        `CONSTRAINT "CHK_debafff9c027833cfde914069c" CHECK ("status" IN ('processing', 'ready', 'failed', 'linked')), ` +
        `CONSTRAINT "CHK_6288c832f788692dfefa1c6060" CHECK ("source" IN ('xml', 'image', 'pdf')), ` +
        `CONSTRAINT "CHK_abe174e1a2f9ab80a8a7be0aa7" CHECK ("kind" IN ('supplier_quote', 'delivery_note', 'expense_invoice')), ` +
        `CONSTRAINT "PK_786c4f10bc76aa4375c59cc0293" PRIMARY KEY ("id")` +
      `)`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_05b8d235905b0c577b04d14dff" ON "ai_document_scans" ("created_by", "created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_2cd20c8a1f69c3a208e2cd0146" ON "ai_document_scans" ("result_type", "result_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_fd1c42c57b26aac2a01741c477" ON "ai_document_scans" ("expires_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_e08372945e07d3aecbcf795c35" ON "ai_document_scans" ("sha256")`,
    );

    await queryRunner.query(
      `ALTER TABLE "ai_document_scans" ADD CONSTRAINT "FK_06880f061b7eab58e7dfd2a4c9b" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "ai_document_scans" DROP CONSTRAINT "FK_06880f061b7eab58e7dfd2a4c9b"`,
    );
    await queryRunner.query(`DROP INDEX "IDX_e08372945e07d3aecbcf795c35"`);
    await queryRunner.query(`DROP INDEX "IDX_fd1c42c57b26aac2a01741c477"`);
    await queryRunner.query(`DROP INDEX "IDX_2cd20c8a1f69c3a208e2cd0146"`);
    await queryRunner.query(`DROP INDEX "IDX_05b8d235905b0c577b04d14dff"`);
    await queryRunner.query(`DROP TABLE "ai_document_scans"`);
  }
}
