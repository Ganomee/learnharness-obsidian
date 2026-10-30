import assert from 'node:assert/strict';
import { test } from 'node:test';
import vm from 'node:vm';
import fs from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { buildRuntime } from '../../scripts/build-runtime.mjs';

function browserContext(source: string) {
  const context: any = { crypto: globalThis.crypto, structuredClone, setTimeout, clearTimeout, queueMicrotask, AbortController, AbortSignal, TextEncoder, TextDecoder, ReadableStream, performance, console, URL, URLSearchParams };
  vm.runInNewContext(source, context);
  assert.equal(context.process, undefined); assert.equal(context.Buffer, undefined); assert.equal(context.require, undefined);
  return context;
}

test('browser-target original agent runs retry, mixed question stop, grading and JSON reconstruction without Node globals', async () => {
  const result = await buildRuntime({ write: false, format: 'iife', globalName: 'LearnHarnessProof' });
  assert.deepEqual(Object.values(result.metafile.outputs).flatMap((o: any) => o.imports), []);
  const context = browserContext(result.outputFiles[0].text);
  const report = await context.LearnHarnessProof.runRuntimeProof();
  assert.equal(report.providerCalls, 3);
  assert.equal(report.upstreamRevision, '3dc88472eea41eed0d5e5f29c2f16f8d063c415b');
  assert.equal(report.checks.length, 4);
  const messages: any[] = report.transcript;
  assert.equal(messages.filter(m => m.role === 'user').length, 1);
  assert.equal(messages.filter(m => m.role === 'system').length, 0);
  assert.equal(messages.filter(m => m.role === 'toolResult' && m.isError).length, 1);
  const answers = messages.filter(m => m.role === 'toolResult' && m.toolCallId === 'question-1');
  assert.equal(answers.length, 1);
  assert.equal(answers[0].details.correct, true);
  assert.equal(answers[0].toolName, 'probe');
  assert.ok(messages.every(m => typeof m.id === 'string' && m.id.length > 0));
  // Adversarial discovery: truncating the last turn message retains the
  // learner answer but silently drops the provider's completed reply.
  const expectedReply = 'The scripted provider received the learner answer.';
  const restoredAgain: any[] = JSON.parse(JSON.stringify(messages));
  const completedReplies = restoredAgain.filter(m => m.role === 'assistant' && m.content.some((part: any) => part.type === 'text' && part.text === expectedReply));
  assert.equal(completedReplies.length, 1, 'completed resumed reply persists exactly once');
  assert.equal(restoredAgain.at(-1).role, 'assistant');
  assert.equal(restoredAgain.at(-1).content.find((part: any) => part.type === 'text').text, expectedReply);
  assert.ok(restoredAgain.indexOf(completedReplies[0]) > restoredAgain.findIndex(m => m.role === 'toolResult' && m.toolCallId === 'question-1'), 'completed reply follows actual learner answer');
});

test('browser prompt text and segment order match original composition against native source files', async () => {
  const browser = await buildRuntime({ write: false, format: 'iife', globalName: 'LearnHarnessProof' });
  const context = browserContext(browser.outputFiles[0].text);
  const nativeFile = path.resolve('plugin/dist/runtime-native-reference.mjs');
  await buildRuntime({ nativePlatform: true, outfile: nativeFile });
  const native = await import(pathToFileURL(nativeFile).href + '?parity');
  const expected = native.runtimePromptSnapshot();
  const actual = context.LearnHarnessProof.runtimePromptSnapshot();
  assert.ok(expected.text.length > 1000);
  assert.equal(actual.text, expected.text);
  assert.deepEqual(Array.from(actual.segments), expected.segments);
});

test('unsupported browser platform facilities fail closed', async () => {
  const result = await buildRuntime({ entryPoints: ['plugin/tests/fixtures/runtime-platform.ts'], write: false, format: 'iife', globalName: 'PlatformProof' });
  const context = browserContext(result.outputFiles[0].text);
  for (const operation of context.PlatformProof.unsupportedSync) assert.throws(operation, /unsupported|requires an explicitly injected engine/i);
  await assert.rejects(context.PlatformProof.unsupportedAsync, /unsupported/i);
});
