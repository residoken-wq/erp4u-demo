import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class ChatbotSchemaService implements OnModuleInit {
  private readonly logger = new Logger(ChatbotSchemaService.name);

  constructor(private readonly dataSource: DataSource) {}

  async onModuleInit() {
    await this.initSchema();
  }

  async initSchema() {
    const ddlStatements: { name: string; sql: string }[] = [
      // Sequences
      {
        name: 'sequence chatbot_request_seq',
        sql: `CREATE SEQUENCE IF NOT EXISTS chatbot_request_seq START 1;`,
      },
      {
        name: 'sequence chatbot_ticket_seq',
        sql: `CREATE SEQUENCE IF NOT EXISTS chatbot_ticket_seq START 1;`,
      },

      // 1. chatbot_conversations
      {
        name: 'table chatbot_conversations',
        sql: `CREATE TABLE IF NOT EXISTS chatbot_conversations (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          public_code varchar(8) NOT NULL,
          state varchar(24) NOT NULL DEFAULT 'new',
          intent varchar(32) NULL,
          segment varchar(24) NULL,
          human_active boolean NOT NULL DEFAULT false,
          assigned_user_id int NULL,
          customer_id int NULL,
          unread_staff int NOT NULL DEFAULT 0,
          last_message_at timestamptz NULL,
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now(),
          CONSTRAINT uq_chatbot_conversations_public_code UNIQUE (public_code)
        );`,
      },
      {
        name: 'index idx_chatbot_conversations_last_message_at',
        sql: `CREATE INDEX IF NOT EXISTS idx_chatbot_conversations_last_message_at ON chatbot_conversations (last_message_at DESC);`,
      },

      // 2. chatbot_sessions
      {
        name: 'table chatbot_sessions',
        sql: `CREATE TABLE IF NOT EXISTS chatbot_sessions (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          token_hash char(64) NOT NULL,
          conversation_id uuid NOT NULL,
          ip_hash char(64) NOT NULL,
          user_agent varchar(300) NOT NULL,
          analytics_session_id varchar(64) NULL,
          last_seen_at timestamptz NOT NULL,
          revoked_at timestamptz NULL,
          created_at timestamptz NOT NULL DEFAULT now(),
          CONSTRAINT uq_chatbot_sessions_token_hash UNIQUE (token_hash),
          CONSTRAINT fk_chatbot_sessions_conversation FOREIGN KEY (conversation_id) REFERENCES chatbot_conversations(id) ON DELETE CASCADE
        );`,
      },
      {
        name: 'index idx_chatbot_sessions_conversation_id',
        sql: `CREATE INDEX IF NOT EXISTS idx_chatbot_sessions_conversation_id ON chatbot_sessions (conversation_id);`,
      },

      // 3. chatbot_messages
      {
        name: 'table chatbot_messages',
        sql: `CREATE TABLE IF NOT EXISTS chatbot_messages (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          conversation_id uuid NOT NULL,
          role varchar(12) NOT NULL,
          text text NOT NULL,
          payload jsonb NULL,
          source_refs jsonb NULL,
          llm_meta jsonb NULL,
          client_msg_id uuid NULL,
          sender_user_id int NULL,
          created_at timestamptz NOT NULL DEFAULT now(),
          CONSTRAINT fk_chatbot_messages_conversation FOREIGN KEY (conversation_id) REFERENCES chatbot_conversations(id) ON DELETE CASCADE,
          CONSTRAINT uq_chatbot_messages_conv_client_msg UNIQUE (conversation_id, client_msg_id)
        );`,
      },
      {
        name: 'index idx_chatbot_messages_conv_created',
        sql: `CREATE INDEX IF NOT EXISTS idx_chatbot_messages_conv_created ON chatbot_messages (conversation_id, created_at);`,
      },

      // 4. chatbot_briefs
      {
        name: 'table chatbot_briefs',
        sql: `CREATE TABLE IF NOT EXISTS chatbot_briefs (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          conversation_id uuid NOT NULL,
          revision int NOT NULL,
          data jsonb NOT NULL,
          changed_by varchar(24) NOT NULL,
          created_at timestamptz NOT NULL DEFAULT now(),
          CONSTRAINT uq_chatbot_briefs_conv_revision UNIQUE (conversation_id, revision)
        );`,
      },

      // 5. chatbot_consents
      {
        name: 'table chatbot_consents',
        sql: `CREATE TABLE IF NOT EXISTS chatbot_consents (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          conversation_id uuid NOT NULL,
          purpose varchar(16) NOT NULL,
          channel varchar(16) NOT NULL,
          notice_version varchar(16) NOT NULL,
          granted_at timestamptz NOT NULL,
          withdrawn_at timestamptz NULL,
          created_at timestamptz NOT NULL DEFAULT now()
        );`,
      },
      {
        name: 'index idx_chatbot_consents_conversation_id',
        sql: `CREATE INDEX IF NOT EXISTS idx_chatbot_consents_conversation_id ON chatbot_consents (conversation_id);`,
      },

      // 6. chatbot_attachments
      {
        name: 'table chatbot_attachments',
        sql: `CREATE TABLE IF NOT EXISTS chatbot_attachments (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          conversation_id uuid NOT NULL,
          request_id uuid NULL,
          ticket_id uuid NULL,
          original_name varchar(200) NOT NULL,
          detected_mime varchar(40) NOT NULL,
          size_bytes int NOT NULL,
          sha256 char(64) NOT NULL,
          content bytea NOT NULL,
          status varchar(16) NOT NULL DEFAULT 'stored',
          purge_at timestamptz NOT NULL,
          created_at timestamptz NOT NULL DEFAULT now()
        );`,
      },
      {
        name: 'index idx_chatbot_attachments_conversation_id',
        sql: `CREATE INDEX IF NOT EXISTS idx_chatbot_attachments_conversation_id ON chatbot_attachments (conversation_id);`,
      },

      // 7. chatbot_requests
      {
        name: 'table chatbot_requests',
        sql: `CREATE TABLE IF NOT EXISTS chatbot_requests (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          code varchar(20) NOT NULL,
          type varchar(20) NOT NULL,
          conversation_id uuid NOT NULL,
          brief_revision int NULL,
          contact jsonb NOT NULL,
          consent_id uuid NULL,
          status varchar(20) NOT NULL DEFAULT 'received',
          owner_user_id int NULL,
          customer_id int NULL,
          idempotency_key uuid NOT NULL,
          customer_requested_due_at date NULL,
          promised_due_at date NULL,
          internal_note text NULL,
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now(),
          CONSTRAINT uq_chatbot_requests_code UNIQUE (code),
          CONSTRAINT uq_chatbot_requests_idempotency_key UNIQUE (idempotency_key)
        );`,
      },

      // 8. chatbot_tickets
      {
        name: 'table chatbot_tickets',
        sql: `CREATE TABLE IF NOT EXISTS chatbot_tickets (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          code varchar(20) NOT NULL,
          category varchar(32) NOT NULL,
          priority varchar(8) NOT NULL DEFAULT 'normal',
          status varchar(20) NOT NULL DEFAULT 'received',
          conversation_id uuid NOT NULL,
          request_id uuid NULL,
          description text NOT NULL,
          contact jsonb NULL,
          owner_user_id int NULL,
          customer_update text NULL,
          internal_note text NULL,
          idempotency_key uuid NOT NULL,
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now(),
          CONSTRAINT uq_chatbot_tickets_code UNIQUE (code),
          CONSTRAINT uq_chatbot_tickets_idempotency_key UNIQUE (idempotency_key)
        );`,
      },

      // 9. chatbot_outbox
      {
        name: 'table chatbot_outbox',
        sql: `CREATE TABLE IF NOT EXISTS chatbot_outbox (
          id bigserial PRIMARY KEY,
          event varchar(40) NOT NULL,
          payload jsonb NOT NULL,
          status varchar(12) NOT NULL DEFAULT 'pending',
          attempts int NOT NULL DEFAULT 0,
          next_attempt_at timestamptz NOT NULL DEFAULT now(),
          last_error varchar(300) NULL,
          created_at timestamptz NOT NULL DEFAULT now()
        );`,
      },
      {
        name: 'index idx_chatbot_outbox_status_next',
        sql: `CREATE INDEX IF NOT EXISTS idx_chatbot_outbox_status_next ON chatbot_outbox (status, next_attempt_at);`,
      },

      // 10. chatbot_audit_events
      {
        name: 'table chatbot_audit_events',
        sql: `CREATE TABLE IF NOT EXISTS chatbot_audit_events (
          id bigserial PRIMARY KEY,
          actor_type varchar(12) NOT NULL,
          actor_user_id int NULL,
          op varchar(40) NOT NULL,
          object_type varchar(32) NOT NULL,
          object_id varchar(64) NOT NULL,
          before_ref jsonb NULL,
          after_ref jsonb NULL,
          created_at timestamptz NOT NULL DEFAULT now()
        );`,
      },
      {
        name: 'index idx_chatbot_audit_events_object',
        sql: `CREATE INDEX IF NOT EXISTS idx_chatbot_audit_events_object ON chatbot_audit_events (object_type, object_id);`,
      },
    ];

    for (const stmt of ddlStatements) {
      try {
        await this.dataSource.query(stmt.sql);
        this.logger.log(`chatbot schema: ${stmt.name} ok`);
      } catch (err: any) {
        this.logger.error(`chatbot schema: ${stmt.name} fail ${err?.code || err?.message || 'UNKNOWN'}`);
      }
    }
  }
}
