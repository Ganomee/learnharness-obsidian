export interface SpeechResultEvent { results: ArrayLike<ArrayLike<{ transcript: string }>> }
export interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: SpeechResultEvent) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}
export type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;
export interface SpeechWindow extends Window { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor }
export interface SpeechCapture { stop(): void }

export function matchSpokenChoice(transcript: string, options: readonly { value: string; label: string }[], multiSelect: boolean): string[] {
  const normalize = (value: string) => value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  const spoken = normalize(transcript);
  const matches = options.filter(option => [option.label, option.value].some(value => {
    const phrase = normalize(value);
    if (!phrase) return false;
    if (spoken === phrase || ` ${spoken} `.includes(` ${phrase} `)) return true;
    const marker = phrase.length === 1 ? phrase : normalize(value).match(/^([a-z0-9])\s/)?.[1];
    const labeled = !!marker && new RegExp(`\\b(?:option|choice|answer|number)\\s+${marker}\\b`).test(spoken);
    const shortList = /^[a-z0-9](?:(?:\s+and\s+|\s+)[a-z0-9])*$/i.test(spoken) && !!marker && new RegExp(`\\b${marker}\\b`).test(spoken);
    return labeled || shortList;
  })).map(option => option.value);
  return matches.length && (multiSelect || matches.length === 1) ? matches : [];
}

/** Start the host browser's speech-to-text service. It returns text only; audio never enters plugin storage. */
export function startSpeechCapture(host: SpeechWindow, handlers: { result(text: string): void; error(message: string): void; end(): void }): SpeechCapture | undefined {
  const Recognition = host.SpeechRecognition ?? host.webkitSpeechRecognition;
  if (!Recognition) return undefined;
  const recognition = new Recognition();
  recognition.lang = host.navigator.language || 'en-US';
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  recognition.onresult = event => {
    const transcript = event.results[0]?.[0]?.transcript?.trim();
    if (transcript) handlers.result(transcript);
  };
  recognition.onerror = event => handlers.error(event.error ? `Speech input failed: ${event.error}.` : 'Speech input failed.');
  recognition.onend = () => handlers.end();
  try { recognition.start(); }
  catch (error) { handlers.error(error instanceof Error ? error.message : 'Could not start speech input.'); return undefined; }
  return { stop: () => recognition.stop() };
}
