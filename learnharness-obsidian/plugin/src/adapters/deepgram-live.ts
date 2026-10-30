export type LiveTranscriptionState = 'requesting-microphone' | 'listening' | 'connecting' | 'transcribing' | 'stopped' | 'error';

export interface LiveTranscriptUpdate {
  transcript: string;
  finalTranscript: string;
  interimTranscript: string;
  segment: string;
  isFinal: boolean;
  speechFinal: boolean;
}

export interface DeepgramLiveCapture {
  stop(): void;
}

export interface DeepgramMessage {
  segment: string;
  isFinal: boolean;
  speechFinal: boolean;
}

const OUTPUT_RATE = 16_000;
const START_RMS = 0.012;
const STOP_RMS = 0.008;
const START_FRAMES = 2;
const STOP_FRAMES = 14;
const PREROLL_FRAMES = 6;
const SOCKET_IDLE_MS = 5_000;

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
 * Captures microphone audio locally and opens a Deepgram socket only after
 * local voice activity is detected. Raw audio is streamed in memory and never
 * written to the vault. The caller owns the returned handle and must stop it.
 */
export function startDeepgramLiveCapture(
  apiKey: string,
  handlers: {
    state(state: LiveTranscriptionState, detail?: string): void;
    transcript(update: LiveTranscriptUpdate): void;
    error(message: string): void;
  },
): DeepgramLiveCapture {
  let stopped = false;
  let stream: MediaStream | undefined;
  let context: AudioContext | undefined;
  let source: MediaStreamAudioSourceNode | undefined;
  let processor: ScriptProcessorNode | undefined;
  let mute: GainNode | undefined;
  let socket: WebSocket | undefined;
  let idleTimer: ReturnType<typeof setTimeout> | undefined;
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

  const fail = (message: string) => {
    if (stopped) return;
    handlers.error(message);
    stop();
    handlers.state('error', message);
  };

  const connect = () => {
    if (stopped || socket || typeof WebSocket === 'undefined') return;
    state('connecting', 'Opening Deepgram live transcription…');
    let next: WebSocket;
    try {
      next = new WebSocket(deepgramListenUrl(), ['token', apiKey]);
    } catch { fail('Could not connect to Deepgram. Check the key and network, or type your response.'); return; }
    socket = next;
    next.binaryType = 'arraybuffer';
    next.onopen = () => {
      if (stopped || socket !== next) return;
      for (const frame of queued.splice(0)) next.send(frame);
      state('transcribing', 'Deepgram is transcribing speech live.');
    };
    next.onmessage = event => {
      if (socket !== next) return;
      const message = parseDeepgramMessage(event.data);
      if (message) publish(message);
    };
    next.onerror = () => fail('Deepgram transcription connection failed. Type your response or retry live voice.');
    next.onclose = () => {
      if (socket === next) socket = undefined;
      if (!stopped && speech) state('error', 'Deepgram disconnected while listening.');
    };
  };

  const send = (frame: ArrayBuffer) => {
    if (socket?.readyState === WebSocket.OPEN) socket.send(frame);
    else if (!socket || socket.readyState === WebSocket.CONNECTING) {
      queued.push(frame);
      if (queued.length > 36) queued.shift();
      connect();
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
        if (idleTimer) clearTimeout(idleTimer);
        idleTimer = undefined;
        state('connecting', 'Speech detected; opening live transcription.');
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
      state('listening', 'Waiting for you to speak; the microphone stays local until voice is detected.');
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        if (socket?.readyState === WebSocket.OPEN) {
          try { socket.send(JSON.stringify({ type: 'CloseStream' })); } catch { /* socket may already be closing */ }
          socket.close();
          socket = undefined;
        }
        queued = [];
      }, SOCKET_IDLE_MS);
    }
  };

  const stop = () => {
    if (stopped) return;
    stopped = true;
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = undefined;
    if (socket) {
      try { if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'CloseStream' })); } catch { /* no-op */ }
      try { socket.close(); } catch { /* no-op */ }
      socket = undefined;
    }
    if (processor) { processor.onaudioprocess = null; processor.disconnect(); }
    source?.disconnect(); mute?.disconnect();
    stream?.getTracks().forEach(track => track.stop());
    if (context && context.state !== 'closed') void context.close().catch(() => undefined);
    handlers.state('stopped');
  };

  const begin = async () => {
    if (!apiKey.trim()) { fail('Select a Deepgram key in LearnHarness settings first.'); return; }
    if (!navigator.mediaDevices?.getUserMedia) { fail('Microphone capture is unavailable in this Obsidian environment.'); return; }
    const browser = window as Window & { webkitAudioContext?: typeof AudioContext };
    const AudioContextConstructor = browser.AudioContext ?? browser.webkitAudioContext;
    if (!AudioContextConstructor) { fail('Web Audio is unavailable in this Obsidian environment.'); return; }
    state('requesting-microphone', 'Allow microphone access to start automatic voice detection.');
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      if (stopped) { stream.getTracks().forEach(track => track.stop()); return; }
      context = new AudioContextConstructor();
      if (context.sampleRate < OUTPUT_RATE) throw new Error('Unsupported microphone sample rate.');
      await context.resume();
      source = context.createMediaStreamSource(stream);
      processor = context.createScriptProcessor(4096, 1, 1);
      mute = context.createGain(); mute.gain.value = 0;
      processor.onaudioprocess = onAudio;
      source.connect(processor); processor.connect(mute); mute.connect(context.destination);
      state('listening', 'Waiting for you to speak; only detected voice is sent to Deepgram.');
    } catch (error) {
      fail(error instanceof Error && error.name === 'NotAllowedError'
        ? 'Microphone permission was denied. Type your response or enable microphone access in Obsidian.'
        : error instanceof Error && error.message === 'Unsupported microphone sample rate.'
          ? error.message
          : 'Could not start microphone capture. Type your response or try again.');
    }
  };

  // Defer startup until the caller has installed the returned stop handle.
  void Promise.resolve().then(begin);
  return { stop };
}
