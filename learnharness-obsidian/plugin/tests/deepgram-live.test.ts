import test from 'node:test';
import assert from 'node:assert/strict';
import { audioRms, deepgramListenUrl, floatToLinear16, parseDeepgramMessage } from '../src/adapters/deepgram-live';

test('Deepgram streaming targets the fixed Listen endpoint with live multilingual interim results', () => {
  const url = new URL(deepgramListenUrl());
  assert.equal(url.origin, 'wss://api.deepgram.com');
  assert.equal(url.pathname, '/v1/listen');
  assert.equal(url.searchParams.get('model'), 'nova-3');
  assert.equal(url.searchParams.get('language'), 'multi');
  assert.equal(url.searchParams.get('interim_results'), 'true');
  assert.equal(url.searchParams.get('endpointing'), '500');
  assert.equal(url.searchParams.get('encoding'), 'linear16');
  assert.equal(url.searchParams.has('token'), false);
});

test('microphone floats are resampled to bounded signed 16-bit PCM', () => {
  const pcm = new Int16Array(floatToLinear16(new Float32Array([-1, -0.5, 0, 0.5, 1]), 16_000));
  assert.deepEqual([...pcm], [-32768, -16384, 0, 16383, 32767]);
  const resampled = new Int16Array(floatToLinear16(new Float32Array(48).fill(0.25), 48_000));
  assert.equal(resampled.length, 16);
  assert.ok(resampled.every(sample => sample === 8191));
  assert.throws(() => floatToLinear16(new Float32Array(8), 8_000), /sample rate/);
});

test('voice activity energy is stable for silence and audible speech', () => {
  assert.equal(audioRms(new Float32Array(16)), 0);
  assert.ok(Math.abs(audioRms(new Float32Array(4).fill(0.5)) - 0.5) < 1e-6);
});

test('Deepgram interim and final transcript payloads are parsed without leaking provider metadata', () => {
  assert.deepEqual(parseDeepgramMessage(JSON.stringify({
    type: 'Results', is_final: false, speech_final: false,
    channel: { alternatives: [{ transcript: 'I think' }] },
  })), { segment: 'I think', isFinal: false, speechFinal: false });
  assert.deepEqual(parseDeepgramMessage(JSON.stringify({
    type: 'Results', is_final: true, speech_final: true,
    channel: { alternatives: [{ transcript: 'the larger group matters' }] },
    metadata: { request_id: 'not surfaced to the learner view' },
  })), { segment: 'the larger group matters', isFinal: true, speechFinal: true });
  assert.equal(parseDeepgramMessage('{bad json'), undefined);
  assert.equal(parseDeepgramMessage(JSON.stringify({ type: 'Metadata' })), undefined);
});
