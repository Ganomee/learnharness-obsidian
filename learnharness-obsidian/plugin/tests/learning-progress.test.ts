import assert from 'node:assert/strict';
import { test } from 'node:test';
import { answerFeedback, deriveLearningProgress, phaseLabel, planNodeProgress } from '../src/ui/learning-progress';

let nextAssistantId = 0;
const assistant = (...content: unknown[]) => ({ role: 'assistant', content, id: `a${++nextAssistantId}` }) as any;
const call = (id: string, name: string, args: unknown = {}) => ({ type: 'toolCall', id, name, arguments: args });
const result = (id: string, toolName: string, details: unknown, isError = false) => ({ role: 'toolResult', toolCallId: id, toolName, details, isError, id: `r-${id}` }) as any;
const tree = { nodes: [{ id: 'base', title: 'Start from the groups' }, { id: 'weight', title: 'Weight by group size' }], edges: [{ from: 'base', to: 'weight' }], version: 1 };

test('adaptive progress follows original probe_done and tagged-teaching phase boundaries', () => {
  const probing = [assistant(call('p1', 'probe'))] as any[];
  assert.equal(deriveLearningProgress(probing).phase, 'probe');
  const planning = [...probing, result('p1', 'probe', { kind: 'quiz', correct: true }), result('done', 'probe_done', { kind: 'ok' })];
  assert.equal(deriveLearningProgress(planning).phase, 'plan');
  const teaching = [...planning, assistant(call('q1', 'quiz', { nodeId: 'base' }))];
  assert.equal(deriveLearningProgress(teaching, tree).phase, 'teach');
  assert.equal(phaseLabel('teach'), 'Learning and checking each step');
});

test('probe and graded answer counts ignore pending, unrelated and failed calls', () => {
  const messages = [
    assistant(call('p1', 'probe'), call('p2', 'recall'), call('q1', 'quiz', { nodeId: 'base' }), call('bad', 'quiz')),
    result('p1', 'probe', { kind: 'quiz', correct: false }),
    result('p2', 'recall', { kind: 'explain' }, true),
    result('q1', 'quiz', { kind: 'quiz', correct: true }),
    result('bad', 'quiz', undefined, true),
  ] as any[];
  const progress = deriveLearningProgress(messages, tree);
  assert.equal(progress.probeAsked, 2);
  assert.equal(progress.probeAnswered, 1);
  assert.equal(progress.checksAnswered, 1);
  assert.equal(progress.checksCorrect, 1);
});

test('plan path statuses match original teacher-call semantics, not a mastery score', () => {
  const messages = [assistant(call('q1', 'quiz', { nodeId: 'base' }), call('q2', 'quiz', { nodeId: 'weight' }))] as any[];
  const progress = deriveLearningProgress(messages, tree);
  assert.deepEqual(planNodeProgress(tree, progress).map(node => [node.id, node.status]), [['base', 'visited'], ['weight', 'current']]);
  const untouched = deriveLearningProgress([], tree);
  assert.ok(planNodeProgress(tree, untouched).every(node => node.status === 'upcoming'));
});

test('answer feedback identifies correct and incorrect quiz choices and preserves confidence/reasoning', () => {
  const feedback = answerFeedback({ kind: 'quiz', correct: false, confidence: 80, thinking: 'I guessed based on the rates.',
    answers: [{ index: 1, label: 'Equal weighting' }], correctIndices: [2],
    options: [{ index: 1, label: 'Equal weighting' }, { index: 2, label: 'Weight by group size' }], explanation: 'Combine counts first.' }, 'probe');
  assert.equal(feedback.label, 'Starting-point probe');
  assert.equal(feedback.verdict, 'Not quite yet · review this step');
  assert.deepEqual(feedback.choices.map(choice => [choice.selected, choice.correct]), [[true, false], [false, true]]);
  assert.equal(feedback.confidence, 80);
  assert.match(feedback.thinking ?? '', /guessed/);
});

test('open questions and recall answers never receive fabricated right/wrong feedback', () => {
  assert.equal(answerFeedback({ kind: 'ask', text: 'I think...' }).verdict, null);
  const recall = answerFeedback({ kind: 'explain', text: 'My explanation', committedAnswer: 'Reference', explanation: 'Because...' }, 'recall');
  assert.equal(recall.label, 'Teacher recall');
  assert.equal(recall.verdict, null);
  assert.equal(recall.response, 'My explanation');
  assert.equal(recall.referenceAnswer, 'Reference');
});
