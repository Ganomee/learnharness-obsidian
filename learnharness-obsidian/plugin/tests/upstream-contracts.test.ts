import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createTree, emptyTree, PlanTreeError } from '../../upstream/learnharness/src/core/plan-tree.ts';
import { phaseAt3, phaseAt3Lh, phaseTimeline, teachStepIndex } from '../../upstream/learnharness/src/core/phases.ts';
import { ToolCallIdUniquifier, collectToolCallIds } from '../../upstream/learnharness/src/server/pi/call-ids.ts';

// Fixtures are structural protocol inputs, not a replacement runtime or an LLM.
const nodes = () => [{ id: 'fraction', title: 'Fractions' }, { id: 'conditional', title: 'Conditional probability' }, { id: 'bayes', title: 'Bayes rule' }];
const edges = () => [{ from: 'fraction', to: 'conditional' }, { from: 'conditional', to: 'bayes' }];
const assistant = (callId: string) => ({ role: 'assistant', content: [{ type: 'toolCall', id: callId, name: 'quiz', arguments: { nodeId: 'bayes' } }] });
const result = (callId: string) => ({ role: 'toolResult', toolCallId: callId, toolName: 'quiz', content: [{ type: 'text', text: 'learner answer' }], isError: false });

test('plan preserves prerequisite direction, input order and initial version without aliasing inputs', () => {
  const inputNodes = nodes(); const inputEdges = edges();
  const tree = createTree(inputNodes, inputEdges);
  assert.deepEqual(emptyTree(), { nodes: [], edges: [], version: 0 });
  assert.deepEqual(tree, { nodes: nodes(), edges: edges(), version: 1 });
  inputNodes[0]!.title = 'changed'; inputEdges[0]!.to = 'bayes';
  assert.equal(tree.nodes[0]!.title, 'Fractions');
  assert.deepEqual(tree.edges, edges());
});

test('plan rejects cycles, missing prerequisites, duplicate nodes, duplicate edges and self loops', () => {
  for (const badEdges of [
    [...edges(), { from: 'bayes', to: 'fraction' }],
    [{ from: 'absent', to: 'bayes' }],
    [...edges(), edges()[0]!],
    [{ from: 'bayes', to: 'bayes' }],
  ]) assert.throws(() => createTree(nodes(), badEdges), PlanTreeError);
  assert.throws(() => createTree([...nodes(), nodes()[0]!], []), PlanTreeError);
});

test('view phase requires successful probe completion then a tagged teaching call', () => {
  const messages = [
    { parts: [{ type: 'tool-quiz', input: { nodeId: 'bayes' } }] },
    { parts: [{ type: 'tool-probe_done', state: 'output-error' }] },
    { parts: [{ type: 'tool-probe_done', state: 'output-available' }] },
    { parts: [{ type: 'tool-quiz', input: {} }] },
    { parts: [{ type: 'tool-quiz', input: { nodeId: 'bayes' }, state: 'input-available' }] },
  ];
  assert.deepEqual(phaseTimeline(messages), ['probe', 'probe', 'plan', 'plan', 'teach']);
  assert.equal(phaseAt3(messages, 3), 'plan');
  assert.equal(phaseAt3(messages), 'teach');
});

test('native phase does not advance on a call or errored result and teaching starts before its answer', () => {
  const messages: any[] = [
    { role: 'assistant', content: [{ type: 'toolCall', id: 'done', name: 'probe_done', arguments: {} }] },
    { role: 'toolResult', toolCallId: 'done', toolName: 'probe_done', isError: true, content: [] },
    { role: 'toolResult', toolCallId: 'done-retry', toolName: 'probe_done', isError: false, content: [] },
    { role: 'assistant', content: [{ type: 'toolCall', id: 'quiz-probe', name: 'quiz', arguments: {} }] },
    { role: 'assistant', content: [{ type: 'toolCall', id: 'explain', name: 'explain', arguments: { nodeId: 'bayes' } }] },
  ];
  assert.deepEqual(messages.map((_, i) => phaseAt3Lh(messages, i)), ['probe', 'probe', 'plan', 'plan', 'teach']);
  assert.equal(phaseAt3Lh([]), 'probe');
});

test('teaching divider preserves earlier plan presentation in the same assistant message', () => {
  assert.equal(teachStepIndex([
    { type: 'step-start' }, { type: 'text' }, { type: 'step-start' },
    { type: 'tool-explain', input: { nodeId: 'bayes' } },
  ]), 2);
  assert.equal(teachStepIndex([{ type: 'tool-quiz', input: { nodeId: 'bayes' } }]), -1);
});

// Adversarial discovery: accepting an empty tag silently advances phase and
// moves the divider even though no plan node is identified by the question.
test('empty node identity cannot start teaching or move its divider', () => {
  for (const tool of ['quiz', 'explain']) {
    const view = [
      { parts: [{ type: 'tool-probe_done', state: 'output-available' }] },
      { parts: [{ type: `tool-${tool}`, input: { nodeId: '' } }] },
    ];
    assert.equal(phaseAt3(view), 'plan');
    assert.deepEqual(phaseTimeline(view), ['plan', 'plan']);
    const native: any[] = [
      { role: 'toolResult', toolCallId: 'done', toolName: 'probe_done', isError: false, content: [] },
      { role: 'assistant', content: [{ type: 'toolCall', id: 'empty', name: tool, arguments: { nodeId: '' } }] },
    ];
    assert.equal(phaseAt3Lh(native), 'plan');
    assert.equal(teachStepIndex([
      { type: 'step-start' }, { type: 'text' }, { type: 'step-start' },
      { type: `tool-${tool}`, input: { nodeId: '' } },
    ]), -1);
  }
});

test('collects call and result identities while ignoring user text and malformed blocks', () => {
  assert.deepEqual(collectToolCallIds([
    assistant('call_0'), result('call_0'),
    { role: 'user', content: 'call_fake' },
    { role: 'assistant', content: [{ type: 'text', text: 'call_fake' }, { type: 'toolCall', id: 7 }] },
  ]), ['call_0', 'call_0']);
});

test('colliding IDs remain paired in streamed events and settled records without rewriting history', () => {
  const historyCall = assistant('call_0'); const historyResult = result('call_0');
  const current = assistant('call_0'); const currentResult = result('call_0');
  const u = new ToolCallIdUniquifier(['call_0', 'call_0~2']);
  for (const type of ['message_start', 'message_update', 'message_end']) {
    const event: any = u.event({ type, message: current } as any);
    assert.equal(event.message.content[0].id, 'call_0~3');
  }
  const execution: any = u.event({ type: 'tool_execution_end', toolCallId: 'call_0', toolName: 'quiz', result: {}, isError: false } as any);
  assert.equal(execution.toolCallId, 'call_0~3');
  const settled: any[] = u.remapSettled([historyCall, historyResult, current, currentResult]);
  assert.equal(settled[0], historyCall); assert.equal(settled[1], historyResult);
  assert.equal(settled[2].content[0].id, 'call_0~3');
  assert.equal(settled[3].toolCallId, 'call_0~3');
  assert.equal(settled[3].content[0].text, 'learner answer');
  assert.equal(current.content[0]!.id, 'call_0');
  assert.equal(currentResult.toolCallId, 'call_0');
});

test('repeated provider IDs in later assistant messages receive distinct call/result pairs', () => {
  const u = new ToolCallIdUniquifier(['call_0']);
  const first = assistant('call_0'); const second = assistant('call_0');
  for (const message of [first, second]) {
    u.event({ type: 'message_start', message } as any);
    u.event({ type: 'message_end', message } as any);
  }
  const settled: any[] = u.remapSettled([first, result('call_0'), second, result('call_0')]);
  assert.deepEqual([settled[0].content[0].id, settled[1].toolCallId, settled[2].content[0].id, settled[3].toolCallId], ['call_0~2', 'call_0~2', 'call_0~3', 'call_0~3']);
});

test('turn_end and agent_end preserve the same identity mapping as streaming', () => {
  const u = new ToolCallIdUniquifier(['call_0']); const message = assistant('call_0');
  u.event({ type: 'message_start', message } as any);
  const turn: any = u.event({ type: 'turn_end', message, toolResults: [result('call_0')] } as any);
  assert.equal(turn.message.content[0].id, 'call_0~2');
  assert.equal(turn.toolResults[0].toolCallId, 'call_0~2');
  const end: any = u.event({ type: 'agent_end', messages: [message, result('call_0')] } as any);
  assert.equal(end.messages[0].content[0].id, 'call_0~2');
  assert.equal(end.messages[1].toolCallId, 'call_0~2');
});
