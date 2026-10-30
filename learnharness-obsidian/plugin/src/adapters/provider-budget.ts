/**
 * Session-level DeepSeek spend guard. The parent owns persistence so the same
 * serialized ledger can live inside the Markdown session snapshot.
 *
 * Rates are the published peak DeepSeek Flash rates observed on 2026-10-30.
 * Review these before any provider run; unknown/changed pricing must fail
 * closed instead of silently widening the user's $10 ceiling.
 * Source: https://api-docs.deepseek.com/quick_start/pricing/
 */
export const PROVIDER_BUDGET_POLICY = Object.freeze({
  version: 1,
  model: 'deepseek-flash',
  priceRevision: 'DeepSeek-V4.1-Flash-1017',
  checkedOn: '2026-10-30',
  ceilingMicros: 10_000_000,
  peakInputMicrosPerMillionTokens: 300_000,
  peakOutputMicrosPerMillionTokens: 1_200_000,
  maxRequests: 32,
  maxInputPayloadCharacters: 120_000,
  maxOutputTokensPerRequest: 2_048,
  timeoutMs: 45_000,
});

export interface ProviderBudgetReservation {
  id: string;
  maxCostMicros: number;
  inputTokenUpperBound: number;
  outputTokenLimit: number;
}

export interface ProviderBudgetState {
  version: 1;
  policyVersion: 1;
  model: 'deepseek-flash';
  priceRevision: 'DeepSeek-V4.1-Flash-1017';
  ceilingMicros: number;
  spentMicros: number;
  reservations: ProviderBudgetReservation[];
  requestsStarted: number;
}

export type PersistProviderBudget = (state: ProviderBudgetState) => Promise<void>;

export interface ProviderUsage {
  input: number;
  output: number;
  cacheRead?: number;
  cacheWrite?: number;
}

export class ProviderBudgetExceededError extends Error {}
export class ProviderBudgetStateError extends Error {}

export function emptyProviderBudgetState(): ProviderBudgetState {
  return {
    version: PROVIDER_BUDGET_POLICY.version,
    policyVersion: PROVIDER_BUDGET_POLICY.version,
    model: PROVIDER_BUDGET_POLICY.model,
    priceRevision: PROVIDER_BUDGET_POLICY.priceRevision,
    ceilingMicros: PROVIDER_BUDGET_POLICY.ceilingMicros,
    spentMicros: 0,
    reservations: [],
    requestsStarted: 0,
  };
}

function isFiniteInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

export function validateProviderBudgetState(value: unknown): ProviderBudgetState {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ProviderBudgetStateError('Provider budget state is missing or malformed; provider request blocked.');
  const state = value as Partial<ProviderBudgetState>;
  if (state.version !== PROVIDER_BUDGET_POLICY.version || state.policyVersion !== PROVIDER_BUDGET_POLICY.version || state.model !== PROVIDER_BUDGET_POLICY.model || state.priceRevision !== PROVIDER_BUDGET_POLICY.priceRevision || state.ceilingMicros !== PROVIDER_BUDGET_POLICY.ceilingMicros) {
    throw new ProviderBudgetStateError('Provider budget policy changed or is unknown; explicitly review the price cap before continuing.');
  }
  if (!isFiniteInteger(state.spentMicros) || !isFiniteInteger(state.requestsStarted) || !Array.isArray(state.reservations)) throw new ProviderBudgetStateError('Provider budget counters are malformed; provider request blocked.');
  for (const item of state.reservations) {
    if (!item || typeof item.id !== 'string' || !item.id || !isFiniteInteger(item.maxCostMicros) || !isFiniteInteger(item.inputTokenUpperBound) || !isFiniteInteger(item.outputTokenLimit)) {
      throw new ProviderBudgetStateError('Provider budget reservation is malformed; provider request blocked.');
    }
  }
  return structuredClone(state as ProviderBudgetState);
}

function utf8ByteLength(text: string): number {
  if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(text).length;
  // TextEncoder is part of the supported browser runtime. Do not approximate
  // a billable payload if the target environment lacks it.
  throw new ProviderBudgetStateError('Cannot safely estimate provider payload size on this device; request blocked.');
}

function newReservationId(): string {
  if (!globalThis.crypto?.getRandomValues) throw new ProviderBudgetStateError('Secure random IDs are unavailable; provider request blocked.');
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return [...bytes].map(value => value.toString(16).padStart(2, '0')).join('');
}

/**
 * The bound treats every UTF-8 byte as up to two input tokens and adds an
 * allowance for provider chat framing. It prices all input as uncached, at
 * peak price. Output uses the request's enforced max_tokens. This is
 * intentionally conservative and must be kept aligned with the actual API
 * model and price policy. Under the 120,000-character payload cap, 2,048
 * output tokens, and 32-request cap, the current bound is about US$7.01 total,
 * below the US$10 ceiling. Recheck the arithmetic if any limit or price changes.
 */
function worstCaseRequestCost(payload: string, outputTokenLimit: number): { inputTokenUpperBound: number; maxCostMicros: number } {
  if (!Number.isSafeInteger(outputTokenLimit) || outputTokenLimit < 1 || outputTokenLimit > PROVIDER_BUDGET_POLICY.maxOutputTokensPerRequest) {
    throw new ProviderBudgetExceededError('Provider output limit exceeds the reviewed budget policy.');
  }
  if (payload.length > PROVIDER_BUDGET_POLICY.maxInputPayloadCharacters) throw new ProviderBudgetExceededError('Provider payload exceeds the reviewed character limit.');
  const payloadBytes = utf8ByteLength(payload);
  const inputTokenUpperBound = Math.ceil(payloadBytes * 2) + 1_024;
  const inputMicros = Math.ceil(inputTokenUpperBound * PROVIDER_BUDGET_POLICY.peakInputMicrosPerMillionTokens / 1_000_000);
  const outputMicros = Math.ceil(outputTokenLimit * PROVIDER_BUDGET_POLICY.peakOutputMicrosPerMillionTokens / 1_000_000);
  return { inputTokenUpperBound, maxCostMicros: inputMicros + outputMicros };
}

function usageCostMicros(usage: ProviderUsage): number | undefined {
  if (!isFiniteInteger(usage.input) || !isFiniteInteger(usage.output)) return undefined;
  // Price cache reads/writes at the more expensive uncached-input rate so the
  // ledger remains conservative even if provider usage fields evolve.
  const input = Math.ceil(usage.input * PROVIDER_BUDGET_POLICY.peakInputMicrosPerMillionTokens / 1_000_000);
  const output = Math.ceil(usage.output * PROVIDER_BUDGET_POLICY.peakOutputMicrosPerMillionTokens / 1_000_000);
  return input + output;
}

/**
 * A single ledger object must be shared by every billable route for a session.
 * `persist` must durably write the next state before resolving; callers only
 * send a request after `reserve` resolves.
 */
export class ProviderBudgetLedger {
  private state: ProviderBudgetState;
  private queue: Promise<void> = Promise.resolve();

  constructor(initial: unknown, private readonly persist: PersistProviderBudget) {
    this.state = validateProviderBudgetState(initial);
    if (typeof persist !== 'function') throw new ProviderBudgetStateError('Durable budget persistence is unavailable; provider request blocked.');
    if (this.state.spentMicros + this.state.reservations.reduce((sum, reservation) => sum + reservation.maxCostMicros, 0) > this.state.ceilingMicros) {
      throw new ProviderBudgetStateError('Stored provider budget exceeds its ceiling; provider request blocked.');
    }
  }

  snapshot(): ProviderBudgetState { return structuredClone(this.state); }

  private async serialized<T>(operation: () => Promise<T>): Promise<T> {
    const prior = this.queue;
    let release!: () => void;
    this.queue = new Promise<void>(resolve => { release = resolve; });
    await prior;
    try { return await operation(); }
    finally { release(); }
  }

  async reserve(payload: string, outputTokenLimit: number): Promise<ProviderBudgetReservation> {
    const bound = worstCaseRequestCost(payload, outputTokenLimit);
    return this.serialized(async () => {
      const reserved = this.state.reservations.reduce((sum, reservation) => sum + reservation.maxCostMicros, 0);
      if (this.state.requestsStarted >= PROVIDER_BUDGET_POLICY.maxRequests) throw new ProviderBudgetExceededError('The reviewed provider request-count limit is exhausted.');
      if (this.state.spentMicros + reserved + bound.maxCostMicros > this.state.ceilingMicros) throw new ProviderBudgetExceededError('This request could exceed the US$10 session spend ceiling; it was blocked before sending.');
      const reservation: ProviderBudgetReservation = { id: newReservationId(), maxCostMicros: bound.maxCostMicros, inputTokenUpperBound: bound.inputTokenUpperBound, outputTokenLimit };
      const next = { ...this.state, requestsStarted: this.state.requestsStarted + 1, reservations: [...this.state.reservations, reservation] };
      await this.persist(structuredClone(next));
      this.state = next;
      return structuredClone(reservation);
    });
  }

  /** Settle only when the provider returns authoritative token usage. Missing
   * usage keeps the full reservation held, including timeout/abort cases. */
  async settle(reservationId: string, usage: ProviderUsage | undefined): Promise<boolean> {
    const actual = usage && usageCostMicros(usage);
    if (actual === undefined) return false;
    return this.serialized(async () => {
      const current = this.state.reservations.find(reservation => reservation.id === reservationId);
      if (!current) return false;
      const charged = actual;
      const next = {
        ...this.state,
        spentMicros: this.state.spentMicros + charged,
        reservations: this.state.reservations.filter(reservation => reservation.id !== reservationId),
      };
      await this.persist(structuredClone(next));
      this.state = next;
      if (next.spentMicros + next.reservations.reduce((sum, reservation) => sum + reservation.maxCostMicros, 0) > next.ceilingMicros) {
        // Record the authoritative provider charge, then halt later requests.
        throw new ProviderBudgetExceededError('Provider usage exceeded its reserved cost; later requests are blocked pending review.');
      }
      return true;
    });
  }
}
