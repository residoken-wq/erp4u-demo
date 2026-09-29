import { EntityManager, In } from 'typeorm';
import { ChatbotKnowledgeItem } from '../entities/chatbot-knowledge-item.entity';
import { ChatbotConflict } from '../entities/chatbot-conflict.entity';
import { ChatbotAuditEvent } from '../entities/chatbot-audit-event.entity';
import { SystemConfig } from '../../system/system-config.entity';
import { normalizeVi } from '../security/pii';
import { KB_V2_CONFLICT_TRIAGE } from './kb-v2-conflict-triage.data';

export const KB_V2_TRIAGE_CONFLICTS_MARKER = 'CHATBOT_KB_V2_CONFLICT_TRIAGE_1';

const same = (a: string | null | undefined, b: string) => (a || '').trim() === b.trim();

/**
 * Owner-approved triage of kb-v2 items locked by conflicts (2026-09-29).
 * Idempotent: only touches kb2.* items that are still unpublished AND still carry the original imported text,
 * so manual CMS edits and published items are never overwritten. Runs at boot and right after a kb import.
 */
export async function applyKbV2ItemTriage(mgr: EntityManager): Promise<{ retired: number; rewritten: number }> {
  const keys = [...KB_V2_CONFLICT_TRIAGE.retire, ...KB_V2_CONFLICT_TRIAGE.rewrite].map((t) => t.seed_key);
  const rows = await mgr.find(ChatbotKnowledgeItem, {
    where: { seed_key: In(keys), status: In(['draft', 'needs_review']) },
  });
  const byKey = new Map(rows.map((r) => [r.seed_key, r]));
  let retired = 0;
  let rewritten = 0;

  for (const t of KB_V2_CONFLICT_TRIAGE.retire) {
    const row = byKey.get(t.seed_key);
    if (!row || !same(row.answer, t.original)) continue;
    row.status = 'retired';
    await mgr.save(ChatbotKnowledgeItem, row);
    retired++;
  }
  for (const t of KB_V2_CONFLICT_TRIAGE.rewrite) {
    const row = byKey.get(t.seed_key);
    if (!row || !t.answer || !same(row.answer, t.original)) continue;
    row.answer = t.answer;
    row.search_text = normalizeVi((row.question || '') + ' ' + t.answer);
    await mgr.save(ChatbotKnowledgeItem, row);
    rewritten++;
  }

  if (retired || rewritten) {
    await mgr.save(
      ChatbotAuditEvent,
      mgr.create(ChatbotAuditEvent, {
        actor_type: 'system',
        actor_user_id: null,
        op: 'kb.triage',
        object_type: 'knowledge',
        object_id: 'kb-v2-conflict-triage',
        after_ref: { retired, rewritten },
      }),
    );
  }
  return { retired, rewritten };
}

/** One-time: resolve the conflicts the owner approved, with the recorded resolution. */
export async function applyKbV2ConflictResolutions(mgr: EntityManager): Promise<number> {
  const done = await mgr.findOne(SystemConfig, { where: { key: KB_V2_TRIAGE_CONFLICTS_MARKER } });
  if (done) return 0;
  let resolved = 0;
  for (const r of KB_V2_CONFLICT_TRIAGE.resolve) {
    const c = await mgr.findOne(ChatbotConflict, { where: { code: r.code } });
    if (!c || c.status !== 'open') continue;
    c.status = 'resolved';
    c.resolution = r.resolution;
    c.resolved_by = null;
    c.resolved_at = new Date();
    await mgr.save(ChatbotConflict, c);
    await mgr.save(
      ChatbotAuditEvent,
      mgr.create(ChatbotAuditEvent, {
        actor_type: 'system',
        actor_user_id: null,
        op: 'kb.conflict',
        object_type: 'conflict',
        object_id: r.code,
        after_ref: { status: 'resolved', resolution: r.resolution },
      }),
    );
    resolved++;
  }
  await mgr.save(
    SystemConfig,
    mgr.create(SystemConfig, {
      key: KB_V2_TRIAGE_CONFLICTS_MARKER,
      value: JSON.stringify({ at: new Date().toISOString(), resolved }),
      description: 'Chatbot kb-v2 conflict triage marker (owner-approved resolutions)',
    }),
  );
  if (resolved) {
    await mgr.query(`
      INSERT INTO system_configs (key, value, description)
      VALUES ('CHATBOT_KB_VERSION', '1', 'Chatbot Knowledge Base version')
      ON CONFLICT (key) DO UPDATE
      SET value = (COALESCE(system_configs.value::int, 0) + 1)::text;
    `);
  }
  return resolved;
}
