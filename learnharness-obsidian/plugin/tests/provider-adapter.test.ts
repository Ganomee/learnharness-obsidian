import assert from 'node:assert/strict';
import { test } from 'node:test';
import vm from 'node:vm';
import { buildRuntime } from '../../scripts/build-runtime.mjs';
import { emptyProviderBudgetState, ProviderBudgetLedger } from '../src/adapters/provider-budget';

const built = await buildRuntime({ entryPoints: ['plugin/src/adapters/deepseek-engine.ts'], write: false, format: 'iife', globalName: 'Provider' });
const context: any = { crypto, structuredClone, setTimeout, clearTimeout, queueMicrotask, AbortController, AbortSignal, DOMException, TextEncoder, TextDecoder, ReadableStream, TransformStream, performance, console, URL, URLSearchParams, Headers, Request, Response, FormData, Blob, File };
vm.runInNewContext(built.outputFiles[0]!.text, context);
const { createDeepSeekEngine, createObsidianFetch } = context.Provider;
const ledger = () => new ProviderBudgetLedger(emptyProviderBudgetState(), async () => {});
const sse = () => [
  `data: ${JSON.stringify({ id: 'response-1', object: 'chat.completion.chunk', created: 1, model: 'deepseek-flash', choices: [{ index: 0, delta: { role: 'assistant', content: 'Hello learner' }, finish_reason: null }] })}`,
  `data: ${JSON.stringify({ id: 'response-1', object: 'chat.completion.chunk', created: 1, model: 'deepseek-flash', choices: [{ index: 0, delta: {}, finish_reason: 'stop' }], usage: { prompt_tokens: 10, completion_tokens: 2, total_tokens: 12 } })}`,
  'data: [DONE]', '',
].join('\n\n');

test('original provider parser works through buffered native transport without Node globals', async () => {
  const requests: any[] = [];
  const transport = createObsidianFetch(async (request: any) => { requests.push(request); return { status: 200, headers: { 'content-type': 'text/event-stream', 'content-encoding': 'gzip' }, text: sse() }; });
  const engine = createDeepSeekEngine('test-only-key', transport, ledger());
  const answer = await engine.streamFn(engine.model, { systemPrompt: 'Test', messages: [{ role: 'user', content: 'Hello', timestamp: 1 }] }, {}).result();
  assert.equal(context.process, undefined); assert.equal(context.Buffer, undefined); assert.equal(context.require, undefined);
  assert.equal(answer.stopReason, 'stop', answer.errorMessage); assert.equal(answer.content[0].text, 'Hello learner');
  assert.equal(requests.length, 1);
  const payload = JSON.parse(requests[0].body);
  assert.equal(payload.model, 'deepseek-flash'); assert.equal(payload.max_tokens, 2048); assert.equal(payload.thinking.type, 'disabled');
  assert.equal(requests[0].url, 'https://api.deepseek.com/chat/completions');
});

test('request count and payload caps prevent unbounded provider calls', async () => {
  let requests = 0;
  const engine = createDeepSeekEngine('test-only-key', createObsidianFetch(async () => { requests++; return { status: 200, headers: { 'content-type': 'text/event-stream' }, text: sse() }; }), ledger());
  for (let index = 0; index < 4; index++) { const result = await engine.streamFn(engine.model, { messages: [{ role: 'user', content: 'hello', timestamp: 1 }] }, {}).result(); assert.equal(result.stopReason, 'stop', result.errorMessage); }
  const fifth = await engine.streamFn(engine.model, { messages: [] }, {}).result();
  assert.equal(fifth.stopReason, 'error'); assert.match(fifth.errorMessage, /request limit/); assert.equal(requests, 4);
  const large = createDeepSeekEngine('test-only-key', createObsidianFetch(async () => { throw new Error('must never send oversized payload'); }), ledger());
  const oversized = await large.streamFn(large.model, { messages: [{ role: 'user', content: 'x'.repeat(130000), timestamp: 1 }] }, {}).result();
  assert.equal(oversized.stopReason, 'error'); assert.match(oversized.errorMessage, /input limit/);
});

test('transport refuses unexpected destinations and redacts provider error bodies', async () => {
  let requests = 0;
  const transport = createObsidianFetch(async () => { requests++; return { status: 401, headers: {}, text: 'sensitive echoed credential must never be surfaced' }; });
  await assert.rejects(transport('https://untrusted.invalid/', { body: '{}' }), /configured DeepSeek/);
  assert.equal(requests, 0);
  const response = await transport('https://api.deepseek.com/chat/completions', { body: '{}' });
  assert.equal(response.status, 401); assert.ok(!(await response.text()).includes('sensitive'));
});

test('local abort ignores late native response without claiming remote cancellation', async () => {
  const abort = new AbortController();
  let finish!: (value: any) => void;
  const transport = createObsidianFetch(() => new Promise(resolve => { finish = resolve; }));
  const pending = transport('https://api.deepseek.com/chat/completions', { body: '{}', signal: abort.signal });
  abort.abort();
  await assert.rejects(pending, /aborted/i);
  finish({ status: 200, headers: {}, text: sse() });
});
