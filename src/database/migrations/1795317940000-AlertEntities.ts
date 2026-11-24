import { MigrationInterface, QueryRunner } from 'typeorm';

export class AlertEntities1795317940000 implements MigrationInterface {
  name = 'AlertEntities1795317940000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "alerts" (` +
        `"id" uuid NOT NULL DEFAULT uuid_generate_v4(), ` +
        `"type" character varying(50) NOT NULL, ` +
        `"severity" character varying(20) NOT NULL, ` +
        `"entity_type" character varying(50) NOT NULL, ` +
        `"entity_id" character varying(100) NOT NULL, ` +
        `"fingerprint" character varying(255) NOT NULL, ` +
        `"title" character varying(255) NOT NULL, ` +
        `"detail" jsonb NOT NULL DEFAULT '{}', ` +
        `"status" character varying(20) NOT NULL DEFAULT 'open', ` +
        `"snoozed_until" TIMESTAMP WITH TIME ZONE, ` +
        `"acknowledged_by" integer, ` +
        `"first_seen_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), ` +
        `"last_seen_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), ` +
        `"resolved_at" TIMESTAMP WITH TIME ZONE, ` +
        `"created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), ` +
        `"updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), ` +
        `CONSTRAINT "UQ_e882cf52bf0ff3759438cd030e6" UNIQUE ("fingerprint"), ` +
        `CONSTRAINT "CHK_2c5a9c44447a868d3684105afa" CHECK ("status" IN ('open', 'acknowledged', 'snoozed', 'resolved')), ` +
        `CONSTRAINT "CHK_ec6b87464a426d55605dc8e459" CHECK ("severity" IN ('low', 'medium', 'high')), ` +
        `CONSTRAINT "PK_60f895662df096bfcdfab7f4b96" PRIMARY KEY ("id")` +
      `)`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_6822a26b2b821ef939b82fd0d0" ON "alerts" ("status", "type")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_50c7fbb63e3334255f7137899e" ON "alerts" ("last_seen_at")`,
    );

    await queryRunner.query(
      `ALTER TABLE "alerts" ADD CONSTRAINT "FK_70e5404e97a308f93a591991dbd" FOREIGN KEY ("acknowledged_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `CREATE TABLE "alert_settings" (` +
        `"type" character varying(50) NOT NULL, ` +
        `"enabled" boolean NOT NULL DEFAULT true, ` +
        `"params" jsonb NOT NULL DEFAULT '{}', ` +
        `"updated_by" integer, ` +
        `"updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), ` +
        `CONSTRAINT "PK_9170ab42315f13d035a1794d003" PRIMARY KEY ("type")` +
      `)`,
    );

    await queryRunner.query(
      `ALTER TABLE "alert_settings" ADD CONSTRAINT "FK_9c4e3c98dc8427413621cc27fde" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `CREATE TABLE "alert_user_prefs" (` +
        `"user_id" integer NOT NULL, ` +
        `"type" character varying(50) NOT NULL, ` +
        `"in_app" boolean NOT NULL DEFAULT true, ` +
        `"email_digest" boolean NOT NULL DEFAULT false, ` +
        `CONSTRAINT "PK_bd5505d69d761712dbf354fe5a2" PRIMARY KEY ("user_id", "type")` +
      `)`,
    );

    await queryRunner.query(
      `ALTER TABLE "alert_user_prefs" ADD CONSTRAINT "FK_45b3277bf81a11d5798eb443d05" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `CREATE TABLE "alert_runs" (` +
        `"id" uuid NOT NULL DEFAULT uuid_generate_v4(), ` +
        `"started_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), ` +
        `"finished_at" TIMESTAMP WITH TIME ZONE, ` +
        `"status" character varying(20) NOT NULL DEFAULT 'running', ` +
        `"counts" jsonb, ` +
        `"error_code" character varying(50), ` +
        `CONSTRAINT "PK_162c10a4d2785a7d7e3d8004183" PRIMARY KEY ("id")` +
      `)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "alert_runs"`);

    await queryRunner.query(
      `ALTER TABLE "alert_user_prefs" DROP CONSTRAINT "FK_45b3277bf81a11d5798eb443d05"`,
    );
    await queryRunner.query(`DROP TABLE "alert_user_prefs"`);

    await queryRunner.query(
      `ALTER TABLE "alert_settings" DROP CONSTRAINT "FK_9c4e3c98dc8427413621cc27fde"`,
    );
    await queryRunner.query(`DROP TABLE "alert_settings"`);

    await queryRunner.query(
      `ALTER TABLE "alerts" DROP CONSTRAINT "FK_70e5404e97a308f93a591991dbd"`,
    );
    await queryRunner.query(`DROP INDEX "IDX_50c7fbb63e3334255f7137899e"`);
    await queryRunner.query(`DROP INDEX "IDX_6822a26b2b821ef939b82fd0d0"`);
    await queryRunner.query(`DROP TABLE "alerts"`);
  }
}
