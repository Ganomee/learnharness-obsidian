import assert from 'node:assert/strict';
import { test } from 'node:test';
import vm from 'node:vm';
import { buildRuntime } from '../../scripts/build-runtime.mjs';
import { emptyProviderBudgetState, ProviderBudgetLedger } from '../src/adapters/provider-budget';

const built = await buildRuntime({ entryPoints: ['plugin/src/adapters/ai-learner.ts'], write: false, format: 'iife', globalName: 'Learner' });
const context: any = { setTimeout, clearTimeout, AbortController };
vm.runInNewContext(built.outputFiles[0]!.text, context);
const { simulateLearnerAnswer } = context.Learner;
const ledger = () => new ProviderBudgetLedger(emptyProviderBudgetState(), async () => {});
const question = { id: 'q1', kind: 'quiz', question: 'What should be combined?', context: 'Two unequal groups', mode: 'single-select', options: [{ label: 'Rates', value: 'rates' }, { label: 'Counts', value: 'counts' }] };

test('AI learner sees only the prompt and returns a validated first-person answer', async () => {
  let sent: any;
  const answer = await simulateLearnerAnswer({
    request: async (request: any) => { sent = request; return { status: 200, headers: {}, text: JSON.stringify({ choices: [{ message: { content: JSON.stringify({ values: ['rates'], text: '', thinking: 'I would average both percentages.', confidence: 65 }) } }] }) }; },
    apiKey: 'test-key', goal: 'Combine group rates', question: { ...question, correctAnswer: 'counts', explanation: 'secret explanation' } as any,
    profile: 'Beginner who makes equal-weight assumptions', budget: ledger(),
  });
  const body = JSON.parse(sent.body);
  assert.equal(sent.url, 'https://api.deepseek.com/chat/completions');
  assert.equal(body.model, 'deepseek-flash'); assert.equal(body.max_tokens, 512); assert.equal(body.thinking.type, 'disabled');
  assert.equal(answer.values[0], 'rates'); assert.equal(answer.thinking, 'I would average both percentages.'); assert.equal(answer.confidence, 65);
  assert.ok(!sent.body.includes('correctAnswer')); assert.ok(!sent.body.includes('secret explanation'));
});

test('AI learner refuses invalid choices and redacts provider failures', async () => {
  const input = { apiKey: 'test-key', goal: 'Rates', question: question as any, profile: 'Novice', budget: ledger(), request: async () => ({ status: 200, headers: {}, text: JSON.stringify({ choices: [{ message: { content: '{"values":["not-an-option"],"text":"","thinking":"","confidence":30}' } }] }) }) };
  await assert.rejects(simulateLearnerAnswer(input), /invalid choice/);
  await assert.rejects(simulateLearnerAnswer({ ...input, request: async () => ({ status: 401, headers: {}, text: 'secret response' }) }), /HTTP 401/);
});
