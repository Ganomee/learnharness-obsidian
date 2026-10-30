import assert from 'node:assert/strict';
import { test } from 'node:test';
import vm from 'node:vm';
import { createFauxCore, fauxAssistantMessage, fauxToolCall, fauxText } from '@earendil-works/pi-ai';
import { buildRuntime } from '../../scripts/build-runtime.mjs';
import { latestSessionEnvelope, MemoryVault } from './fixtures/memory-vault';
import { createDemoEngine } from '../src/adapters/demo-engine';

const bundled = await buildRuntime({ entryPoints: ['plugin/src/session-controller.ts'], write: false, format: 'iife', globalName: 'ControllerModule' });
const context: any = { crypto: globalThis.crypto, structuredClone, setTimeout, clearTimeout, queueMicrotask, AbortController, AbortSignal, TextEncoder, TextDecoder, ReadableStream, performance, console, URL, URLSearchParams };
vm.runInNewContext(bundled.outputFiles[0].text, context);
const Controller = context.ControllerModule.SessionController;
const QUESTION = { question: 'Which fraction equals one half?', options: [{ label: '1/2', value: 'half' }, { label: '1/3', value: 'third' }], correctAnswer: 'half', explanation: 'One of two equal parts.' };
const question = (id = 'probe_1') => fauxAssistantMessage([fauxToolCall('probe', QUESTION, { id })], { stopReason: 'toolUse' });
function engine(responses: any[]) {
  const faux = createFauxCore({}); let calls = 0;
  faux.setResponses(responses.map(response => async (ctx: any, ...args: any[]) => { calls++; return typeof response === 'function' ? response(ctx, ...args) : response; }));
  return { value: { model: faux.getModel(), streamFn: faux.streamSimple }, calls: () => calls };
}
function gate() { let release!: () => void; const promise = new Promise<void>(resolve => release = resolve); return { promise, release }; }

test('controller persists pending original question, recreates, grades and durably retains actual answer plus final reply', async () => {
  const vault = new MemoryVault(); const first = new Controller(vault); const opening = engine([question()]);
  const created = await first.createSession('Understand fractions', opening.value);
  assert.equal(created.pending.toolCallId, 'probe_1'); assert.equal(created.pending.tool, 'probe');
  assert.equal(created.question.kind, 'quiz'); assert.equal(created.question.options.length, 2);
  assert.equal('correctIndices' in created.question, false);
  assert.equal(created.record.messages.some((m: any) => m.role === 'toolResult' && m.toolCallId === 'probe_1'), false);
  first.dispose();
  const resumed = new Controller(vault); const loaded = await resumed.loadSession(created.id);
  assert.deepEqual(loaded.question, created.question);
  const response = engine([ctx => {
    const answer = ctx.messages.find((m: any) => m.role === 'toolResult' && m.toolCallId === 'probe_1');
    assert.ok(answer); assert.ok(JSON.stringify(answer.content).includes('1/2'));
    return fauxAssistantMessage([fauxText('Saved final adaptive reply.')]);
  }]);
  const answered = await resumed.answer(created.id, 'probe_1', { values: ['half'], thinking: 'two equal parts', confidence: 90 }, response.value);
  assert.equal(answered.pending, null); assert.equal(answered.status, 'idle');
  const actual = answered.record.messages.filter((m: any) => m.role === 'toolResult' && m.toolCallId === 'probe_1');
  assert.equal(actual.length, 1); assert.equal(actual[0].details.correct, true); assert.equal(actual[0].details.thinking, 'two equal parts');
  assert.equal(actual[0].details.confidence, 90);
  const reloaded = await new Controller(vault).loadSession(created.id);
  assert.equal(reloaded.record.messages.at(-1).content[0].text, 'Saved final adaptive reply.');
  assert.equal(reloaded.record.messages.filter((m: any) => m.role === 'user').length, 1);
  await assert.rejects(resumed.answer(created.id, 'probe_1', { values: ['half'] }, response.value), /no pending/);
});

test('write-ahead acknowledgement precedes engine dispatch and final acknowledgement precedes returned success', async () => {
  const vault = new MemoryVault(); const inputGate = gate(); const finalGate = gate(); const inputReached = gate(); const finalReached = gate();
  vault.beforeCreate = async (_p, _t, count) => { if (count === 2) { inputReached.release(); await inputGate.promise; } if (count === 3) { finalReached.release(); await finalGate.promise; } };
  const scripted = engine([question()]); let resolved = false;
  const pending = new Controller(vault).createSession('Fractions', scripted.value).then((r: any) => { resolved = true; return r; });
  await inputReached.promise; assert.equal(scripted.calls(), 0); assert.equal(resolved, false);
  inputGate.release(); await finalReached.promise; assert.equal(scripted.calls(), 1); assert.equal(resolved, false);
  finalGate.release(); const created = await pending; assert.equal(created.status, 'idle');
});

test('failed write-ahead invokes no provider and preserves file; failed final save reloads durable input for recovery', async () => {
  const inputVault = new MemoryVault(); inputVault.failCreateAt = 2; const never = engine([question()]);
  await assert.rejects(new Controller(inputVault).createSession('Fractions', never.value), /create failure/);
  assert.equal(never.calls(), 0); assert.equal(latestSessionEnvelope(inputVault).record.messages.length, 0);
  const vault = new MemoryVault(); vault.failCreateAt = 3; const first = engine([question()]);
  await assert.rejects(new Controller(vault).createSession('Fractions', first.value), /create failure/);
  const stored = latestSessionEnvelope(vault);
  assert.equal(stored.record.messages.length, 1); assert.equal(stored.status, 'running');
  const controller = new Controller(vault); const loaded = await controller.loadSession(stored.record.id); assert.equal(loaded.status, 'interrupted');
  vault.failModifyAt = -1; const recovery = engine([question()]);
  const recovered = await controller.continueSession(loaded.id, '', recovery.value);
  assert.equal(recovered.record.messages.filter((m: any) => m.role === 'user').length, 1);
  assert.equal(recovered.pending.toolCallId, 'probe_1');
});

test('same-facade controllers reject concurrent same-session operations across the full turn', async () => {
  const vault = new MemoryVault(); const first = new Controller(vault); const opening = await first.createSession('Fractions', engine([question()]).value);
  const wait = gate(); const reached = gate(); const delayed = engine([async () => { reached.release(); await wait.promise; return fauxAssistantMessage('response'); }]);
  const active = first.answer(opening.id, 'probe_1', { values: ['half'] }, delayed.value);
  await reached.promise;
  await assert.rejects(new Controller(vault).continueSession(opening.id, '', delayed.value), /already running/);
  wait.release(); await active;
});

test('wrong identity, pending text and provider mode mismatch reject before changing durable records', async () => {
  const vault = new MemoryVault(); const controller = new Controller(vault); const created = await controller.createSession('Fractions', engine([question()]).value, { providerMode: 'deepseek' });
  const before = [...vault.files.values()][0]; const never = engine([]);
  await assert.rejects(controller.answer(created.id, 'wrong', { values: ['half'] }, never.value), /no pending/);
  await assert.rejects(controller.continueSession(created.id, 'skip', never.value), /pending question/);
  await assert.rejects(controller.answer(created.id, 'probe_1', { values: ['half'] }, never.value, { providerMode: 'demo' }), /provider mode differs/);
  assert.equal([...vault.files.values()][0], before); assert.equal(never.calls(), 0);
  assert.equal((await new Controller(vault).loadSession(created.id)).providerMode, 'deepseek');
});

test('session controller durably shares and reloads provider reservations and charges', async () => {
  const vault = new MemoryVault(); const controller = new Controller(vault);
  const created = await controller.createSession('Synthetic budget lesson', engine([fauxAssistantMessage('Ready.')]).value, { providerMode: 'deepseek' });
  let reservationId = '';
  const result = await controller.withProviderBudget(created.id, async budget => {
    const reservation = await budget.reserve('{"messages":[]}', 128);
    reservationId = reservation.id;
    return budget.settle(reservation.id, { input: 100, output: 20 });
  });
  assert.equal(result.value, true);
  assert.equal(result.session.providerBudget.requestsStarted, 1);
  assert.equal(result.session.providerBudget.reservations.length, 0);
  assert.ok(result.session.providerBudget.spentMicros > 0);
  const reloaded = await new Controller(vault).loadSession(created.id);
  assert.deepEqual(reloaded.providerBudget, result.session.providerBudget);
  assert.ok(reservationId.length > 0);
  assert.ok([...vault.files.keys()].some(path => path.endsWith('.md') && path.includes(created.id)));
});

test('original ask text answer and dontKnow quiz answer use original answer records', async () => {
  const vault = new MemoryVault(); const controller = new Controller(vault);
  const asked = await controller.createSession('Goal', engine([fauxAssistantMessage([fauxToolCall('ask_user_question', { question: 'What is your goal?' }, { id: 'ask_1' })], { stopReason: 'toolUse' })]).value);
  assert.equal(asked.question.mode, 'text'); assert.equal(asked.question.kind, 'ask');
  const quiz = await controller.answer(asked.id, 'ask_1', { text: 'Understand fractions', thinking: 'start with halves' }, engine([question()]).value);
  const answered = await controller.answer(asked.id, 'probe_1', { dontKnow: true, thinking: 'uncertain' }, engine([fauxAssistantMessage('Let us inspect halves.')]).value);
  const results = answered.record.messages.filter((m: any) => m.role === 'toolResult');
  assert.equal(results[0].details.text, 'Understand fractions');
  assert.equal(results[1].details.dontKnow, true); assert.equal(results[1].details.correct, false);
});

test('successful original probe handoff persists the teacher plan and resumes its tagged questions', async () => {
  const vault = new MemoryVault(); const controller = new Controller(vault);
  const done = fauxAssistantMessage([fauxToolCall('probe_done', { assessment: { strands: [{ strand: 'fractions', assessment: 'knows halves' }], summary: 'ready for planning' } }, { id: 'done_1' })], { stopReason: 'toolUse' });
  const plan = fauxAssistantMessage([fauxToolCall('plan_init', { mermaid: 'graph TD\n  fractions[Fractions]\n  combine[Combine counts]\n  fractions --> combine' }, { id: 'plan_1' })], { stopReason: 'toolUse' });
  const created = await controller.createSession('Fractions', engine([done, fauxAssistantMessage('Assessment complete.'), plan, fauxAssistantMessage('Here is the learning path.')]).value);
  assert.equal(created.needsTeacher, false);
  assert.deepEqual(created.record.tree.nodes.map((node: any) => node.id), ['fractions', 'combine']);
  assert.ok(created.record.messages.some((m: any) => m.role === 'custom' && m.customType === 'probe-handoff'));
  assert.ok(created.record.messages.some((m: any) => m.role === 'toolResult' && m.toolName === 'probe_done' && m.details.ok === true));
  assert.ok(created.record.messages.some((m: any) => m.role === 'toolResult' && m.toolName === 'plan_init' && m.details.ok === true));

  const taggedQuiz = fauxAssistantMessage([fauxToolCall('quiz', { question: 'Why do the counts add?', options: [{ label: 'Groups are independent', value: 'independent' }, { label: 'Counts share the same denominator basis', value: 'counts' }], correctAnswer: 'counts', explanation: 'Add successes and attempts.', nodeId: 'combine', type: 'check' }, { id: 'teacher_quiz_1' })], { stopReason: 'toolUse' });
  const posed = await controller.continueSession(created.id, 'I accept the plan.', engine([taggedQuiz]).value);
  assert.equal(posed.pending.toolCallId, 'teacher_quiz_1'); assert.equal(posed.question.kind, 'quiz');
  const answered = await controller.answer(created.id, 'teacher_quiz_1', { values: ['counts'], thinking: 'Both groups measure the same outcome.' }, engine([fauxAssistantMessage('Exactly; now we can derive the combined rate.')]).value);
  assert.equal(answered.pending, null); assert.equal(answered.record.messages.at(-1).content[0].text, 'Exactly; now we can derive the combined rate.');
  assert.deepEqual(answered.record.tree.nodes.map((node: any) => node.id), ['fractions', 'combine']);
});

test('offline demo drives the original prober, automatic teacher plan, tagged quiz and saved answer', async () => {
  const vault = new MemoryVault(); const controller = new Controller(vault);
  const first = await controller.createSession('Weighted averages', createDemoEngine());
  assert.equal(first.pending.tool, 'probe');
  const assessed = await controller.answer(first.id, first.pending.toolCallId, { values: ['weighted'], thinking: 'Add the successes and denominators.' }, createDemoEngine());
  assert.equal(assessed.pending, null);
  assert.equal(assessed.needsTeacher, false);
  assert.deepEqual(assessed.record.tree.nodes.map((node: any) => node.id), ['denominator', 'combined-rate']);
  assert.ok(assessed.record.messages.some((message: any) => message.role === 'custom' && message.customType === 'probe-handoff'));
  const teacher = await controller.continueSession(first.id, 'I accept the plan.', createDemoEngine());
  assert.equal(teacher.pending.tool, 'quiz'); assert.equal(teacher.pending.input.nodeId, 'denominator'); assert.equal(teacher.pending.input.type, 'predict');
  const taught = await controller.answer(first.id, teacher.pending.toolCallId, { values: ['counts'], thinking: 'Keep successes and attempts.' }, createDemoEngine());
  assert.equal(taught.pending.tool, 'quiz'); assert.equal(taught.pending.input.nodeId, 'combined-rate'); assert.equal(taught.pending.input.type, 'check');
  assert.ok(taught.record.messages.some((message: any) => message.role === 'assistant' && message.content?.some((part: any) => part.type === 'text' && part.text.includes('add the successes'))));
  const complete = await controller.answer(first.id, taught.pending.toolCallId, { values: ['denominators'], thinking: 'The larger group has more attempts.' }, createDemoEngine());
  assert.equal(complete.pending, null);
  assert.ok(complete.record.messages.at(-1).content[0].text.includes('Scripted exercise complete'));
  assert.equal(complete.record.messages.filter((message: any) => message.role === 'toolResult' && message.details?.kind).length, 3);
});

test('dispose cancels a running original agent and durable saved state reports interruption', async () => {
  const vault = new MemoryVault(); const controller = new Controller(vault); const reached = gate();
  const scripted = engine([async (_ctx, options) => { reached.release(); await new Promise(resolve => options.signal.addEventListener('abort', resolve, { once: true })); return fauxAssistantMessage('aborted'); }]);
  const running = controller.createSession('Fractions', scripted.value);
  await reached.promise; controller.dispose();
  await assert.rejects(running, /interrupted/);
  const state = latestSessionEnvelope(vault); assert.equal(state.status, 'interrupted');
  assert.equal(state.record.messages.filter((m: any) => m.role === 'user').length, 1);
});

test('unload during final Vault acknowledgement never returns a late success', async () => {
  const vault = new MemoryVault(); const reached = gate(); const release = gate();
  vault.beforeCreate = async (_path, _text, count) => { if (count === 3) { reached.release(); await release.promise; } };
  const controller = new Controller(vault);
  const running = controller.createSession('Fractions', engine([question()]).value);
  await reached.promise; controller.dispose(); release.release();
  await assert.rejects(running, /interrupted/);
  // The final write completed, so a fresh controller can load its real state.
  const saved = latestSessionEnvelope(vault);
  assert.equal((await new Controller(vault).loadSession(saved.record.id)).pending.toolCallId, 'probe_1');
});
