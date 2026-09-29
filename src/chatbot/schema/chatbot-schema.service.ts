import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class ChatbotSchemaService implements OnModuleInit {
  private readonly logger = new Logger(ChatbotSchemaService.name);
  private initPromise: Promise<void> | null = null;

  constructor(private readonly dataSource: DataSource) {}

  async onModuleInit() {
    try {
      await this.initSchema();
    } catch (err: any) {
      this.logger.error(`Chatbot schema init failed: ${err?.message}`);
    }
  }

  async initSchema(): Promise<void> {
    if (this.initPromise) {
      return this.initPromise;
    }
    this.initPromise = this.executeInitSchema();
    return this.initPromise;
  }

  private async executeInitSchema(): Promise<void> {
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
          summary text NULL,
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
          channel varchar(12) NULL,
          ref_id varchar(64) NULL,
          created_at timestamptz NOT NULL DEFAULT now()
        );`,
      },
      {
        name: 'index idx_chatbot_outbox_status_next',
        sql: `CREATE INDEX IF NOT EXISTS idx_chatbot_outbox_status_next ON chatbot_outbox (status, next_attempt_at);`,
      },
      {
        name: 'alter chatbot_outbox add channel',
        sql: `ALTER TABLE chatbot_outbox ADD COLUMN IF NOT EXISTS channel varchar(12);`,
      },
      {
        name: 'alter chatbot_outbox add ref_id',
        sql: `ALTER TABLE chatbot_outbox ADD COLUMN IF NOT EXISTS ref_id varchar(64);`,
      },
      {
        name: 'alter chatbot_requests add summary',
        sql: `ALTER TABLE chatbot_requests ADD COLUMN IF NOT EXISTS summary text;`,
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

      // 11. chatbot_knowledge_items
      {
        name: 'table chatbot_knowledge_items',
        sql: `CREATE TABLE IF NOT EXISTS chatbot_knowledge_items (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          item_key uuid NOT NULL DEFAULT gen_random_uuid(),
          version int NOT NULL DEFAULT 1,
          status varchar(16) NOT NULL DEFAULT 'draft',
          topic varchar(80) NOT NULL,
          source_refs jsonb NOT NULL DEFAULT '[]',
          conflict_code varchar(4) NULL,
          effective_from date NULL,
          effective_to date NULL,
          author_id int NULL,
          approver_id int NULL,
          approved_at timestamptz NULL,
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now(),
          intent varchar(32) NULL,
          question text NULL,
          answer text NOT NULL,
          product_sku varchar(100) NULL,
          public_allowed boolean NOT NULL DEFAULT false,
          search_text text NOT NULL,
          seed_key varchar(80) NULL,
          CONSTRAINT uq_chatbot_knowledge_items_key_version UNIQUE (item_key, version)
        );`,
      },
      {
        name: 'alter table chatbot_knowledge_items add seed_key',
        sql: `ALTER TABLE chatbot_knowledge_items ADD COLUMN IF NOT EXISTS seed_key varchar(80) NULL;`,
      },
      {
        name: 'index uq_chatbot_knowledge_items_published',
        sql: `CREATE UNIQUE INDEX IF NOT EXISTS uq_chatbot_knowledge_items_published ON chatbot_knowledge_items (item_key) WHERE status = 'published';`,
      },
      {
        name: 'index idx_chatbot_knowledge_items_seed_key',
        sql: `CREATE UNIQUE INDEX IF NOT EXISTS idx_chatbot_knowledge_items_seed_key ON chatbot_knowledge_items (seed_key) WHERE seed_key IS NOT NULL;`,
      },
      {
        name: 'index idx_chatbot_knowledge_items_topic',
        sql: `CREATE INDEX IF NOT EXISTS idx_chatbot_knowledge_items_topic ON chatbot_knowledge_items (topic);`,
      },
      {
        name: 'index idx_chatbot_knowledge_items_search',
        sql: `CREATE INDEX IF NOT EXISTS idx_chatbot_knowledge_items_search ON chatbot_knowledge_items USING gin (to_tsvector('simple', search_text));`,
      },

      // 12. chatbot_product_facts
      {
        name: 'table chatbot_product_facts',
        sql: `CREATE TABLE IF NOT EXISTS chatbot_product_facts (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          item_key uuid NOT NULL DEFAULT gen_random_uuid(),
          version int NOT NULL DEFAULT 1,
          status varchar(16) NOT NULL DEFAULT 'draft',
          topic varchar(80) NOT NULL,
          source_refs jsonb NOT NULL DEFAULT '[]',
          conflict_code varchar(4) NULL,
          effective_from date NULL,
          effective_to date NULL,
          author_id int NULL,
          approver_id int NULL,
          approved_at timestamptz NULL,
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now(),
          sku varchar(100) NOT NULL,
          fact_key varchar(32) NOT NULL,
          value text NOT NULL,
          unit varchar(16) NULL,
          CONSTRAINT uq_chatbot_product_facts_key_version UNIQUE (item_key, version)
        );`,
      },
      {
        name: 'index uq_chatbot_product_facts_published',
        sql: `CREATE UNIQUE INDEX IF NOT EXISTS uq_chatbot_product_facts_published ON chatbot_product_facts (item_key) WHERE status = 'published';`,
      },
      {
        name: 'index idx_chatbot_product_facts_sku',
        sql: `CREATE INDEX IF NOT EXISTS idx_chatbot_product_facts_sku ON chatbot_product_facts (sku);`,
      },

      // 13. chatbot_bundles
      {
        name: 'table chatbot_bundles',
        sql: `CREATE TABLE IF NOT EXISTS chatbot_bundles (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          item_key uuid NOT NULL DEFAULT gen_random_uuid(),
          version int NOT NULL DEFAULT 1,
          status varchar(16) NOT NULL DEFAULT 'draft',
          topic varchar(80) NOT NULL,
          source_refs jsonb NOT NULL DEFAULT '[]',
          conflict_code varchar(4) NULL,
          effective_from date NULL,
          effective_to date NULL,
          author_id int NULL,
          approver_id int NULL,
          approved_at timestamptz NULL,
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now(),
          code varchar(40) NOT NULL,
          name varchar(200) NOT NULL,
          items jsonb NOT NULL,
          CONSTRAINT uq_chatbot_bundles_key_version UNIQUE (item_key, version)
        );`,
      },
      {
        name: 'index uq_chatbot_bundles_published',
        sql: `CREATE UNIQUE INDEX IF NOT EXISTS uq_chatbot_bundles_published ON chatbot_bundles (item_key) WHERE status = 'published';`,
      },
      {
        name: 'index idx_chatbot_bundles_code',
        sql: `CREATE INDEX IF NOT EXISTS idx_chatbot_bundles_code ON chatbot_bundles (code);`,
      },

      // 14. chatbot_price_rules
      {
        name: 'table chatbot_price_rules',
        sql: `CREATE TABLE IF NOT EXISTS chatbot_price_rules (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          item_key uuid NOT NULL DEFAULT gen_random_uuid(),
          version int NOT NULL DEFAULT 1,
          status varchar(16) NOT NULL DEFAULT 'draft',
          topic varchar(80) NOT NULL,
          source_refs jsonb NOT NULL DEFAULT '[]',
          conflict_code varchar(4) NULL,
          effective_from date NULL,
          effective_to date NULL,
          author_id int NULL,
          approver_id int NULL,
          approved_at timestamptz NULL,
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now(),
          target_type varchar(12) NOT NULL,
          target_code varchar(100) NOT NULL,
          fabric varchar(40) NULL,
          qty_min int NOT NULL,
          qty_max int NULL,
          qty_scope varchar(12) NOT NULL,
          unit_price bigint NOT NULL,
          currency varchar(3) NOT NULL DEFAULT 'VND',
          tax_rate numeric(5,2) NULL,
          tax_included boolean NOT NULL,
          shipping_included boolean NOT NULL DEFAULT false,
          included_services jsonb NOT NULL DEFAULT '[]',
          excluded_services jsonb NOT NULL DEFAULT '[]',
          customer_scope varchar(40) NOT NULL DEFAULT 'PUBLIC',
          is_fixture boolean NOT NULL DEFAULT false,
          CONSTRAINT uq_chatbot_price_rules_key_version UNIQUE (item_key, version)
        );`,
      },
      {
        name: 'index uq_chatbot_price_rules_published',
        sql: `CREATE UNIQUE INDEX IF NOT EXISTS uq_chatbot_price_rules_published ON chatbot_price_rules (item_key) WHERE status = 'published';`,
      },
      {
        name: 'index idx_chatbot_price_rules_target',
        sql: `CREATE INDEX IF NOT EXISTS idx_chatbot_price_rules_target ON chatbot_price_rules (target_type, target_code);`,
      },

      // 15. chatbot_conflicts
      {
        name: 'table chatbot_conflicts',
        sql: `CREATE TABLE IF NOT EXISTS chatbot_conflicts (
          code varchar(4) PRIMARY KEY,
          title text NOT NULL,
          risk text NOT NULL,
          locked_topics text[] NOT NULL DEFAULT '{}',
          owner_role varchar(40) NOT NULL,
          status varchar(10) NOT NULL DEFAULT 'open',
          resolution text NULL,
          resolved_by int NULL,
          resolved_at timestamptz NULL
        );`,
      },

      // 16. chatbot_sources
      {
        name: 'table chatbot_sources',
        sql: `CREATE TABLE IF NOT EXISTS chatbot_sources (
          code varchar(10) PRIMARY KEY,
          title text NOT NULL,
          internal_ref text NOT NULL,
          sensitivity varchar(16) NOT NULL,
          imported_at timestamptz NOT NULL DEFAULT now()
        );`,
      },

      // 17. chatbot_knowledge_gaps
      {
        name: 'table chatbot_knowledge_gaps',
        sql: `CREATE TABLE IF NOT EXISTS chatbot_knowledge_gaps (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          question_norm text NOT NULL,
          sample_text text NULL,
          intent varchar(32) NULL,
          count int NOT NULL DEFAULT 1,
          status varchar(12) NOT NULL DEFAULT 'open',
          first_seen_at timestamptz NOT NULL DEFAULT now(),
          last_seen_at timestamptz NOT NULL DEFAULT now(),
          CONSTRAINT uq_chatbot_knowledge_gaps_norm UNIQUE (question_norm)
        );`,
      },
      {
        name: 'index idx_chatbot_knowledge_gaps_status',
        sql: `CREATE INDEX IF NOT EXISTS idx_chatbot_knowledge_gaps_status ON chatbot_knowledge_gaps (status);`,
      },
      {
        name: 'index idx_chatbot_knowledge_gaps_count',
        sql: `CREATE INDEX IF NOT EXISTS idx_chatbot_knowledge_gaps_count ON chatbot_knowledge_gaps (count DESC);`,
      },
      // 18. chatbot_flows (conversation flow builder)
      {
        name: 'table chatbot_flows',
        sql: `CREATE TABLE IF NOT EXISTS chatbot_flows (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          name varchar(120) NOT NULL,
          description text NULL,
          enabled boolean NOT NULL DEFAULT true,
          priority int NOT NULL DEFAULT 0,
          draft_graph jsonb NOT NULL DEFAULT '{"nodes":[],"edges":[]}'::jsonb,
          published_graph jsonb NULL,
          published_version int NOT NULL DEFAULT 0,
          published_at timestamptz NULL,
          published_by int NULL,
          author_id int NULL,
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now()
        );`,
      },
      {
        name: 'index idx_chatbot_flows_enabled',
        sql: `CREATE INDEX IF NOT EXISTS idx_chatbot_flows_enabled ON chatbot_flows (enabled);`,
      },
      // 19. chatbot_flow_states
      {
        name: 'table chatbot_flow_states',
        sql: `CREATE TABLE IF NOT EXISTS chatbot_flow_states (
          conversation_id uuid PRIMARY KEY,
          flow_id uuid NOT NULL,
          flow_version int NOT NULL,
          node_id varchar(64) NOT NULL,
          updated_at timestamptz NOT NULL DEFAULT now()
        );`,
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
