import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { ChatbotFlow, ChatbotFlowState } from '../entities/chatbot-flow.entity';
import { ChatbotKnowledgeItem } from '../entities/chatbot-knowledge-item.entity';
import { ChatbotAuditService } from '../audit/chatbot-audit.service';
import { renderTemplate } from '../config/chatbot-config.service';
import { CHATBOT_DEFAULTS } from '../chatbot.defaults';
import {
  EMPTY_GRAPH,
  FlowGraph,
  FlowIssue,
  FlowNode,
  findNode,
  followBranch,
  hasErrors,
  matchBranch,
  startNode,
  textHasKeyword,
  validateFlowGraph,
  walkFlow,
} from './flow-graph';

/** Result of one flow step, committed together with the AI message. */
export interface FlowTurn {
  flow_id: string;
  flow_version: number;
  node_ids: string[];
  text: string;
  payload: any | null;
  /** Node waiting for the customer; null clears the conversation's flow state. */
  next_node_id: string | null;
}

interface PublishedFlow {
  id: string;
  name: string;
  priority: number;
  version: number;
  graph: FlowGraph;
}

const CACHE_TTL_MS = 30_000;

@Injectable()
export class ChatbotFlowService {
  private readonly logger = new Logger(ChatbotFlowService.name);
  private cache: { at: number; flows: PublishedFlow[] } | null = null;

  constructor(
    private readonly dataSource: DataSource,
    private readonly auditService: ChatbotAuditService,
  ) {}

  // ---------------------------------------------------------------------------
  // Admin (CMS)
  // ---------------------------------------------------------------------------

  async list() {
    const rows = await this.dataSource.getRepository(ChatbotFlow).find({ order: { priority: 'DESC', updated_at: 'DESC' } });
    return rows.map((f) => this.summary(f));
  }

  async get(id: string) {
    const flow = await this.mustFind(id);
    const { issues } = await this.lint(flow.draft_graph, flow.id);
    return { ...this.summary(flow), draft_graph: flow.draft_graph, published_graph: flow.published_graph, issues };
  }

  async create(body: any, userId: number | null) {
    const name = this.cleanName(body?.name);
    const { graph } = validateFlowGraph(body?.graph || EMPTY_GRAPH);
    const repo = this.dataSource.getRepository(ChatbotFlow);
    const flow = repo.create({
      name,
      description: body?.description ? String(body.description).slice(0, 500) : null,
      priority: this.cleanPriority(body?.priority),
      enabled: true,
      draft_graph: graph,
      published_graph: null,
      published_version: 0,
      author_id: userId,
    });
    const saved = await repo.save(flow);
    await this.audit(userId, 'flow.create', saved.id, null, { name });
    return this.get(saved.id);
  }

  async update(id: string, body: any, userId: number | null) {
    const flow = await this.mustFind(id);
    if (body?.name !== undefined) flow.name = this.cleanName(body.name);
    if (body?.description !== undefined) flow.description = body.description ? String(body.description).slice(0, 500) : null;
    if (body?.priority !== undefined) flow.priority = this.cleanPriority(body.priority);
    if (body?.graph !== undefined) flow.draft_graph = validateFlowGraph(body.graph).graph;
    await this.dataSource.getRepository(ChatbotFlow).save(flow);
    this.invalidate();
    return this.get(id);
  }

  async publish(id: string, userId: number | null) {
    const flow = await this.mustFind(id);
    const { graph, issues } = await this.lint(flow.draft_graph, flow.id);
    if (hasErrors(issues)) {
      throw new BadRequestException({ code: 'FLOW_INVALID', message: 'Sơ đồ còn lỗi, chưa thể xuất bản', issues });
    }
    const before = flow.published_version;
    flow.published_graph = graph;
    flow.draft_graph = graph;
    flow.published_version = (flow.published_version || 0) + 1;
    flow.published_at = new Date();
    flow.published_by = userId;
    await this.dataSource.getRepository(ChatbotFlow).save(flow);
    this.invalidate();
    await this.audit(userId, 'flow.publish', flow.id, { version: before }, { version: flow.published_version });
    return this.get(id);
  }

  async setEnabled(id: string, enabled: boolean, userId: number | null) {
    const flow = await this.mustFind(id);
    if (enabled && flow.published_graph) {
      const conflicts = await this.startActionConflicts(flow.published_graph, flow.id);
      if (conflicts.length) {
        throw new BadRequestException({ code: 'FLOW_INVALID', message: 'Trùng nút khởi động với kịch bản khác', issues: conflicts });
      }
    }
    flow.enabled = !!enabled;
    await this.dataSource.getRepository(ChatbotFlow).save(flow);
    if (!enabled) await this.dataSource.getRepository(ChatbotFlowState).delete({ flow_id: flow.id });
    this.invalidate();
    await this.audit(userId, enabled ? 'flow.enable' : 'flow.disable', flow.id, null, null);
    return this.get(id);
  }

  async remove(id: string, userId: number | null) {
    const flow = await this.mustFind(id);
    await this.dataSource.transaction(async (mgr) => {
      await mgr.delete(ChatbotFlowState, { flow_id: flow.id });
      await mgr.delete(ChatbotFlow, { id: flow.id });
    });
    this.invalidate();
    await this.audit(userId, 'flow.delete', flow.id, { name: flow.name, version: flow.published_version }, null);
    return { ok: true };
  }

  /** Published, public topics for the "Tri thức" node picker. */
  async topics() {
    const rows = await this.dataSource.query(
      `SELECT topic, max(question) AS question
         FROM chatbot_knowledge_items
        WHERE status = 'published' AND public_allowed = true
        GROUP BY topic ORDER BY topic LIMIT 500`,
    );
    return rows.map((r: any) => ({ topic: r.topic, question: r.question || null }));
  }

  private summary(f: ChatbotFlow) {
    const g: FlowGraph = f.published_graph || f.draft_graph || EMPTY_GRAPH;
    const start = startNode(g);
    return {
      id: f.id,
      name: f.name,
      description: f.description,
      enabled: f.enabled,
      priority: f.priority,
      published_version: f.published_version,
      published_at: f.published_at,
      updated_at: f.updated_at,
      node_count: (f.draft_graph?.nodes || []).length,
      has_unpublished_changes:
        !f.published_graph || JSON.stringify(f.published_graph) !== JSON.stringify(f.draft_graph),
      triggers: {
        start_actions: start?.data.start_actions || [],
        keywords: start?.data.keywords || [],
      },
    };
  }

  /** Shape validation + cross checks that need the DB. */
  private async lint(raw: any, flowId: string): Promise<{ graph: FlowGraph; issues: FlowIssue[] }> {
    const { graph, issues } = validateFlowGraph(raw || EMPTY_GRAPH);
    issues.push(...(await this.startActionConflicts(graph, flowId)));
    const topics = [...new Set(graph.nodes.filter((n) => n.type === 'knowledge' && n.data.topic).map((n) => n.data.topic!))];
    if (topics.length) {
      const rows: { topic: string }[] = await this.dataSource.query(
        `SELECT DISTINCT topic FROM chatbot_knowledge_items
          WHERE status = 'published' AND public_allowed = true AND topic = ANY($1)`,
        [topics],
      );
      const ok = new Set(rows.map((r) => r.topic));
      for (const n of graph.nodes) {
        if (n.type === 'knowledge' && n.data.topic && !ok.has(n.data.topic)) {
          issues.push({
            level: n.data.fallback_text ? 'warning' : 'error',
            code: 'TOPIC_NOT_PUBLISHED',
            node_id: n.id,
            message: n.data.fallback_text
              ? `Chủ đề "${n.data.topic}" chưa có tri thức đã duyệt — sẽ dùng câu dự phòng`
              : `Chủ đề "${n.data.topic}" chưa có tri thức đã duyệt và bước này chưa có câu dự phòng`,
          });
        }
      }
    }
    return { graph, issues };
  }

  private async startActionConflicts(graph: FlowGraph, flowId: string): Promise<FlowIssue[]> {
    const start = startNode(graph);
    const mine = start?.data.start_actions || [];
    if (!mine.length) return [];
    const others = (await this.publishedFlows()).filter((f) => f.id !== flowId);
    const issues: FlowIssue[] = [];
    for (const a of mine) {
      const owner = others.find((f) => (startNode(f.graph)?.data.start_actions || []).includes(a));
      if (owner) {
        issues.push({
          level: 'error',
          code: 'START_ACTION_TAKEN',
          node_id: start!.id,
          message: `Nút khởi động "${a}" đang được kịch bản "${owner.name}" dùng`,
        });
      }
    }
    return issues;
  }

  private cleanName(v: any): string {
    const name = String(v ?? '').trim().slice(0, 120);
    if (!name) throw new BadRequestException({ code: 'NAME_REQUIRED', message: 'Cần đặt tên kịch bản' });
    return name;
  }

  private cleanPriority(v: any): number {
    const n = Math.round(Number(v));
    return Number.isFinite(n) ? Math.max(-100, Math.min(100, n)) : 0;
  }

  private async mustFind(id: string): Promise<ChatbotFlow> {
    if (!/^[0-9a-f-]{36}$/i.test(String(id))) throw new NotFoundException({ code: 'FLOW_NOT_FOUND' });
    const flow = await this.dataSource.getRepository(ChatbotFlow).findOne({ where: { id } });
    if (!flow) throw new NotFoundException({ code: 'FLOW_NOT_FOUND' });
    return flow;
  }

  private async audit(userId: number | null, op: string, id: string, before: any, after: any) {
    try {
      await this.auditService.logEvent({
        actor_type: 'user',
        actor_user_id: userId,
        op,
        object_type: 'chatbot_flow',
        object_id: id,
        before_ref: before,
        after_ref: after,
      });
    } catch (e: any) {
      this.logger.warn(`flow audit failed: ${e?.message}`);
    }
  }

  // ---------------------------------------------------------------------------
  // Runtime
  // ---------------------------------------------------------------------------

  invalidate() {
    this.cache = null;
  }

  private async publishedFlows(): Promise<PublishedFlow[]> {
    if (this.cache && Date.now() - this.cache.at < CACHE_TTL_MS) return this.cache.flows;
    const rows = await this.dataSource.getRepository(ChatbotFlow).find({
      where: { enabled: true },
      order: { priority: 'DESC', published_at: 'ASC' },
    });
    const flows = rows
      .filter((r) => r.published_graph && r.published_version > 0)
      .map((r) => ({ id: r.id, name: r.name, priority: r.priority, version: r.published_version, graph: r.published_graph as FlowGraph }));
    this.cache = { at: Date.now(), flows };
    return flows;
  }

  /** Start button in the widget (school/parent/sample/support). */
  async startByAction(value: string, config: any): Promise<FlowTurn | null> {
    try {
      const flows = await this.publishedFlows();
      const flow = flows.find((f) => (startNode(f.graph)?.data.start_actions || []).includes(String(value)));
      if (!flow) return null;
      return await this.runFrom(flow, startNode(flow.graph), config);
    } catch (e: any) {
      this.logger.warn(`flow startByAction failed: ${e?.message}`);
      return null;
    }
  }

  /**
   * Customer typed/clicked something. Continues the active flow, or starts one by keyword.
   * Returns null when no flow handles the turn (normal KB/AI pipeline takes over).
   */
  async handleText(conversationId: string, text: string, config: any): Promise<FlowTurn | null> {
    try {
      const flows = await this.publishedFlows();
      const stateRepo = this.dataSource.getRepository(ChatbotFlowState);
      const state = await stateRepo.findOne({ where: { conversation_id: conversationId } });

      if (state) {
        // Republished flow: keep the customer going if their node still exists.
        const flow = flows.find((f) => f.id === state.flow_id);
        const node = flow ? findNode(flow.graph, state.node_id) : null;
        if (flow && node && node.type === 'message') {
          const handle = matchBranch(flow.graph, node, text);
          const target = handle ? followBranch(flow.graph, node, handle) : null;
          if (target) return await this.runFrom(flow, target, config);
        }
        // Customer left the flow, button not connected, or the flow changed underneath.
        await stateRepo.delete({ conversation_id: conversationId });
      }

      for (const flow of flows) {
        const start = startNode(flow.graph);
        if ((start?.data.keywords || []).some((k) => textHasKeyword(text, k))) {
          return await this.runFrom(flow, start, config);
        }
      }
      return null;
    } catch (e: any) {
      this.logger.warn(`flow handleText failed: ${e?.message}`);
      return null;
    }
  }

  /** Customer escalated / complained: stop any running flow. */
  async clearState(conversationId: string) {
    try {
      await this.dataSource.getRepository(ChatbotFlowState).delete({ conversation_id: conversationId });
    } catch (e: any) {
      this.logger.warn(`flow clearState failed: ${e?.message}`);
    }
  }

  /** Persist the flow position inside the caller's transaction. */
  async applyState(mgr: EntityManager, conversationId: string, turn: FlowTurn) {
    if (turn.next_node_id) {
      await mgr.save(ChatbotFlowState, {
        conversation_id: conversationId,
        flow_id: turn.flow_id,
        flow_version: turn.flow_version,
        node_id: turn.next_node_id,
      });
    } else {
      await mgr.delete(ChatbotFlowState, { conversation_id: conversationId });
    }
  }

  private async runFrom(flow: PublishedFlow, from: FlowNode | null, config: any): Promise<FlowTurn | null> {
    const step = await walkFlow(flow.graph, from, (topic) => this.knowledgeAnswer(topic));
    const text = step.texts.map((t) => this.render(t, config)).filter(Boolean).join('\n\n');
    if (!text) return null;
    let payload: any = null;
    if (step.waitNode) {
      payload = {
        type: 'quick_replies',
        flow_id: flow.id,
        node_id: step.waitNode.id,
        buttons: (step.waitNode.data.buttons || []).map((b) => ({ id: b.id, label: b.label })),
      };
    } else if (step.handoff) {
      payload = { type: 'handoff_suggest', reason: 'flow' };
    }
    return {
      flow_id: flow.id,
      flow_version: flow.version,
      node_ids: step.visited,
      text,
      payload,
      next_node_id: step.waitNode ? step.waitNode.id : null,
    };
  }

  private async knowledgeAnswer(topic: string): Promise<string | null> {
    const item = await this.dataSource.getRepository(ChatbotKnowledgeItem).findOne({
      where: { topic, status: 'published', public_allowed: true },
      order: { version: 'DESC' },
    });
    return item?.answer || null;
  }

  private render(template: string, config: any): string {
    return renderTemplate(template, {
      short_name: config?.short_name || CHATBOT_DEFAULTS.short_name,
      display_name: config?.display_name || CHATBOT_DEFAULTS.display_name,
      hotline: config?.contact_channels?.hotline || '',
      email_public: config?.contact_channels?.email_public || '',
      zalo_url: config?.contact_channels?.zalo_url || '',
      working_hours_text: 'T2–T6 08:00–17:30, T7 08:00–12:00',
    });
  }
}
