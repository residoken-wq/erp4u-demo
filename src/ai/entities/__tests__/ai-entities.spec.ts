import { ENTITIES, PREMIUM_ENTITIES } from '../../../database/entities';
import { AiAuditLog } from '../ai-audit-log.entity';
import { AiDraft } from '../ai-draft.entity';
import { AiConversation } from '../ai-conversation.entity';
import { AiConversationMessage } from '../ai-conversation-message.entity';
import { getMetadataArgsStorage } from 'typeorm';

describe('AI Entities (Premium)', () => {
  it('registers AiAuditLog, AiDraft, AiConversation, and AiConversationMessage in PREMIUM_ENTITIES', () => {
    expect(PREMIUM_ENTITIES).toContain(AiAuditLog);
    expect(PREMIUM_ENTITIES).toContain(AiDraft);
    expect(PREMIUM_ENTITIES).toContain(AiConversation);
    expect(PREMIUM_ENTITIES).toContain(AiConversationMessage);
  });

  it('registers AiAuditLog, AiDraft, AiConversation, and AiConversationMessage in ENTITIES', () => {
    expect(ENTITIES).toContain(AiAuditLog);
    expect(ENTITIES).toContain(AiDraft);
    expect(ENTITIES).toContain(AiConversation);
    expect(ENTITIES).toContain(AiConversationMessage);
  });

  describe('AiAuditLog metadata', () => {
    it('is mapped to table ai_audit_log', () => {
      const storage = getMetadataArgsStorage();
      const tableMeta = storage.tables.find(
        (t) => t.target === AiAuditLog && t.name === 'ai_audit_log',
      );
      expect(tableMeta).toBeDefined();
    });

    it('has primary uuid column and required columns', () => {
      const storage = getMetadataArgsStorage();
      const columns = storage.columns.filter((c) => c.target === AiAuditLog);
      const colNames = columns.map((c) => c.propertyName);

      expect(colNames).toContain('user_id');
      expect(colNames).toContain('feature');
      expect(colNames).toContain('provider');
      expect(colNames).toContain('model');
      expect(colNames).toContain('input_tokens');
      expect(colNames).toContain('output_tokens');
      expect(colNames).toContain('units');
      expect(colNames).toContain('latency_ms');
      expect(colNames).toContain('status');
      expect(colNames).toContain('error_code');
      expect(colNames).toContain('prompt_redacted');
      expect(colNames).toContain('response_redacted');
      expect(colNames).toContain('tool_calls');
      expect(colNames).toContain('created_at');

      const featureCol = columns.find((c) => c.propertyName === 'feature');
      expect(featureCol?.options.length).toBe(50);

      const providerCol = columns.find((c) => c.propertyName === 'provider');
      expect(providerCol?.options.length).toBe(30);

      const unitsCol = columns.find((c) => c.propertyName === 'units');
      expect(unitsCol?.options.type).toBe('numeric');
      expect(unitsCol?.options.precision).toBe(12);
      expect(unitsCol?.options.scale).toBe(2);
      expect(unitsCol?.options.default).toBe(0);
    });

    it('has composite indexes on (created_at) and (user_id, created_at)', () => {
      const storage = getMetadataArgsStorage();
      const indices = storage.indices.filter((i) => i.target === AiAuditLog);
      const indexedColumns = indices.map((i) => i.columns);

      expect(indexedColumns).toContainEqual(['created_at']);
      expect(indexedColumns).toContainEqual(['user_id', 'created_at']);
    });

    it('has relation to User on user_id with onDelete SET NULL', () => {
      const storage = getMetadataArgsStorage();
      const relation = storage.relations.find(
        (r) => r.target === AiAuditLog && r.propertyName === 'user',
      );
      expect(relation).toBeDefined();
      expect(relation?.options.nullable).toBe(true);
      expect(relation?.options.onDelete).toBe('SET NULL');
    });
  });

  describe('AiDraft metadata', () => {
    it('is mapped to table ai_drafts', () => {
      const storage = getMetadataArgsStorage();
      const tableMeta = storage.tables.find(
        (t) => t.target === AiDraft && t.name === 'ai_drafts',
      );
      expect(tableMeta).toBeDefined();
    });

    it('has required columns and check constraint on status', () => {
      const storage = getMetadataArgsStorage();
      const columns = storage.columns.filter((c) => c.target === AiDraft);
      const colNames = columns.map((c) => c.propertyName);

      expect(colNames).toContain('kind');
      expect(colNames).toContain('payload');
      expect(colNames).toContain('status');
      expect(colNames).toContain('created_by');
      expect(colNames).toContain('confirmed_by');
      expect(colNames).toContain('confirmed_at');
      expect(colNames).toContain('result_ref');
      expect(colNames).toContain('audit_log_id');
      expect(colNames).toContain('expires_at');
      expect(colNames).toContain('created_at');
      expect(colNames).toContain('updated_at');

      const kindCol = columns.find((c) => c.propertyName === 'kind');
      expect(kindCol?.options.length).toBe(50);

      const statusCol = columns.find((c) => c.propertyName === 'status');
      expect(statusCol?.options.length).toBe(20);
      expect(statusCol?.options.default).toBe('pending');

      const checks = storage.checks.filter((c) => c.target === AiDraft);
      expect(checks.length).toBeGreaterThan(0);
      expect(checks[0].expression).toContain('status');
      expect(checks[0].expression).toContain("'pending'");
      expect(checks[0].expression).toContain("'confirmed'");
      expect(checks[0].expression).toContain("'rejected'");
      expect(checks[0].expression).toContain("'expired'");
    });

    it('has composite indexes on (created_by, status) and (status, expires_at)', () => {
      const storage = getMetadataArgsStorage();
      const indices = storage.indices.filter((i) => i.target === AiDraft);
      const indexedColumns = indices.map((i) => i.columns);

      expect(indexedColumns).toContainEqual(['created_by', 'status']);
      expect(indexedColumns).toContainEqual(['status', 'expires_at']);
    });

    it('has relation to User (created_by, confirmed_by) and AiAuditLog (audit_log_id ON DELETE SET NULL)', () => {
      const storage = getMetadataArgsStorage();
      const creatorRel = storage.relations.find(
        (r) => r.target === AiDraft && r.propertyName === 'creator',
      );
      expect(creatorRel).toBeDefined();

      const confirmerRel = storage.relations.find(
        (r) => r.target === AiDraft && r.propertyName === 'confirmer',
      );
      expect(confirmerRel).toBeDefined();
      expect(confirmerRel?.options.nullable).toBe(true);

      const auditRel = storage.relations.find(
        (r) => r.target === AiDraft && r.propertyName === 'audit_log',
      );
      expect(auditRel).toBeDefined();
      expect(auditRel?.options.nullable).toBe(true);
      expect(auditRel?.options.onDelete).toBe('SET NULL');
    });
  });

  describe('AiConversation metadata', () => {
    it('is mapped to table ai_conversations', () => {
      const storage = getMetadataArgsStorage();
      const tableMeta = storage.tables.find(
        (t) => t.target === AiConversation && t.name === 'ai_conversations',
      );
      expect(tableMeta).toBeDefined();
    });

    it('has primary uuid column, user_id, title, created_at, updated_at', () => {
      const storage = getMetadataArgsStorage();
      const columns = storage.columns.filter((c) => c.target === AiConversation);
      const colNames = columns.map((c) => c.propertyName);

      expect(colNames).toContain('user_id');
      expect(colNames).toContain('title');
      expect(colNames).toContain('created_at');
      expect(colNames).toContain('updated_at');

      const titleCol = columns.find((c) => c.propertyName === 'title');
      expect(titleCol?.options.length).toBe(200);
    });

    it('has composite index on (user_id, updated_at)', () => {
      const storage = getMetadataArgsStorage();
      const indices = storage.indices.filter((i) => i.target === AiConversation);
      const indexedColumns = indices.map((i) => i.columns);

      expect(indexedColumns).toContainEqual(['user_id', 'updated_at']);
    });

    it('has relation to User on user_id with onDelete CASCADE', () => {
      const storage = getMetadataArgsStorage();
      const relation = storage.relations.find(
        (r) => r.target === AiConversation && r.propertyName === 'user',
      );
      expect(relation).toBeDefined();
      expect(relation?.options.onDelete).toBe('CASCADE');
    });
  });

  describe('AiConversationMessage metadata', () => {
    it('is mapped to table ai_conversation_messages', () => {
      const storage = getMetadataArgsStorage();
      const tableMeta = storage.tables.find(
        (t) => t.target === AiConversationMessage && t.name === 'ai_conversation_messages',
      );
      expect(tableMeta).toBeDefined();
    });

    it('has required columns and check constraint on role', () => {
      const storage = getMetadataArgsStorage();
      const columns = storage.columns.filter((c) => c.target === AiConversationMessage);
      const colNames = columns.map((c) => c.propertyName);

      expect(colNames).toContain('conversation_id');
      expect(colNames).toContain('role');
      expect(colNames).toContain('content');
      expect(colNames).toContain('tool_steps');
      expect(colNames).toContain('sources');
      expect(colNames).toContain('audit_log_id');
      expect(colNames).toContain('error_code');
      expect(colNames).toContain('created_at');

      const roleCol = columns.find((c) => c.propertyName === 'role');
      expect(roleCol?.options.length).toBe(20);

      const errCol = columns.find((c) => c.propertyName === 'error_code');
      expect(errCol?.options.length).toBe(50);

      const checks = storage.checks.filter((c) => c.target === AiConversationMessage);
      expect(checks.length).toBeGreaterThan(0);
      expect(checks[0].expression).toContain('role');
      expect(checks[0].expression).toContain("'user'");
      expect(checks[0].expression).toContain("'assistant'");
    });

    it('has indexes on (conversation_id, created_at) and (created_at)', () => {
      const storage = getMetadataArgsStorage();
      const indices = storage.indices.filter((i) => i.target === AiConversationMessage);
      const indexedColumns = indices.map((i) => i.columns);

      expect(indexedColumns).toContainEqual(['conversation_id', 'created_at']);
      expect(indexedColumns).toContainEqual(['created_at']);
    });

    it('has relation to AiConversation (conversation_id ON DELETE CASCADE) and AiAuditLog (audit_log_id ON DELETE SET NULL)', () => {
      const storage = getMetadataArgsStorage();
      const convRel = storage.relations.find(
        (r) => r.target === AiConversationMessage && r.propertyName === 'conversation',
      );
      expect(convRel).toBeDefined();
      expect(convRel?.options.onDelete).toBe('CASCADE');

      const auditRel = storage.relations.find(
        (r) => r.target === AiConversationMessage && r.propertyName === 'audit_log',
      );
      expect(auditRel).toBeDefined();
      expect(auditRel?.options.nullable).toBe(true);
      expect(auditRel?.options.onDelete).toBe('SET NULL');
    });
  });
});
