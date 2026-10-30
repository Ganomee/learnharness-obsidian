export type LiveTranscriptionState =
  | 'requesting-microphone'
  | 'listening'
  | 'voice-detected'
  | 'connecting'
  | 'transcribing'
  | 'stopped'
  | 'error';

export interface LiveTranscriptUpdate {
  transcript: string;
  finalTranscript: string;
  interimTranscript: string;
  segment: string;
  isFinal: boolean;
  speechFinal: boolean;
}

export interface DeepgramLiveCapture {
  /** Stop immediately, for leaving the view or aborting a session. */
  stop(): void;
  /** Stop the microphone, flush the final phrase, then close this answer's socket. */
  finish(): Promise<void>;
}

export interface DeepgramMessage {
  segment: string;
  isFinal: boolean;
  speechFinal: boolean;
}

interface LiveSocket {
  readyState: number;
  binaryType: BinaryType;
  onopen: ((event: Event) => void) | null;
  onmessage: ((event: MessageEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
  onclose: ((event: CloseEvent) => void) | null;
  send(data: string | ArrayBuffer): void;
  close(): void;
}

/** Internal seams let the same capture lifecycle run with deterministic fakes in tests. */
export interface DeepgramLiveDependencies {
  getUserMedia?: (constraints: MediaStreamConstraints) => Promise<MediaStream>;
  createAudioContext?: () => AudioContext;
  createWebSocket?: (url: string, protocols: string[]) => LiveSocket;
}

const OUTPUT_RATE = 16_000;
const START_RMS = 0.009;
const STOP_RMS = 0.006;
const START_FRAMES = 2;
const STOP_FRAMES = 9;
const PREROLL_FRAMES = 5;
const MAX_QUEUED_FRAMES = 12;
const SOCKET_OPEN = 1;
const SOCKET_CONNECTING = 0;

/** Build a bounded Nova-3 multilingual stream; no key is placed in the URL. */
export function deepgramListenUrl(): string {
  const query = new URLSearchParams({
    model: 'nova-3',
    language: 'multi',
    interim_results: 'true',
    endpointing: '500',
    utterance_end_ms: '1000',
    vad_events: 'true',
    smart_format: 'true',
    encoding: 'linear16',
    sample_rate: String(OUTPUT_RATE),
    channels: '1',
  });
  return `wss://api.deepgram.com/v1/listen?${query.toString()}`;
}

/** Convert microphone floats to mono 16 kHz signed PCM for Deepgram Listen. */
export function floatToLinear16(input: Float32Array, inputRate: number): ArrayBuffer {
  if (!Number.isFinite(inputRate) || inputRate < OUTPUT_RATE) throw new Error('Unsupported microphone sample rate.');
  const length = Math.floor(input.length * OUTPUT_RATE / inputRate);
  const output = new Int16Array(length);
  for (let i = 0; i < length; i++) {
    const from = Math.floor(i * inputRate / OUTPUT_RATE);
    const to = Math.min(input.length, Math.floor((i + 1) * inputRate / OUTPUT_RATE));
    let sum = 0;
    for (let j = from; j < Math.max(from + 1, to); j++) sum += input[Math.min(j, input.length - 1)] ?? 0;
    const sample = Math.max(-1, Math.min(1, sum / Math.max(1, to - from)));
    output[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
  }
  return output.buffer;
}

export function audioRms(input: Float32Array): number {
  if (!input.length) return 0;
  let sum = 0;
  for (const sample of input) sum += sample * sample;
  return Math.sqrt(sum / input.length);
}

/** Parse only transcription result messages. Metadata and control frames are ignored. */
export function parseDeepgramMessage(data: unknown): DeepgramMessage | undefined {
  if (typeof data !== 'string') return undefined;
  try {
    const message = JSON.parse(data);
    if (message.type !== 'Results') return undefined;
    const segment = typeof message.channel?.alternatives?.[0]?.transcript === 'string'
      ? message.channel.alternatives[0].transcript.trim()
      : '';
    return {
      segment,
      isFinal: message.is_final === true,
      speechFinal: message.speech_final === true,
    };
  } catch { return undefined; }
}

/**
 * Owns one microphone and at most one Deepgram socket for a single answer.
 * The socket stays open across pauses; silence only changes local VAD state and
 * sends no audio. The caller's small interface is start + stop, while tests
 * inject fake browser devices through the internal dependency seam.
 */
export function startDeepgramLiveCapture(
  apiKey: string,
  handlers: {
    state(state: LiveTranscriptionState, detail?: string): void;
    transcript(update: LiveTranscriptUpdate): void;
    error(message: string): void;
  },
  dependencies: DeepgramLiveDependencies = {},
): DeepgramLiveCapture {
  let stopped = false;
  let stream: MediaStream | undefined;
  let context: AudioContext | undefined;
  let source: MediaStreamAudioSourceNode | undefined;
  let processor: ScriptProcessorNode | undefined;
  let mute: GainNode | undefined;
  let socket: LiveSocket | undefined;
  let finishTimer: ReturnType<typeof setTimeout> | undefined;
  let finishResolver: (() => void) | undefined;
  let finishPromise: Promise<void> | undefined;
  let finishing = false;
  let speech = false;
  let startFrames = 0;
  let silenceFrames = 0;
  let preroll: ArrayBuffer[] = [];
  let queued: ArrayBuffer[] = [];
  let finalTranscript = '';
  let interimTranscript = '';

  const state = (next: LiveTranscriptionState, detail?: string) => { if (!stopped) handlers.state(next, detail); };
  const publish = (message: DeepgramMessage) => {
    if (message.isFinal && message.segment) {
      finalTranscript = [finalTranscript, message.segment].filter(Boolean).join(' ').trim();
      interimTranscript = '';
    } else if (!message.isFinal) interimTranscript = message.segment;
    handlers.transcript({
      transcript: [finalTranscript, interimTranscript].filter(Boolean).join(' ').trim(),
      finalTranscript,
      interimTranscript,
      segment: message.segment,
      isFinal: message.isFinal,
      speechFinal: message.speechFinal,
    });
  };

  const releaseMicrophone = () => {
    if (processor) { processor.onaudioprocess = null; processor.disconnect(); }
    source?.disconnect(); mute?.disconnect();
    stream?.getTracks().forEach(track => track.stop());
    if (context && context.state !== 'closed') void context.close().catch(() => undefined);
  };

  const resolveFinish = () => {
    if (finishTimer) clearTimeout(finishTimer);
    finishTimer = undefined;
    const resolve = finishResolver;
    finishResolver = undefined;
    resolve?.();
  };

  const closeFinishedStream = () => {
    if (stopped) return;
    stopped = true;
    const current = socket;
    socket = undefined;
    try { current?.close(); } catch { /* socket may already be closing */ }
    releaseMicrophone();
    handlers.state('stopped');
    resolveFinish();
  };

  const stop = () => {
    if (stopped) return;
    stopped = true;
    resolveFinish();
    const current = socket;
    socket = undefined;
    try { if (current?.readyState === SOCKET_OPEN) current.send(JSON.stringify({ type: 'CloseStream' })); } catch { /* best effort */ }
    try { current?.close(); } catch { /* socket may already be closing */ }
    releaseMicrophone();
    handlers.state('stopped');
  };

  const finish = (): Promise<void> => {
    if (stopped) return Promise.resolve();
    if (finishPromise) return finishPromise;
    finishing = true;
    releaseMicrophone();
    finishPromise = new Promise(resolve => { finishResolver = resolve; });
    if (!socket || socket.readyState > SOCKET_OPEN) {
      closeFinishedStream();
      return finishPromise;
    }
    finishTimer = setTimeout(closeFinishedStream, 1500);
    if (socket.readyState === SOCKET_OPEN) {
      try { socket.send(JSON.stringify({ type: 'CloseStream' })); }
      catch { closeFinishedStream(); }
    }
    return finishPromise;
  };

  const fail = (message: string) => {
    if (stopped) return;
    stop();
    handlers.error(message);
    handlers.state('error', message);
  };

  const connect = () => {
    if (stopped || socket) return;
    state('connecting', 'Opening the live transcription connection.');
    try {
      const createSocket = dependencies.createWebSocket ?? ((url, protocols) => new WebSocket(url, protocols));
      socket = createSocket(deepgramListenUrl(), ['token', apiKey]);
    } catch {
      fail('Could not open Deepgram. Check its key or network, or type your answer.');
      return;
    }
    const current = socket;
    current.binaryType = 'arraybuffer';
    current.onopen = () => {
      if (stopped || socket !== current) return;
      for (const frame of queued.splice(0)) {
        try { current.send(frame); }
        catch { fail('Deepgram could not receive audio. Retry live voice or type your answer.'); return; }
      }
      if (finishing) {
        try { current.send(JSON.stringify({ type: 'CloseStream' })); }
        catch { closeFinishedStream(); }
        return;
      }
      state(speech ? 'transcribing' : 'listening', speech
        ? 'Voice detected · Deepgram is transcribing.'
        : 'Microphone on · waiting for speech.');
    };
    current.onmessage = event => {
      if (socket !== current) return;
      const message = parseDeepgramMessage(event.data);
      if (message) publish(message);
    };
    current.onerror = () => fail('Deepgram connection failed. Your microphone has stopped; retry or type your answer.');
    current.onclose = event => {
      if (socket !== current || stopped) return;
      socket = undefined;
      queued = [];
      if (finishing) { closeFinishedStream(); return; }
      if (!speech && event.code === 1000) {
        state('listening', 'Microphone on · waiting for speech; transcription reconnects when needed.');
        return;
      }
      fail(event.reason || `Deepgram connection closed (${event.code}). Retry live voice or type your answer.`);
    };
  };

  const send = (frame: ArrayBuffer) => {
    if (!socket || socket.readyState > SOCKET_OPEN) {
      socket = undefined;
      connect();
    }
    if (socket?.readyState === SOCKET_OPEN) {
      try { socket.send(frame); }
      catch { fail('Deepgram could not receive audio. Retry live voice or type your answer.'); }
    } else if (socket?.readyState === SOCKET_CONNECTING) {
      queued.push(frame);
      if (queued.length > MAX_QUEUED_FRAMES) queued.shift();
    }
  };

  const onAudio = (event: AudioProcessingEvent) => {
    if (stopped || !context) return;
    const samples = event.inputBuffer.getChannelData(0);
    const frame = floatToLinear16(samples, context.sampleRate);
    const loudness = audioRms(samples);

    if (!speech) {
      preroll.push(frame);
      if (preroll.length > PREROLL_FRAMES) preroll.shift();
      startFrames = loudness >= START_RMS ? startFrames + 1 : 0;
      if (startFrames >= START_FRAMES) {
        speech = true;
        silenceFrames = 0;
        state(socket?.readyState === SOCKET_OPEN ? 'transcribing' : 'voice-detected', 'Voice detected · live transcription is active.');
        for (const buffered of preroll) send(buffered);
        preroll = [];
      }
      return;
    }

    send(frame);
    silenceFrames = loudness < STOP_RMS ? silenceFrames + 1 : 0;
    if (silenceFrames >= STOP_FRAMES) {
      speech = false;
      startFrames = 0;
      preroll = [];
      state('listening', 'Microphone on · waiting for more speech. Your transcript is kept.');
    }
  };

  const begin = async () => {
    if (stopped) return;
    if (!apiKey.trim()) { fail('Select a Deepgram key in LearnHarness settings first.'); return; }
    state('requesting-microphone', 'Requesting microphone access. Audio stays local until speech is detected.');
    try {
      const getUserMedia = dependencies.getUserMedia ?? ((constraints: MediaStreamConstraints) => {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('Microphone capture is unavailable in this Obsidian environment.');
        return navigator.mediaDevices.getUserMedia(constraints);
      });
      stream = await getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      if (stopped) { releaseMicrophone(); return; }

      const createAudioContext = dependencies.createAudioContext ?? (() => {
        const browser = window as Window & { webkitAudioContext?: typeof AudioContext };
        const AudioContextConstructor = browser.AudioContext ?? browser.webkitAudioContext;
        if (!AudioContextConstructor) throw new Error('Web Audio is unavailable in this Obsidian environment.');
        return new AudioContextConstructor();
      });
      context = createAudioContext();
      if (context.sampleRate < OUTPUT_RATE) throw new Error('Unsupported microphone sample rate.');
      await context.resume();
      if (stopped) { releaseMicrophone(); return; }
      source = context.createMediaStreamSource(stream);
      processor = context.createScriptProcessor(4096, 1, 1);
      mute = context.createGain(); mute.gain.value = 0;
      processor.onaudioprocess = onAudio;
      source.connect(processor); processor.connect(mute); mute.connect(context.destination);
      state('listening', 'Microphone on · waiting for speech. Audio is not sent while silent.');
    } catch (error) {
      const message = error instanceof Error && error.name === 'NotAllowedError'
        ? 'Microphone permission was denied. Allow microphone access in Obsidian, or type your response.'
        : error instanceof Error
          ? error.message
          : 'Could not start microphone capture. Type your response or retry.';
      fail(message);
    }
  };

  // Defer startup until the caller has installed the returned stop handle.
  void Promise.resolve().then(begin);
  return { stop, finish };
}
