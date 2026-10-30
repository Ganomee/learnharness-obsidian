import assert from 'node:assert/strict';
import { test } from 'node:test';
import { matchSpokenChoice, startSpeechCapture, type SpeechRecognitionLike, type SpeechWindow } from '../src/ui/speech-input';

class MockRecognition implements SpeechRecognitionLike {
  lang = ''; interimResults = true; maxAlternatives = 0;
  onresult: ((event: any) => void) | null = null;
  onerror: ((event: { error?: string }) => void) | null = null;
  onend: (() => void) | null = null;
  started = false; stopped = false;
  start(): void { this.started = true; }
  stop(): void { this.stopped = true; this.onend?.(); }
}

test('browser speech capture is one-shot, reports a transcript, and stops on request', () => {
  let recognition: MockRecognition | undefined, heard = '', ended = false;
  const host = { navigator: { language: 'en-GB' }, SpeechRecognition: class extends MockRecognition { constructor() { super(); recognition = this; } } } as unknown as SpeechWindow;
  const capture = startSpeechCapture(host, { result: text => { heard = text; }, error: () => assert.fail('unexpected speech error'), end: () => { ended = true; } });
  assert.ok(capture); assert.ok(recognition?.started); assert.equal(recognition?.lang, 'en-GB'); assert.equal(recognition?.interimResults, false); assert.equal(recognition?.maxAlternatives, 1);
  recognition?.onresult?.({ results: [[{ transcript: '  option B, because the groups have different sizes  ' }]] });
  assert.equal(heard, 'option B, because the groups have different sizes');
  capture?.stop(); assert.ok(recognition?.stopped); assert.ok(ended);
});

test('unsupported speech recognition is reported without throwing', () => {
  const host = { navigator: { language: 'en-US' } } as unknown as SpeechWindow;
  assert.equal(startSpeechCapture(host, { result: () => {}, error: () => {}, end: () => {} }), undefined);
});

test('spoken choice phrases map to option values without guessing ambiguous responses', () => {
  const options = [{ value: 'weighted', label: 'B. Weight each group by its size' }, { value: 'equal', label: 'A. Give both groups equal weight' }];
  assert.deepEqual(matchSpokenChoice('I think option B because the groups are different sizes', options, false), ['weighted']);
  assert.deepEqual(matchSpokenChoice('B', options, false), ['weighted']);
  assert.deepEqual(matchSpokenChoice('Give both groups equal weight', options, false), ['equal']);
  assert.deepEqual(matchSpokenChoice('A and B', options, true), ['weighted', 'equal']);
});
