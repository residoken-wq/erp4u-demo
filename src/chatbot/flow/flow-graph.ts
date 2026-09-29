import { normalizeVi } from '../security/pii';

/**
 * Chatbot conversation flow ("sơ đồ kịch bản") — pure graph helpers.
 * A flow is a directed graph edited in the CMS. The runtime walks it one customer turn at a time:
 * message nodes with buttons wait for the customer; everything else is followed automatically.
 */

export type FlowNodeType = 'start' | 'message' | 'knowledge' | 'handoff' | 'end';

export const START_ACTIONS = ['school', 'parent', 'sample', 'support'] as const;

export interface FlowButton {
  id: string;
  label: string;
  keywords?: string[];
}

export interface FlowNode {
  id: string;
  type: FlowNodeType;
  position?: { x: number; y: number };
  data: {
    // start
    start_actions?: string[];
    keywords?: string[];
    // message / handoff / end
    text?: string;
    buttons?: FlowButton[];
    // knowledge
    topic?: string;
    fallback_text?: string;
  };
}

export interface FlowEdge {
  id: string;
  source: string;
  /** 'next' | button id | 'other' */
  sourceHandle?: string | null;
  target: string;
}

export interface FlowGraph {
  nodes: FlowNode[];
  edges: FlowEdge[];
}

export const EMPTY_GRAPH: FlowGraph = { nodes: [], edges: [] };

export const FLOW_LIMITS = {
  max_nodes: 200,
  max_edges: 400,
  max_buttons: 6,
  max_label: 40,
  max_text: 1000,
  max_keywords: 20,
  max_keyword_len: 60,
  max_steps: 10,
};

const NODE_TYPES: FlowNodeType[] = ['start', 'message', 'knowledge', 'handoff', 'end'];
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

export interface FlowIssue {
  level: 'error' | 'warning';
  code: string;
  node_id?: string;
  message: string;
}

/** Validate graph shape. Errors block publish; warnings are shown only. */
export function validateFlowGraph(input: any): { graph: FlowGraph; issues: FlowIssue[] } {
  const issues: FlowIssue[] = [];
  const err = (code: string, message: string, node_id?: string) => issues.push({ level: 'error', code, message, node_id });
  const warn = (code: string, message: string, node_id?: string) => issues.push({ level: 'warning', code, message, node_id });

  if (!input || typeof input !== 'object' || !Array.isArray(input.nodes) || !Array.isArray(input.edges)) {
    err('GRAPH_INVALID', 'Sơ đồ phải có nodes[] và edges[]');
    return { graph: { nodes: [], edges: [] }, issues };
  }
  if (input.nodes.length > FLOW_LIMITS.max_nodes) err('TOO_MANY_NODES', `Tối đa ${FLOW_LIMITS.max_nodes} bước`);
  if (input.edges.length > FLOW_LIMITS.max_edges) err('TOO_MANY_EDGES', `Tối đa ${FLOW_LIMITS.max_edges} liên kết`);

  const nodes: FlowNode[] = [];
  const ids = new Set<string>();
  for (const raw of input.nodes.slice(0, FLOW_LIMITS.max_nodes)) {
    const id = String(raw?.id ?? '');
    const type = raw?.type as FlowNodeType;
    if (!ID_RE.test(id)) { err('NODE_ID_INVALID', `Mã bước không hợp lệ: "${id.slice(0, 64)}"`); continue; }
    if (ids.has(id)) { err('NODE_ID_DUPLICATE', `Trùng mã bước ${id}`, id); continue; }
    if (!NODE_TYPES.includes(type)) { err('NODE_TYPE_INVALID', `Loại bước không hợp lệ: ${String(type).slice(0, 20)}`, id); continue; }
    ids.add(id);
    const d = raw?.data && typeof raw.data === 'object' ? raw.data : {};
    const node: FlowNode = {
      id,
      type,
      position: {
        x: Number.isFinite(Number(raw?.position?.x)) ? Math.round(Number(raw.position.x)) : 0,
        y: Number.isFinite(Number(raw?.position?.y)) ? Math.round(Number(raw.position.y)) : 0,
      },
      data: {},
    };

    const cleanKeywords = (arr: any): string[] =>
      (Array.isArray(arr) ? arr : [])
        .map((k: any) => String(k ?? '').trim().slice(0, FLOW_LIMITS.max_keyword_len))
        .filter(Boolean)
        .slice(0, FLOW_LIMITS.max_keywords);

    if (type === 'start') {
      node.data.start_actions = (Array.isArray(d.start_actions) ? d.start_actions : [])
        .map((a: any) => String(a))
        .filter((a: string) => (START_ACTIONS as readonly string[]).includes(a));
      node.data.keywords = cleanKeywords(d.keywords);
    }
    if (type === 'message' || type === 'handoff' || type === 'end') {
      const text = String(d.text ?? '').trim();
      if (text.length > FLOW_LIMITS.max_text) err('TEXT_TOO_LONG', `Nội dung tối đa ${FLOW_LIMITS.max_text} ký tự`, id);
      if (!text && type !== 'end') err('TEXT_REQUIRED', 'Bước này cần nội dung trả lời', id);
      node.data.text = text.slice(0, FLOW_LIMITS.max_text);
    }
    if (type === 'message') {
      const buttons: FlowButton[] = [];
      const bIds = new Set<string>();
      const rawButtons = Array.isArray(d.buttons) ? d.buttons : [];
      if (rawButtons.length > FLOW_LIMITS.max_buttons) err('TOO_MANY_BUTTONS', `Tối đa ${FLOW_LIMITS.max_buttons} nút`, id);
      for (const b of rawButtons.slice(0, FLOW_LIMITS.max_buttons)) {
        const bid = String(b?.id ?? '');
        const label = String(b?.label ?? '').trim();
        if (!ID_RE.test(bid) || bid === 'next' || bid === 'other') { err('BUTTON_ID_INVALID', 'Mã nút không hợp lệ', id); continue; }
        if (bIds.has(bid)) { err('BUTTON_ID_DUPLICATE', `Trùng mã nút ${bid}`, id); continue; }
        if (!label) { err('BUTTON_LABEL_REQUIRED', 'Nút cần có chữ hiển thị', id); continue; }
        if (label.length > FLOW_LIMITS.max_label) err('BUTTON_LABEL_TOO_LONG', `Chữ trên nút tối đa ${FLOW_LIMITS.max_label} ký tự`, id);
        bIds.add(bid);
        buttons.push({ id: bid, label: label.slice(0, FLOW_LIMITS.max_label), keywords: cleanKeywords(b?.keywords) });
      }
      node.data.buttons = buttons;
    }
    if (type === 'knowledge') {
      const topic = String(d.topic ?? '').trim().slice(0, 80);
      if (!topic) err('TOPIC_REQUIRED', 'Bước tri thức cần chọn chủ đề (topic)', id);
      node.data.topic = topic;
      const fb = String(d.fallback_text ?? '').trim();
      if (fb.length > FLOW_LIMITS.max_text) err('TEXT_TOO_LONG', `Nội dung tối đa ${FLOW_LIMITS.max_text} ký tự`, id);
      node.data.fallback_text = fb.slice(0, FLOW_LIMITS.max_text);
    }
    nodes.push(node);
  }

  const byId = new Map(nodes.map((n) => [n.id, n]));
  const edges: FlowEdge[] = [];
  const handleUsed = new Set<string>();
  for (const raw of input.edges.slice(0, FLOW_LIMITS.max_edges)) {
    const source = String(raw?.source ?? '');
    const target = String(raw?.target ?? '');
    const handle = raw?.sourceHandle ? String(raw.sourceHandle) : 'next';
    const src = byId.get(source);
    if (!src || !byId.has(target)) { err('EDGE_DANGLING', 'Liên kết trỏ tới bước không tồn tại'); continue; }
    if (byId.get(target)!.type === 'start') { err('EDGE_TO_START', 'Không được nối vào bước Bắt đầu', source); continue; }
    if (src.type === 'handoff' || src.type === 'end') { err('EDGE_FROM_TERMINAL', 'Bước kết thúc/chuyển nhân viên không có nhánh ra', source); continue; }
    const validHandles = allowedHandles(src);
    if (!validHandles.includes(handle)) { err('EDGE_HANDLE_INVALID', 'Nhánh ra không hợp lệ', source); continue; }
    const key = `${source}:${handle}`;
    if (handleUsed.has(key)) { err('EDGE_HANDLE_DUPLICATE', 'Một nhánh chỉ được nối tới 1 bước', source); continue; }
    handleUsed.add(key);
    edges.push({ id: String(raw?.id ?? key).slice(0, 100), source, sourceHandle: handle, target });
  }

  const starts = nodes.filter((n) => n.type === 'start');
  if (starts.length !== 1) err('START_COUNT', 'Sơ đồ phải có đúng 1 bước Bắt đầu');
  const start = starts[0];
  if (start) {
    if (!handleUsed.has(`${start.id}:next`)) err('START_UNCONNECTED', 'Bước Bắt đầu chưa nối tới bước nào', start.id);
    if (!start.data.start_actions?.length && !start.data.keywords?.length) {
      err('START_NO_TRIGGER', 'Bước Bắt đầu cần ít nhất 1 nút khởi động hoặc 1 từ khoá', start.id);
    }
    // Reachability
    const seen = new Set<string>([start.id]);
    const queue = [start.id];
    while (queue.length) {
      const cur = queue.shift()!;
      for (const e of edges) if (e.source === cur && !seen.has(e.target)) { seen.add(e.target); queue.push(e.target); }
    }
    for (const n of nodes) if (!seen.has(n.id)) warn('UNREACHABLE', 'Bước này không nối từ Bắt đầu, khách sẽ không bao giờ tới', n.id);
  }
  for (const n of nodes) {
    if (n.type === 'message') {
      for (const b of n.data.buttons || []) {
        if (!handleUsed.has(`${n.id}:${b.id}`)) warn('BUTTON_UNCONNECTED', `Nút "${b.label}" chưa nối — bấm vào sẽ kết thúc kịch bản`, n.id);
      }
    }
  }

  return { graph: { nodes, edges }, issues };
}

export function allowedHandles(node: FlowNode): string[] {
  if (node.type === 'start' || node.type === 'knowledge') return ['next'];
  if (node.type === 'message') {
    const buttons = node.data.buttons || [];
    return buttons.length ? [...buttons.map((b) => b.id), 'other'] : ['next'];
  }
  return [];
}

export function hasErrors(issues: FlowIssue[]): boolean {
  return issues.some((i) => i.level === 'error');
}

function nextOf(graph: FlowGraph, nodeId: string, handle: string): FlowNode | null {
  const e = graph.edges.find((x) => x.source === nodeId && (x.sourceHandle || 'next') === handle);
  if (!e) return null;
  return graph.nodes.find((n) => n.id === e.target) || null;
}

export interface WalkStep {
  texts: string[];
  /** Node waiting for the customer (message with buttons), or null when the flow ended. */
  waitNode: FlowNode | null;
  handoff: boolean;
  visited: string[];
}

/**
 * Walk from `from` (inclusive) until a node that waits for input, or the flow ends.
 * `resolveKnowledge` returns the published answer for a topic (or null).
 */
export async function walkFlow(
  graph: FlowGraph,
  from: FlowNode | null,
  resolveKnowledge: (topic: string) => Promise<string | null>,
): Promise<WalkStep> {
  const out: WalkStep = { texts: [], waitNode: null, handoff: false, visited: [] };
  let cur = from;
  let steps = 0;
  while (cur && steps < FLOW_LIMITS.max_steps) {
    steps++;
    out.visited.push(cur.id);
    if (cur.type === 'start') {
      cur = nextOf(graph, cur.id, 'next');
      continue;
    }
    if (cur.type === 'message') {
      if (cur.data.text) out.texts.push(cur.data.text);
      if (cur.data.buttons && cur.data.buttons.length) {
        out.waitNode = cur;
        return out;
      }
      cur = nextOf(graph, cur.id, 'next');
      continue;
    }
    if (cur.type === 'knowledge') {
      const ans = cur.data.topic ? await resolveKnowledge(cur.data.topic) : null;
      const text = ans || cur.data.fallback_text || '';
      if (text) out.texts.push(text);
      cur = nextOf(graph, cur.id, 'next');
      continue;
    }
    if (cur.type === 'handoff') {
      if (cur.data.text) out.texts.push(cur.data.text);
      out.handoff = true;
      return out;
    }
    // end
    if (cur.data.text) out.texts.push(cur.data.text);
    return out;
  }
  return out;
}

function padNorm(s: string): string {
  return ` ${normalizeVi(s).replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim()} `;
}

/** Whole-word (after VN normalisation) keyword containment. */
export function textHasKeyword(text: string, keyword: string): boolean {
  const k = padNorm(keyword).trim();
  if (!k) return false;
  return padNorm(text).includes(` ${k} `);
}

/**
 * Which branch does the customer's text take at a waiting node?
 * Returns the handle ('button id' | 'other') or null when the customer left the flow.
 */
export function matchBranch(graph: FlowGraph, node: FlowNode, text: string): string | null {
  const buttons = node.data.buttons || [];
  const t = padNorm(text).trim();
  const exact = buttons.find((b) => padNorm(b.label).trim() === t);
  if (exact) return exact.id;
  const kw = buttons.find((b) => (b.keywords || []).some((k) => textHasKeyword(text, k)));
  if (kw) return kw.id;
  if (graph.edges.some((e) => e.source === node.id && e.sourceHandle === 'other')) return 'other';
  return null;
}

export function findNode(graph: FlowGraph, id: string | null | undefined): FlowNode | null {
  if (!id) return null;
  return graph.nodes.find((n) => n.id === id) || null;
}

export function startNode(graph: FlowGraph): FlowNode | null {
  return graph.nodes.find((n) => n.type === 'start') || null;
}

/** Follow a branch from a waiting node. Unconnected button → null (flow ends). */
export function followBranch(graph: FlowGraph, node: FlowNode, handle: string): FlowNode | null {
  return nextOf(graph, node.id, handle);
}
