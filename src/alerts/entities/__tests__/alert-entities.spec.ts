import { ENTITIES, PREMIUM_ENTITIES } from '../../../database/entities';
import {
  Alert,
  AlertSetting,
  AlertUserPref,
  AlertRun,
} from '../index';
import { AlertEntities1795317940000 } from '../../../database/migrations/1795317940000-AlertEntities';
import { getMetadataArgsStorage } from 'typeorm';

describe('Alert Entities (Premium - P9d)', () => {
  it('registers Alert, AlertSetting, AlertUserPref, and AlertRun in PREMIUM_ENTITIES', () => {
    expect(PREMIUM_ENTITIES).toContain(Alert);
    expect(PREMIUM_ENTITIES).toContain(AlertSetting);
    expect(PREMIUM_ENTITIES).toContain(AlertUserPref);
    expect(PREMIUM_ENTITIES).toContain(AlertRun);
  });

  it('registers Alert, AlertSetting, AlertUserPref, and AlertRun in ENTITIES', () => {
    expect(ENTITIES).toContain(Alert);
    expect(ENTITIES).toContain(AlertSetting);
    expect(ENTITIES).toContain(AlertUserPref);
    expect(ENTITIES).toContain(AlertRun);
  });

  describe('Alert metadata', () => {
    it('is mapped to table alerts', () => {
      const storage = getMetadataArgsStorage();
      const tableMeta = storage.tables.find(
        (t) => t.target === Alert && t.name === 'alerts',
      );
      expect(tableMeta).toBeDefined();
    });

    it('has primary uuid column and all required fields', () => {
      const storage = getMetadataArgsStorage();
      const columns = storage.columns.filter((c) => c.target === Alert);
      const colNames = columns.map((c) => c.propertyName);

      expect(colNames).toContain('type');
      expect(colNames).toContain('severity');
      expect(colNames).toContain('entity_type');
      expect(colNames).toContain('entity_id');
      expect(colNames).toContain('fingerprint');
      expect(colNames).toContain('title');
      expect(colNames).toContain('detail');
      expect(colNames).toContain('status');
      expect(colNames).toContain('snoozed_until');
      expect(colNames).toContain('acknowledged_by');
      expect(colNames).toContain('first_seen_at');
      expect(colNames).toContain('last_seen_at');
      expect(colNames).toContain('resolved_at');
      expect(colNames).toContain('created_at');
      expect(colNames).toContain('updated_at');

      const fpCol = columns.find((c) => c.propertyName === 'fingerprint');
      expect(fpCol?.options.unique).toBe(true);
      expect(fpCol?.options.length).toBe(255);

      const statusCol = columns.find((c) => c.propertyName === 'status');
      expect(statusCol?.options.default).toBe('open');
      expect(statusCol?.options.length).toBe(20);
    });

    it('has CHECK constraints for status and severity', () => {
      const storage = getMetadataArgsStorage();
      const checks = storage.checks.filter((c) => c.target === Alert);
      expect(checks.length).toBe(2);

      const statusCheck = checks.find((c) => c.expression.includes('status'));
      expect(statusCheck).toBeDefined();
      expect(statusCheck?.expression).toContain("'open'");
      expect(statusCheck?.expression).toContain("'acknowledged'");
      expect(statusCheck?.expression).toContain("'snoozed'");
      expect(statusCheck?.expression).toContain("'resolved'");

      const severityCheck = checks.find((c) => c.expression.includes('severity'));
      expect(severityCheck).toBeDefined();
      expect(severityCheck?.expression).toContain("'low'");
      expect(severityCheck?.expression).toContain("'medium'");
      expect(severityCheck?.expression).toContain("'high'");
    });

    it('has composite index on (status, type) and index on (last_seen_at)', () => {
      const storage = getMetadataArgsStorage();
      const indices = storage.indices.filter((i) => i.target === Alert);
      const indexedColumns = indices.map((i) => i.columns);

      expect(indexedColumns).toContainEqual(['status', 'type']);
      expect(indexedColumns).toContainEqual(['last_seen_at']);
    });

    it('has relation to User on acknowledged_by with onDelete SET NULL', () => {
      const storage = getMetadataArgsStorage();
      const relation = storage.relations.find(
        (r) => r.target === Alert && r.propertyName === 'acknowledger',
      );
      expect(relation).toBeDefined();
      expect(relation?.options.nullable).toBe(true);
      expect(relation?.options.onDelete).toBe('SET NULL');
    });
  });

  describe('AlertSetting metadata', () => {
    it('is mapped to table alert_settings', () => {
      const storage = getMetadataArgsStorage();
      const tableMeta = storage.tables.find(
        (t) => t.target === AlertSetting && t.name === 'alert_settings',
      );
      expect(tableMeta).toBeDefined();
    });

    it('has primary type column, enabled, params, updated_by, updated_at', () => {
      const storage = getMetadataArgsStorage();
      const columns = storage.columns.filter((c) => c.target === AlertSetting);
      const colNames = columns.map((c) => c.propertyName);

      expect(colNames).toContain('type');
      expect(colNames).toContain('enabled');
      expect(colNames).toContain('params');
      expect(colNames).toContain('updated_by');
      expect(colNames).toContain('updated_at');

      const enabledCol = columns.find((c) => c.propertyName === 'enabled');
      expect(enabledCol?.options.default).toBe(true);
    });

    it('has relation to User on updated_by with onDelete SET NULL', () => {
      const storage = getMetadataArgsStorage();
      const relation = storage.relations.find(
        (r) => r.target === AlertSetting && r.propertyName === 'updater',
      );
      expect(relation).toBeDefined();
      expect(relation?.options.nullable).toBe(true);
      expect(relation?.options.onDelete).toBe('SET NULL');
    });
  });

  describe('AlertUserPref metadata', () => {
    it('is mapped to table alert_user_prefs', () => {
      const storage = getMetadataArgsStorage();
      const tableMeta = storage.tables.find(
        (t) => t.target === AlertUserPref && t.name === 'alert_user_prefs',
      );
      expect(tableMeta).toBeDefined();
    });

    it('has composite primary key (user_id, type) and boolean prefs', () => {
      const storage = getMetadataArgsStorage();
      const columns = storage.columns.filter((c) => c.target === AlertUserPref);
      const colNames = columns.map((c) => c.propertyName);

      expect(colNames).toContain('user_id');
      expect(colNames).toContain('type');
      expect(colNames).toContain('in_app');
      expect(colNames).toContain('email_digest');

      const inAppCol = columns.find((c) => c.propertyName === 'in_app');
      expect(inAppCol?.options.default).toBe(true);

      const emailCol = columns.find((c) => c.propertyName === 'email_digest');
      expect(emailCol?.options.default).toBe(false);
    });

    it('has foreign key to User on user_id with onDelete CASCADE', () => {
      const storage = getMetadataArgsStorage();
      const relation = storage.relations.find(
        (r) => r.target === AlertUserPref && r.propertyName === 'user',
      );
      expect(relation).toBeDefined();
      expect(relation?.options.onDelete).toBe('CASCADE');
    });
  });

  describe('AlertRun metadata', () => {
    it('is mapped to table alert_runs', () => {
      const storage = getMetadataArgsStorage();
      const tableMeta = storage.tables.find(
        (t) => t.target === AlertRun && t.name === 'alert_runs',
      );
      expect(tableMeta).toBeDefined();
    });

    it('has required columns for scan history', () => {
      const storage = getMetadataArgsStorage();
      const columns = storage.columns.filter((c) => c.target === AlertRun);
      const colNames = columns.map((c) => c.propertyName);

      expect(colNames).toContain('started_at');
      expect(colNames).toContain('finished_at');
      expect(colNames).toContain('status');
      expect(colNames).toContain('counts');
      expect(colNames).toContain('error_code');

      const statusCol = columns.find((c) => c.propertyName === 'status');
      expect(statusCol?.options.default).toBe('running');
    });
  });

  describe('AlertEntities1795317940000 Migration up & down', () => {
    it('executes up and down queries cleanly without hardcoded schema', async () => {
      const migration = new AlertEntities1795317940000();
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
      expect(upQueries.length).toBeGreaterThanOrEqual(8);
      upQueries.forEach((q) => {
        expect(q).not.toContain('"public".');
      });

      await migration.down(mockRunnerDown);
      expect(downQueries.length).toBeGreaterThanOrEqual(8);
      downQueries.forEach((q) => {
        expect(q).not.toContain('"public".');
      });
    });
  });
});
