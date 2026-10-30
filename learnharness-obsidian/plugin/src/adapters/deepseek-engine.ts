import { stream } from '@earendil-works/pi-ai/api/openai-completions';
import { AssistantMessageEventStream } from '@earendil-works/pi-ai';
import { DEEPSEEK_MODELS } from '@earendil-works/pi-ai/providers/deepseek.models';
import type { PiEngine } from '../../../upstream/learnharness/src/agent/models.ts';
import { ProviderBudgetStateError, type ProviderBudgetLedger } from './provider-budget';

export const DEVELOPMENT_LIMITS = Object.freeze({ requests: 4, outputTokens: 2048, payloadCharacters: 120000, timeoutMs: 45000 });

/** Original pi-ai transport/parser, with per-action and shared session spend bounds. */
export function createDeepSeekEngine(apiKey: string, transport: typeof fetch, budget?: ProviderBudgetLedger): PiEngine {
  if (!apiKey.trim()) throw new Error('Enter a DeepSeek key for this app session first.');
  let requests = 0;
  return {
    model: DEEPSEEK_MODELS['deepseek-flash'],
    level: 'off',
    streamFn: (model, context, options) => {
      if (!budget) throw new ProviderBudgetStateError('A durable session spend ledger is required; provider request blocked.');
      let reservationId: string | undefined;
      const source = stream(model as any, context, {
        ...options,
        apiKey: apiKey.trim(), fetch: transport, maxTokens: DEVELOPMENT_LIMITS.outputTokens,
        maxRetries: 0, timeoutMs: DEVELOPMENT_LIMITS.timeoutMs,
        onPayload: async (payload, requestModel) => {
          const callerPayload = await options?.onPayload?.(payload, requestModel);
          const bounded = { ...((callerPayload ?? payload) as object), model: 'deepseek-flash', max_tokens: DEVELOPMENT_LIMITS.outputTokens, thinking: { type: 'disabled' } };
          const serialized = JSON.stringify(bounded);
          if (++requests > DEVELOPMENT_LIMITS.requests) throw new Error('Development request limit reached. Continue explicitly to run another turn.');
          if (serialized.length > DEVELOPMENT_LIMITS.payloadCharacters) throw new Error('Session exceeds the current development input limit. Start a smaller session.');
          if (reservationId) throw new Error('Provider adapter attempted a duplicate request reservation; request blocked.');
          const reservation = await budget.reserve(serialized, DEVELOPMENT_LIMITS.outputTokens);
          reservationId = reservation.id;
          return bounded;
        },
      });
      const guarded = new AssistantMessageEventStream();
      void (async () => {
        try {
          for await (const event of source) {
            if (event.type === 'done' && reservationId) {
              // Missing usage deliberately leaves the worst-case reservation
              // held. Timeouts, aborts and incomplete streams are uncertain.
              await budget.settle(reservationId, event.message.usage);
              reservationId = undefined;
            }
            guarded.push(event);
          }
          guarded.end();
        } catch (error) {
          // Preserve the stream's final native message while reporting a
          // settlement/persistence failure as an error to the original agent.
          const final = await source.result();
          const failed = { ...final, stopReason: 'error' as const, errorMessage: error instanceof Error ? error.message : 'Provider budget settlement failed.' };
          guarded.push({ type: 'error', reason: 'error', error: failed });
          guarded.end();
        }
      })();
      return guarded;
    },
  };
}

export type NativeRequest = (request: { url: string; method: string; headers: Record<string, string>; body: string; throw: boolean }) => Promise<{ status: number; headers: Record<string, string>; text: string }>;

/** Buffer Obsidian's native mobile/desktop HTTP response, then let original pi-ai parse its SSE.
 * Cancellation stops local waiting; requestUrl cannot promise remote cancellation.
 */
export function createObsidianFetch(request: NativeRequest): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (url !== 'https://api.deepseek.com/chat/completions') throw new Error('Only the configured DeepSeek completion endpoint is supported.');
    const signal = init?.signal ?? (typeof Request !== 'undefined' && input instanceof Request ? input.signal : undefined);
    if (signal?.aborted) throw new DOMException('Operation aborted', 'AbortError');
    const headers = Object.fromEntries(new Headers(init?.headers ?? (typeof Request !== 'undefined' && input instanceof Request ? input.headers : undefined)).entries());
    const body = init?.body;
    if (typeof body !== 'string') throw new Error('Provider request must contain a JSON string body.');
    let timer: ReturnType<typeof setTimeout> | undefined;
    let abort: (() => void) | undefined;
    const interrupted = new Promise<never>((_, reject) => {
      abort = () => reject(new DOMException('Operation aborted', 'AbortError'));
      signal?.addEventListener('abort', abort, { once: true });
      timer = setTimeout(() => reject(new Error('DeepSeek request timed out; no automatic retry.')), DEVELOPMENT_LIMITS.timeoutMs);
    });
    try {
      const pending = request({ url, method: 'POST', headers, body, throw: false }).catch(() => { throw new Error('DeepSeek network request failed.'); });
      const response = await Promise.race([pending, interrupted]);
      if (signal?.aborted) throw new DOMException('Operation aborted', 'AbortError');
      if (response.status < 200 || response.status >= 300) {
        return new Response(JSON.stringify({ error: { message: `DeepSeek HTTP ${response.status}`, type: 'provider_error' } }), { status: response.status, headers: { 'Content-Type': 'application/json' } });
      }
      // Native HTTP APIs may return compressed-length headers after decoding the body.
      const responseHeaders = new Headers(response.headers);
      responseHeaders.delete('content-encoding'); responseHeaders.delete('content-length');
      return new Response(response.text, { status: response.status, headers: responseHeaders });
    } finally {
      if (timer) clearTimeout(timer);
      if (abort) signal?.removeEventListener('abort', abort);
    }
  }) as typeof fetch;
}
