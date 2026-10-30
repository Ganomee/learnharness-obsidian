import test from 'node:test';
import assert from 'node:assert/strict';
import { audioRms, deepgramListenUrl, floatToLinear16, parseDeepgramMessage, startDeepgramLiveCapture, type LiveTranscriptionState } from '../src/adapters/deepgram-live';

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

test('one microphone and socket stay alive across phrases and normal pauses', async () => {
  const track = { stopped: false, stop() { this.stopped = true; } };
  const stream = { getTracks: () => [track] };
  let audioCallback: ((event: AudioProcessingEvent) => void) | null = null;
  let contextClosed = false;
  const processor = {
    onaudioprocess: null as ((event: AudioProcessingEvent) => void) | null,
    connect() {},
    disconnect() {},
  };
  const context = {
    sampleRate: 48_000,
    state: 'running',
    destination: {},
    async resume() {},
    async close() { contextClosed = true; },
    createMediaStreamSource: () => ({ connect() {}, disconnect() {} }),
    createScriptProcessor: () => processor,
    createGain: () => ({ gain: { value: 1 }, connect() {}, disconnect() {} }),
  };
  const sockets: Array<{
    readyState: number;
    binaryType: BinaryType;
    onopen: ((event: Event) => void) | null;
    onmessage: ((event: MessageEvent) => void) | null;
    onerror: ((event: Event) => void) | null;
    onclose: ((event: CloseEvent) => void) | null;
    sent: Array<string | ArrayBuffer>;
    closeCount: number;
    open(): void;
    send(data: string | ArrayBuffer): void;
    close(): void;
  }> = [];
  const states: LiveTranscriptionState[] = [];
  const finals: string[] = [];
  const capture = startDeepgramLiveCapture('test-key', {
    state: next => states.push(next),
    transcript: update => { if (update.isFinal) finals.push(update.segment); },
    error: message => assert.fail(message),
  }, {
    getUserMedia: async () => stream as unknown as MediaStream,
    createAudioContext: () => context as unknown as AudioContext,
    createWebSocket: () => {
      const socket = {
        readyState: 0,
        binaryType: 'blob' as BinaryType,
        onopen: null as ((event: Event) => void) | null,
        onmessage: null as ((event: MessageEvent) => void) | null,
        onerror: null as ((event: Event) => void) | null,
        onclose: null as ((event: CloseEvent) => void) | null,
        sent: [] as Array<string | ArrayBuffer>,
        closeCount: 0,
        open() { this.readyState = 1; this.onopen?.(new Event('open')); },
        send(data: string | ArrayBuffer) { this.sent.push(data); },
        close() { this.closeCount++; this.readyState = 3; this.onclose?.({ code: 1000, reason: '' } as CloseEvent); },
      };
      sockets.push(socket);
      return socket;
    },
  });
  audioCallback = processor.onaudioprocess;
  const flush = async () => { await new Promise(resolve => setTimeout(resolve, 0)); };
  await flush();
  audioCallback = processor.onaudioprocess;
  assert.equal(states.at(-1), 'listening');
  assert.equal(sockets.length, 0, 'idle room audio must not open a provider connection');

  const emitAudio = (level: number) => audioCallback?.({
    inputBuffer: { getChannelData: () => new Float32Array(4096).fill(level) },
  } as unknown as AudioProcessingEvent);
  emitAudio(0.1);
  emitAudio(0.1);
  assert.equal(sockets.length, 1, 'first detected voice opens one socket');
  sockets[0].open();
  assert.equal(states.at(-1), 'transcribing');
  const sentAfterFirstPhrase = sockets[0].sent.length;
  assert.ok(sentAfterFirstPhrase >= 2, 'preroll and speech audio flush after the socket opens');

  for (let frame = 0; frame < 9; frame++) emitAudio(0);
  assert.equal(states.at(-1), 'listening', 'a normal speaking pause returns to waiting');
  assert.equal(sockets[0].closeCount, 0, 'normal pauses must not stop or recreate the socket');

  emitAudio(0.1);
  emitAudio(0.1);
  assert.equal(sockets.length, 1, 'the next phrase reuses the same connection');
  assert.equal(states.at(-1), 'transcribing');
  assert.ok(sockets[0].sent.length > sentAfterFirstPhrase, 'the resumed phrase is streamed');
  sockets[0].onmessage?.({ data: JSON.stringify({
    type: 'Results', is_final: true, speech_final: true,
    channel: { alternatives: [{ transcript: 'I understand the idea' }] },
  }) } as MessageEvent);
  assert.deepEqual(finals, ['I understand the idea']);

  for (let frame = 0; frame < 9; frame++) emitAudio(0);
  sockets[0].readyState = 3;
  sockets[0].onclose?.({ code: 1000, reason: '' } as CloseEvent);
  assert.equal(states.at(-1), 'listening', 'a normal remote idle close does not stop the microphone');
  emitAudio(0.1);
  emitAudio(0.1);
  assert.equal(sockets.length, 2, 'a closed provider socket reconnects once when new speech begins');
  sockets[1].open();
  assert.equal(states.at(-1), 'transcribing');

  capture.stop();
  assert.equal(track.stopped, true);
  assert.equal(contextClosed, true);
  assert.equal(sockets[0].closeCount, 0);
  assert.equal(sockets[1].closeCount, 1);
  assert.equal(states.at(-1), 'stopped');
});

test('microphone permission errors stop cleanly and report an actionable state', async () => {
  const states: LiveTranscriptionState[] = [];
  const errors: string[] = [];
  const capture = startDeepgramLiveCapture('test-key', {
    state: next => states.push(next),
    transcript: () => assert.fail('no transcript expected'),
    error: message => errors.push(message),
  }, {
    getUserMedia: async () => { throw new DOMException('blocked', 'NotAllowedError'); },
  });
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.match(errors[0] ?? '', /permission was denied/i);
  assert.deepEqual(states.slice(-2), ['stopped', 'error']);
  capture.stop();
  assert.deepEqual(states.slice(-2), ['stopped', 'error']);
});

test('stopping before async microphone startup prevents a late device request', async () => {
  let requested = false;
  const states: LiveTranscriptionState[] = [];
  const capture = startDeepgramLiveCapture('test-key', {
    state: next => states.push(next),
    transcript: () => assert.fail('no transcript expected'),
    error: message => assert.fail(message),
  }, {
    getUserMedia: async () => { requested = true; throw new Error('must not be called'); },
  });
  capture.stop();
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(requested, false);
  assert.deepEqual(states, ['stopped']);
});

test('finish flushes the last transcription before submit and releases the microphone', async () => {
  const track = { stopped: false, stop() { this.stopped = true; } };
  let audioCallback: ((event: AudioProcessingEvent) => void) | null = null;
  const processor = { onaudioprocess: null as ((event: AudioProcessingEvent) => void) | null, connect() {}, disconnect() {} };
  const context = {
    sampleRate: 48_000, state: 'running', destination: {},
    async resume() {}, async close() {},
    createMediaStreamSource: () => ({ connect() {}, disconnect() {} }),
    createScriptProcessor: () => processor,
    createGain: () => ({ gain: { value: 1 }, connect() {}, disconnect() {} }),
  };
  const states: LiveTranscriptionState[] = [];
  const transcripts: string[] = [];
  let socket: {
    readyState: number;
    binaryType: BinaryType;
    onopen: ((event: Event) => void) | null;
    onmessage: ((event: MessageEvent) => void) | null;
    onerror: ((event: Event) => void) | null;
    onclose: ((event: CloseEvent) => void) | null;
    sent: Array<string | ArrayBuffer>;
    open(): void;
    send(data: string | ArrayBuffer): void;
    close(): void;
  } | undefined;
  const capture = startDeepgramLiveCapture('test-key', {
    state: next => states.push(next),
    transcript: update => { if (update.isFinal) transcripts.push(update.segment); },
    error: message => assert.fail(message),
  }, {
    getUserMedia: async () => ({ getTracks: () => [track] }) as unknown as MediaStream,
    createAudioContext: () => context as unknown as AudioContext,
    createWebSocket: () => {
      socket = {
        readyState: 0, binaryType: 'blob', onopen: null, onmessage: null, onerror: null, onclose: null,
        sent: [],
        open() { this.readyState = 1; this.onopen?.(new Event('open')); },
        send(data) {
          this.sent.push(data);
          if (typeof data === 'string' && JSON.parse(data).type === 'CloseStream') {
            queueMicrotask(() => {
              this.onmessage?.({ data: JSON.stringify({ type: 'Results', is_final: true, speech_final: true, channel: { alternatives: [{ transcript: 'final words before submit' }] } }) } as MessageEvent);
              this.readyState = 3;
              this.onclose?.({ code: 1000, reason: '' } as CloseEvent);
            });
          }
        },
        close() { this.readyState = 3; this.onclose?.({ code: 1000, reason: '' } as CloseEvent); },
      };
      return socket;
    },
  });
  await new Promise(resolve => setTimeout(resolve, 0));
  audioCallback = processor.onaudioprocess;
  const emitVoice = () => audioCallback?.({ inputBuffer: { getChannelData: () => new Float32Array(4096).fill(0.1) } } as unknown as AudioProcessingEvent);
  emitVoice(); emitVoice();
  socket!.open();

  await capture.finish();
  assert.equal(track.stopped, true);
  assert.deepEqual(transcripts, ['final words before submit']);
  assert.equal(states.at(-1), 'stopped');
  assert.ok(socket!.sent.some(data => typeof data === 'string' && data.includes('CloseStream')));
});
