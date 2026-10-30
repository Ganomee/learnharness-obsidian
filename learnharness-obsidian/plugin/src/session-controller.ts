import type { AgentEvent } from '@earendil-works/pi-agent-core';
import type { PiEngine } from '../../upstream/learnharness/src/agent/models.ts';
import { createProberAgent, createTeacherAgent } from '../../upstream/learnharness/src/agent/teacher-agent.ts';
import type { TeacherToolContext } from '../../upstream/learnharness/src/agent/tools.ts';
import { persistTurn } from '../../upstream/learnharness/src/server/turn-service.ts';
import { runPiTurn } from '../../upstream/learnharness/src/server/pi/ui-stream.ts';
import { inputAppends, parseChatInput, type ChatInput } from '../../upstream/learnharness/src/core/input-events.ts';
import { danglingQuestionOf, hasProbeDone, newHandoffMessage, type LhMessage } from '../../upstream/learnharness/src/core/native-messages.ts';
import { collectToolCallIds } from '../../upstream/learnharness/src/server/pi/call-ids.ts';
import { parseQuizInput, parseAskInput, parseExplainInput } from '../../upstream/learnharness/src/core/tool-parts.ts';
import { toolQuestionKind } from '../../upstream/learnharness/src/core/pending.ts';
import { buildAnswer, normalizeOptions, normalizeQuizType, resolveCorrect, shuffleOptions, seededRandom, toClientQuestion, type AnswerRequest, type QuestionData, type ClientQuestion } from '../../upstream/learnharness/src/core/question-core.ts';
import { SessionStore, type SessionVault, type SessionEnvelope, type SessionStatus } from './storage/session-store';
import { ProviderBudgetLedger, type ProviderBudgetState } from './adapters/provider-budget';

export type { SessionVault, SessionEnvelope, SessionStatus } from './storage/session-store';
export type { AnswerRequest } from '../../upstream/learnharness/src/core/question-core.ts';
export type PendingQuestion = ReturnType<typeof danglingQuestionOf>;
export interface SessionView {
  id: string;
  record: SessionEnvelope['record'];
  pending: PendingQuestion;
  question: ClientQuestion | null;
  status: SessionStatus;
  revision: number;
  needsTeacher: boolean;
  providerMode: 'demo' | 'deepseek';
  providerBudget: ProviderBudgetState;
  branchSnapshotId?: string;
  branchConflict?: boolean;
}
export interface TurnOptions { signal?: AbortSignal; onEvent?: (event: AgentEvent) => void; providerMode?: 'demo' | 'deepseek' }
export type SessionEngine = PiEngine | ((budget: ProviderBudgetLedger) => PiEngine);
export class SessionBusyError extends Error {}
export class SessionCancelledError extends Error {}
const locks = new WeakMap<SessionVault, Set<string>>();
const disabledTools = { read: false, ls: false, find: false, grep: false, research: false, pdf: false, demo: false, visual: false };

/** Adapter-only QuestionData projection follows original QuestionDock, using
 * original parsers, shuffle seed, answer resolution and grading. */
function questionData(pending: NonNullable<PendingQuestion>): QuestionData {
  const kind = toolQuestionKind(pending.tool);
  const input = kind === 'quiz' ? parseQuizInput(pending.input) : kind === 'ask' ? parseAskInput(pending.input) : parseExplainInput(pending.input);
  if (!input) throw new Error('Pending question is malformed; session left unchanged');
  const raw = input as any;
  const options = normalizeOptions(raw.options ?? []);
  const ordered = kind === 'quiz' ? shuffleOptions(options, seededRandom(pending.toolCallId)) : options;
  const qd: QuestionData = { id: pending.toolCallId, kind, questionType: kind === 'quiz' ? normalizeQuizType(raw.type) : undefined, question: raw.question, context: raw.details,
    mode: kind === 'quiz' || (kind === 'ask' && options.length) ? raw.multiSelect === true ? 'multi-select' : 'single-select' : 'text', options: ordered, createdAt: new Date().toISOString() };
  if (kind === 'quiz') { const resolved = resolveCorrect(raw.correctAnswer, ordered); if (resolved.error) throw new Error('Pending answer commitment is invalid'); qd.correctIndices = resolved.indices; qd.explanation = raw.explanation; }
  if (kind === 'explain') qd.committedAnswer = raw.correctAnswer;
  return qd;
}

export class SessionController {
  readonly store: SessionStore;
  private disposed = false;
  private active = new Map<string, AbortController>();
  constructor(readonly vault: SessionVault) { this.store = new SessionStore(vault); }
  private view(envelope: SessionEnvelope): SessionView {
    const pending = danglingQuestionOf(envelope.record.messages);
    let question: ClientQuestion | null = null;
    // An aborted provider can leave an incomplete native call. Preserve it,
    // render no fabricated question, and allow original interruption replay.
    if (pending) { try { question = toClientQuestion(questionData(pending)); } catch { /* original parser refuses incomplete question */ } }
    return { id: envelope.record.id, record: structuredClone(envelope.record), pending: structuredClone(pending), question,
      status: envelope.status === 'running' ? 'interrupted' : envelope.status, revision: envelope.revision,
      needsTeacher: hasProbeDone(envelope.record.messages) && !(envelope.record as any).tree, providerMode: envelope.providerMode,
      providerBudget: structuredClone(envelope.providerBudget) };
  }
  async loadSession(id: string): Promise<SessionView> { return this.view(await this.store.load(id)); }
  async recoverSession(id: string): Promise<SessionView> { return this.exclusive(id, async () => this.view(await this.store.recover(id))); }
  async listSessions(): Promise<SessionView[]> {
    const branches = await this.store.listBranchesForAllSessions();
    return branches.map(branch => ({
      ...this.view(branch.envelope),
      ...(branch.branchCount > 1 ? { branchSnapshotId: branch.snapshotId, branchConflict: true } : {}),
    }));
  }
  async listSessionBranches(id: string) { return this.store.listBranches(id); }
  async resolveSessionBranch(id: string, snapshotId: string): Promise<SessionView> { return this.view(await this.store.resolveBranch(id, snapshotId)); }
  async withProviderBudget<T>(id: string, operation: (budget: ProviderBudgetLedger) => Promise<T>): Promise<{ value: T; session: SessionView }> {
    return this.exclusive(id, async () => {
      let durable = await this.store.load(id);
      const budget = new ProviderBudgetLedger(durable.providerBudget, async providerBudget => {
        const next = structuredClone(durable);
        next.providerBudget = providerBudget;
        next.revision++;
        durable = await this.store.save(next, durable);
      });
      const value = await operation(budget);
      return { value, session: this.view(durable) };
    });
  }
  private async exclusive<T>(id: string, operation: () => Promise<T>): Promise<T> {
    if (this.disposed) throw new SessionCancelledError('Session controller is disposed');
    let busy = locks.get(this.vault); if (!busy) { busy = new Set(); locks.set(this.vault, busy); }
    if (busy.has(id)) throw new SessionBusyError('Session is already running; wait for durable completion');
    busy.add(id);
    try { return await operation(); } finally { busy.delete(id); }
  }
  async createSession(goal: string, engine: SessionEngine, options: TurnOptions = {}): Promise<SessionView> {
    const input = parseChatInput({ type: 'text', text: goal });
    const id = `lh_${crypto.randomUUID().replaceAll('-', '')}`;
    return this.exclusive(id, async () => {
      this.checkSignal(options.signal);
      const now = new Date().toISOString();
      const created = await this.store.create({ id, title: goal.trim().slice(0, 120), createdAt: now, updatedAt: now, messages: [] }, options.providerMode ?? 'demo');
      return this.execute(created, input, engine, options);
    });
  }
  async answer(id: string, callId: string, request: AnswerRequest, engine: SessionEngine, options: TurnOptions = {}): Promise<SessionView> {
    return this.exclusive(id, async () => {
      const envelope = await this.store.load(id);
      const pending = danglingQuestionOf(envelope.record.messages);
      if (!pending || pending.toolCallId !== callId) throw new Error('Answer targets no pending question; session left unchanged');
      const answer = buildAnswer(questionData(pending), request, pending.tool);
      return this.execute(envelope, { type: 'answer', toolCallId: callId, answer }, engine, options);
    });
  }
  async continueSession(id: string, text: string, engine: SessionEngine, options: TurnOptions = {}): Promise<SessionView> {
    return this.exclusive(id, async () => {
      const envelope = await this.store.load(id);
      const pending = danglingQuestionOf(envelope.record.messages);
      let validPending = false;
      if (pending) { try { questionData(pending); validPending = true; } catch { /* interrupted malformed call resumes via original conversion */ } }
      if (validPending) throw new Error('Answer the pending question before continuing');
      return this.execute(envelope, parseChatInput(text.trim() ? { type: 'text', text } : { type: 'continue' }), engine, options);
    });
  }
  private checkSignal(signal?: AbortSignal) { if (this.disposed || signal?.aborted) throw new SessionCancelledError('Session turn cancelled'); }
  private async execute(previous: SessionEnvelope, input: ChatInput, engine: SessionEngine, options: TurnOptions): Promise<SessionView> {
    this.checkSignal(options.signal);
    if (options.providerMode !== undefined && options.providerMode !== previous.providerMode) throw new Error('Session provider mode differs; use the saved provider mode');
    const writeAhead = structuredClone(previous);
    writeAhead.record.messages.push(...inputAppends(writeAhead.record, input));
    writeAhead.record.updatedAt = new Date().toISOString();
    writeAhead.status = 'running'; writeAhead.revision++;
    // No engine is constructed or called until actual Vault acknowledgement.
    const durableInput = await this.store.save(writeAhead, previous);
    const working = structuredClone(durableInput.record);
    const abort = new AbortController();
    this.active.set(working.id, abort);
    const externalAbort = () => abort.abort();
    options.signal?.addEventListener('abort', externalAbort, { once: true });
    let failure: unknown;
    let sawAbort = false;
    const unsupported = () => { throw new Error('Unsupported embedded session storage/background facility'); };
    const memoryStore = new Proxy({ getChat: (id: string) => id === working.id ? working : null,
      saveMessages: (id: string, messages: LhMessage[]) => { if (id !== working.id) unsupported(); working.messages = structuredClone(messages); },
      saveTree: (id: string, tree: unknown) => { if (id !== working.id) unsupported(); (working as any).tree = structuredClone(tree); },
    }, { get(target, key) { return key in target ? target[key as keyof typeof target] : unsupported; } });
    let handoffQueued = false;
    let durable = durableInput;
    const budget = new ProviderBudgetLedger(durable.providerBudget, async providerBudget => {
      const next = structuredClone(durable);
      next.providerBudget = providerBudget;
      next.revision++;
      durable = await this.store.save(next, durable);
    });
    const turnEngine = typeof engine === 'function' ? engine(budget) : engine;
    const run = async (teacher: boolean): Promise<void> => {
      const baseCount = working.messages.length;
      const context: TeacherToolContext = {
        chatId: working.id,
        chatStore: memoryStore as any,
        jobStore: new Proxy({}, { get: () => unsupported }) as any,
        spawn: unsupported,
      };
      const agent = teacher
        ? createTeacherAgent(context, { engine: turnEngine, chatId: working.id, messages: structuredClone(working.messages), toolToggles: disabledTools })
        : createProberAgent({ ...context, deliver: () => { handoffQueued = true; } }, { engine: turnEngine, chatId: working.id, messages: structuredClone(working.messages), toolToggles: disabledTools });
      if (options.onEvent) agent.subscribe(event => { try { options.onEvent!(event); } catch { /* observers cannot alter the learning turn */ } });
      const handlePromise = new Promise<void>((resolve, reject) => {
        const handle = runPiTurn({ agent, usedToolCallIds: new Set(collectToolCallIds(working.messages)),
          onError: error => { failure = error; return 'Session engine failed'; }, onSettleFailure: reject,
          onFinish: (messages, isAborted) => { try { sawAbort ||= isAborted; persistTurn(memoryStore as any, working.id, baseCount, messages, isAborted); resolve(); } catch (error) { reject(error); } },
        });
        abort.signal.addEventListener('abort', () => handle.abort(), { once: true });
        if (abort.signal.aborted) handle.abort();
      });
      await handlePromise;
      const providerError = working.messages.slice(baseCount).find((message: any) => message.role === 'assistant' && ['error', 'aborted'].includes(message.stopReason));
      if (providerError) failure = new Error((providerError as any).errorMessage || 'Provider did not complete the reply');
    };
    try {
      if (this.disposed || options.signal?.aborted) abort.abort();
      if (abort.signal.aborted) throw new SessionCancelledError('Session turn cancelled after input was saved');
      await run(hasProbeDone(working.messages));
      if (handoffQueued && hasProbeDone(working.messages) && !failure && !abort.signal.aborted && !this.disposed) {
        // The original seam is transcript-driven. Persist the successful
        // assessment and native handoff marker before the teacher can run.
        working.messages.push(newHandoffMessage(working.id));
        const handoff = structuredClone(durable);
        handoff.record = structuredClone(working); handoff.record.updatedAt = new Date().toISOString();
        handoff.status = 'running'; handoff.revision++;
        durable = await this.store.save(handoff, durable);
        await run(true);
      }
    } catch (error) { failure = error; }
    finally { options.signal?.removeEventListener('abort', externalAbort); this.active.delete(working.id); }
    const cancelled = sawAbort || abort.signal.aborted || this.disposed;
    const settled = structuredClone(durable);
    settled.record = working; settled.record.updatedAt = new Date().toISOString(); settled.revision++;
    settled.status = cancelled ? 'interrupted' : failure ? 'failed' : 'idle';
    // Failed acknowledgement rejects; next operation reloads actual durable
    // state instead of reusing the uncommitted working snapshot.
    const saved = await this.store.save(settled, durable);
    if (cancelled || this.disposed || options.signal?.aborted) throw new SessionCancelledError(`Session ${working.id} interrupted; saved state can be resumed`);
    if (failure) throw new Error(`Session ${working.id} failed after input was saved; reload and continue`, { cause: failure });
    return this.view(saved);
  }
  dispose() { this.disposed = true; for (const abort of this.active.values()) abort.abort(); }
}
