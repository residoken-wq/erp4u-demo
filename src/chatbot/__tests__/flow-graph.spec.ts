import { validateFlowGraph, walkFlow, matchBranch, followBranch, startNode, findNode, hasErrors, textHasKeyword } from '../flow/flow-graph';

const sample = () => ({
  nodes: [
    { id: 'start', type: 'start', position: { x: 0, y: 0 }, data: { start_actions: ['school'], keywords: ['báo giá'] } },
    {
      id: 'ask',
      type: 'message',
      data: {
        text: 'Trường mình cần gì ạ?',
        buttons: [
          { id: 'b_nem', label: 'Nệm', keywords: ['nệm', 'nem ngu'] },
          { id: 'b_goi', label: 'Gối' },
        ],
      },
    },
    { id: 'kb', type: 'knowledge', data: { topic: 'faq.care', fallback_text: 'Dự phòng' } },
    { id: 'goi', type: 'message', data: { text: 'Gối cho bé mấy tuổi ạ?' } },
    { id: 'other', type: 'handoff', data: { text: 'Em chuyển nhân viên ạ.' } },
    { id: 'done', type: 'end', data: { text: 'Cảm ơn ạ.' } },
  ],
  edges: [
    { id: 'e1', source: 'start', sourceHandle: 'next', target: 'ask' },
    { id: 'e2', source: 'ask', sourceHandle: 'b_nem', target: 'kb' },
    { id: 'e3', source: 'ask', sourceHandle: 'b_goi', target: 'goi' },
    { id: 'e4', source: 'ask', sourceHandle: 'other', target: 'other' },
    { id: 'e5', source: 'kb', sourceHandle: 'next', target: 'done' },
    { id: 'e6', source: 'goi', sourceHandle: 'next', target: 'done' },
  ],
});

describe('flow-graph validate', () => {
  it('accepts a well-formed graph', () => {
    const { issues } = validateFlowGraph(sample());
    expect(hasErrors(issues)).toBe(false);
  });

  it('requires exactly one start with a trigger and connection', () => {
    const g = sample();
    g.nodes[0].data = { start_actions: [], keywords: [] } as any;
    g.edges = g.edges.filter((e) => e.source !== 'start');
    const codes = validateFlowGraph(g).issues.map((i) => i.code);
    expect(codes).toEqual(expect.arrayContaining(['START_NO_TRIGGER', 'START_UNCONNECTED']));
  });

  it('rejects edges from terminal nodes, duplicate handles and dangling targets', () => {
    const g = sample();
    g.edges.push({ id: 'x1', source: 'done', sourceHandle: 'next', target: 'ask' });
    g.edges.push({ id: 'x2', source: 'ask', sourceHandle: 'b_nem', target: 'goi' });
    g.edges.push({ id: 'x3', source: 'kb', sourceHandle: 'next', target: 'missing' });
    const codes = validateFlowGraph(g).issues.map((i) => i.code);
    expect(codes).toEqual(expect.arrayContaining(['EDGE_FROM_TERMINAL', 'EDGE_HANDLE_DUPLICATE', 'EDGE_DANGLING']));
  });

  it('warns on unreachable nodes and unconnected buttons', () => {
    const g = sample();
    g.edges = g.edges.filter((e) => e.id !== 'e3' && e.id !== 'e6');
    const issues = validateFlowGraph(g).issues;
    expect(issues.filter((i) => i.level === 'warning').map((i) => i.code)).toEqual(
      expect.arrayContaining(['UNREACHABLE', 'BUTTON_UNCONNECTED']),
    );
    expect(hasErrors(issues)).toBe(false);
  });

  it('drops unknown start actions and strips junk', () => {
    const g = sample();
    (g.nodes[0].data as any).start_actions = ['school', 'hack'];
    (g.nodes[0] as any).evil = '<script>';
    const { graph } = validateFlowGraph(g);
    expect(graph.nodes[0].data.start_actions).toEqual(['school']);
    expect((graph.nodes[0] as any).evil).toBeUndefined();
  });
});

describe('flow-graph runtime', () => {
  const { graph } = validateFlowGraph(sample());

  it('walks from start to the first waiting node', async () => {
    const step = await walkFlow(graph, startNode(graph), async () => null);
    expect(step.texts).toEqual(['Trường mình cần gì ạ?']);
    expect(step.waitNode?.id).toBe('ask');
  });

  it('matches button label exactly, then keywords, then other', () => {
    const ask = findNode(graph, 'ask')!;
    expect(matchBranch(graph, ask, 'gối')).toBe('b_goi');
    expect(matchBranch(graph, ask, 'Cho mình hỏi nem ngu cho truong')).toBe('b_nem');
    expect(matchBranch(graph, ask, 'xin chào')).toBe('other');
  });

  it('returns null when no other branch exists', () => {
    const g = sample();
    g.edges = g.edges.filter((e) => e.sourceHandle !== 'other');
    const v = validateFlowGraph(g).graph;
    expect(matchBranch(v, findNode(v, 'ask')!, 'xin chào')).toBeNull();
  });

  it('uses knowledge answer, falls back, and chains to end', async () => {
    const ask = findNode(graph, 'ask')!;
    const kb = followBranch(graph, ask, 'b_nem');
    const withKb = await walkFlow(graph, kb, async () => 'Giặt máy được ạ');
    expect(withKb.texts).toEqual(['Giặt máy được ạ', 'Cảm ơn ạ.']);
    expect(withKb.waitNode).toBeNull();
    const noKb = await walkFlow(graph, kb, async () => null);
    expect(noKb.texts[0]).toBe('Dự phòng');
  });

  it('flags handoff', async () => {
    const step = await walkFlow(graph, findNode(graph, 'other'), async () => null);
    expect(step.handoff).toBe(true);
  });

  it('stops on loops', async () => {
    const loop = validateFlowGraph({
      nodes: [
        { id: 's', type: 'start', data: { keywords: ['x'] } },
        { id: 'a', type: 'knowledge', data: { topic: 't', fallback_text: 'a' } },
        { id: 'b', type: 'knowledge', data: { topic: 't', fallback_text: 'b' } },
      ],
      edges: [
        { id: '1', source: 's', target: 'a' },
        { id: '2', source: 'a', target: 'b' },
        { id: '3', source: 'b', target: 'a' },
      ],
    }).graph;
    const step = await walkFlow(loop, startNode(loop), async () => null);
    expect(step.visited.length).toBeLessThanOrEqual(10);
  });

  it('keyword match is whole-word and accent-insensitive', () => {
    expect(textHasKeyword('Báo giá nệm giúp em', 'bao gia')).toBe(true);
    expect(textHasKeyword('baogia', 'bao gia')).toBe(false);
    expect(textHasKeyword('nem', 'nệm')).toBe(true);
    expect(textHasKeyword('nemo', 'nệm')).toBe(false);
  });
});
