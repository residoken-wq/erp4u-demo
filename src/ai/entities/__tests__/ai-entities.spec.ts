import { ENTITIES, PREMIUM_ENTITIES } from '../../../database/entities';
import { AiAuditLog } from '../ai-audit-log.entity';
import { AiDraft } from '../ai-draft.entity';
import { AiConversation } from '../ai-conversation.entity';
import { AiConversationMessage } from '../ai-conversation-message.entity';
import { AiDocumentScan } from '../ai-document-scan.entity';
import { AiDocumentScans1795317950000 } from '../../../database/migrations/1795317950000-AiDocumentScans';
import { AiVoiceInputMode1795317960000 } from '../../../database/migrations/1795317960000-AiVoiceInputMode';
import { getMetadataArgsStorage } from 'typeorm';

describe('AI Entities (Premium)', () => {
  it('registers AiAuditLog, AiDraft, AiConversation, AiConversationMessage, and AiDocumentScan in PREMIUM_ENTITIES', () => {
    expect(PREMIUM_ENTITIES).toContain(AiAuditLog);
    expect(PREMIUM_ENTITIES).toContain(AiDraft);
    expect(PREMIUM_ENTITIES).toContain(AiConversation);
    expect(PREMIUM_ENTITIES).toContain(AiConversationMessage);
    expect(PREMIUM_ENTITIES).toContain(AiDocumentScan);
  });

  it('registers AiAuditLog, AiDraft, AiConversation, AiConversationMessage, and AiDocumentScan in ENTITIES', () => {
    expect(ENTITIES).toContain(AiAuditLog);
    expect(ENTITIES).toContain(AiDraft);
    expect(ENTITIES).toContain(AiConversation);
    expect(ENTITIES).toContain(AiConversationMessage);
    expect(ENTITIES).toContain(AiDocumentScan);
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
      expect(colNames).toContain('error_code');
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

      const errCol = columns.find((c) => c.propertyName === 'error_code');
      expect(errCol?.options.length).toBe(50);
      expect(errCol?.options.nullable).toBe(true);

      const checks = storage.checks.filter((c) => c.target === AiDraft);
      expect(checks.length).toBeGreaterThan(0);
      expect(checks[0].expression).toContain('status');
      expect(checks[0].expression).toContain("'pending'");
      expect(checks[0].expression).toContain("'confirmed'");
      expect(checks[0].expression).toContain("'rejected'");
      expect(checks[0].expression).toContain("'expired'");
      expect(checks[0].expression).toContain("'executing'");
      expect(checks[0].expression).toContain("'failed'");
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
      expect(colNames).toContain('drafts');
      expect(colNames).toContain('audit_log_id');
      expect(colNames).toContain('error_code');
      expect(colNames).toContain('input_mode');
      expect(colNames).toContain('created_at');

      const roleCol = columns.find((c) => c.propertyName === 'role');
      expect(roleCol?.options.length).toBe(20);

      const inputModeCol = columns.find((c) => c.propertyName === 'input_mode');
      expect(inputModeCol?.options.length).toBe(10);
      expect(inputModeCol?.options.default).toBe('text');

      const errCol = columns.find((c) => c.propertyName === 'error_code');
      expect(errCol?.options.length).toBe(50);

      const checks = storage.checks.filter((c) => c.target === AiConversationMessage);
      expect(checks.length).toBeGreaterThanOrEqual(2);
      expect(checks.some(c => c.expression.includes('role') && c.expression.includes("'user'") && c.expression.includes("'assistant'"))).toBe(true);
      expect(checks.some(c => c.expression.includes('input_mode') && c.expression.includes("'text'") && c.expression.includes("'voice'"))).toBe(true);
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

  describe('AiDocumentScan metadata', () => {
    it('is mapped to table ai_document_scans', () => {
      const storage = getMetadataArgsStorage();
      const tableMeta = storage.tables.find(
        (t) => t.target === AiDocumentScan && t.name === 'ai_document_scans',
      );
      expect(tableMeta).toBeDefined();
    });

    it('has required columns and check constraints on kind, source, status', () => {
      const storage = getMetadataArgsStorage();
      const columns = storage.columns.filter((c) => c.target === AiDocumentScan);
      const colNames = columns.map((c) => c.propertyName);

      expect(colNames).toContain('kind');
      expect(colNames).toContain('source');
      expect(colNames).toContain('status');
      expect(colNames).toContain('file_key');
      expect(colNames).toContain('mime');
      expect(colNames).toContain('size_bytes');
      expect(colNames).toContain('page_count');
      expect(colNames).toContain('sha256');
      expect(colNames).toContain('extracted');
      expect(colNames).toContain('field_confidence');
      expect(colNames).toContain('warnings');
      expect(colNames).toContain('error_code');
      expect(colNames).toContain('result_type');
      expect(colNames).toContain('result_id');
      expect(colNames).toContain('created_by');
      expect(colNames).toContain('created_at');
      expect(colNames).toContain('expires_at');

      const kindCol = columns.find((c) => c.propertyName === 'kind');
      expect(kindCol?.options.length).toBe(50);

      const statusCol = columns.find((c) => c.propertyName === 'status');
      expect(statusCol?.options.length).toBe(20);
      expect(statusCol?.options.default).toBe('processing');

      const sourceCol = columns.find((c) => c.propertyName === 'source');
      expect(sourceCol?.options.length).toBe(20);

      const pageCountCol = columns.find((c) => c.propertyName === 'page_count');
      expect(pageCountCol?.options.default).toBe(1);

      const checks = storage.checks.filter((c) => c.target === AiDocumentScan);
      expect(checks.length).toBe(3);

      const checkExpressions = checks.map((c) => c.expression);
      expect(checkExpressions.some((e) => e.includes('kind') && e.includes("'supplier_quote'"))).toBe(true);
      expect(checkExpressions.some((e) => e.includes('source') && e.includes("'xml'"))).toBe(true);
      expect(checkExpressions.some((e) => e.includes('status') && e.includes("'processing'"))).toBe(true);
    });

    it('has 4 indexes as specified in the plan', () => {
      const storage = getMetadataArgsStorage();
      const indices = storage.indices.filter((i) => i.target === AiDocumentScan);
      const indexedColumns = indices.map((i) => i.columns);

      expect(indexedColumns).toContainEqual(['created_by', 'created_at']);
      expect(indexedColumns).toContainEqual(['result_type', 'result_id']);
      expect(indexedColumns).toContainEqual(['expires_at']);
      expect(indexedColumns).toContainEqual(['sha256']);
    });

    it('has relation to User on created_by with onDelete SET NULL', () => {
      const storage = getMetadataArgsStorage();
      const creatorRel = storage.relations.find(
        (r) => r.target === AiDocumentScan && r.propertyName === 'creator',
      );
      expect(creatorRel).toBeDefined();
      expect(creatorRel?.options.nullable).toBe(true);
      expect(creatorRel?.options.onDelete).toBe('SET NULL');
    });
  });

  describe('AiDocumentScans1795317950000 Migration up & down', () => {
    it('executes up and down queries cleanly without hardcoded schema', async () => {
      const migration = new AiDocumentScans1795317950000();
      const upQueries: string[] = [];
      const downQueries: string[] = [];

      const mockRunnerUp = {
        query: jest.fn().mockImplementation((q: string) => {
          upQueries.push(q);
          return Promise.resolve();
        }),
      } as any;

      const mockRunnerDown = {
        query: jest.fn().mockImplementation((q: string) => {
          downQueries.push(q);
          return Promise.resolve();
        }),
      } as any;

      await migration.up(mockRunnerUp);
      expect(upQueries.length).toBeGreaterThanOrEqual(6);
      upQueries.forEach((q) => {
        expect(q).not.toContain('"public".');
      });

      await migration.down(mockRunnerDown);
      expect(downQueries.length).toBeGreaterThanOrEqual(6);
      downQueries.forEach((q) => {
        expect(q).not.toContain('"public".');
      });
    });
  });

  describe('AiVoiceInputMode1795317960000 Migration up & down', () => {
    it('executes up and down queries cleanly without hardcoded schema', async () => {
      const migration = new AiVoiceInputMode1795317960000();
      const upQueries: string[] = [];
      const downQueries: string[] = [];

      const mockRunnerUp = {
        query: jest.fn().mockImplementation((q: string) => {
          upQueries.push(q);
          return Promise.resolve();
        }),
      } as any;

      const mockRunnerDown = {
        query: jest.fn().mockImplementation((q: string) => {
          downQueries.push(q);
          return Promise.resolve();
        }),
      } as any;

      await migration.up(mockRunnerUp);
      expect(upQueries.length).toBe(2);
      expect(upQueries[0]).toContain('ADD "input_mode" character varying(10) NOT NULL DEFAULT \'text\'');
      expect(upQueries[1]).toContain('ADD CONSTRAINT "CHK_6be2fa8d0cab5ef93e0a4b1be1" CHECK ("input_mode" IN (\'text\', \'voice\'))');
      upQueries.forEach((q) => {
        expect(q).not.toContain('"public".');
      });

      await migration.down(mockRunnerDown);
      expect(downQueries.length).toBe(2);
      expect(downQueries[0]).toContain('DROP CONSTRAINT "CHK_6be2fa8d0cab5ef93e0a4b1be1"');
      expect(downQueries[1]).toContain('DROP COLUMN "input_mode"');
      downQueries.forEach((q) => {
        expect(q).not.toContain('"public".');
      });
    });
  });
});
