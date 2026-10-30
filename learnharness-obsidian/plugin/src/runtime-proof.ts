import { createFauxCore, fauxAssistantMessage, fauxToolCall, fauxText } from '@earendil-works/pi-ai';
import { createProberAgent, composeInstructions } from '../../upstream/learnharness/src/agent/teacher-agent.ts';
import { newUserMessage, newAnswerResult, danglingQuestionOf, toLlmMessages, type LhMessage } from '../../upstream/learnharness/src/core/native-messages.ts';
import { persistTurn } from '../../upstream/learnharness/src/server/turn-service.ts';
import { buildAnswer, normalizeOptions, resolveCorrect } from '../../upstream/learnharness/src/core/question-core.ts';
import { listSourceSegments } from '../../upstream/learnharness/src/agent/prompt-segments.ts';
import { runPiTurn } from '../../upstream/learnharness/src/server/pi/ui-stream.ts';

const REVISION = '3dc88472eea41eed0d5e5f29c2f16f8d063c415b';
const QUESTION = { question: 'Which fraction equals one half?', options: [{ label: '1/2', value: 'half' }, { label: '1/3', value: 'third' }], correctAnswer: 'half', explanation: 'One of two equal parts is one half.' };
const disabled = { read: false, ls: false, find: false, grep: false, research: false, pdf: false };
function requireCondition(condition: unknown, description: string): asserts condition {
  if (!condition) throw new Error('Runtime proof failed: ' + description);
}
function unsupported(): never { throw new Error('Unsupported runtime proof storage or background facility'); }

export function runtimePromptSnapshot() {
  return { text: composeInstructions('prober'), segments: listSourceSegments('prober').map(s => s.path) };
}

/** No network, credentials, or learning replacement: real upstream factory,
 * question execution, grading, persistence filtering, and native replay. */
export async function runRuntimeProof() {
  const checks: string[] = [];
  const trace: string[] = [];
  const prompts: unknown[] = [];
  const record: any = { id: 'runtime-proof', title: 'Scripted original-agent proof', messages: [] };
  const chatStore: any = new Proxy({
    getChat: (id: string) => id === record.id ? record : null,
    saveMessages: (id: string, messages: LhMessage[]) => { requireCondition(id === record.id, 'store identity'); record.messages = structuredClone(messages); },
  }, { get(target, key) { return key in target ? target[key as keyof typeof target] : unsupported; } });
  const ctx: any = { chatId: record.id, chatStore, jobStore: new Proxy({}, { get: () => unsupported }), spawn: unsupported, deliver: unsupported };
  const faux = createFauxCore({});
  let providerCalls = 0;
  faux.setResponses([
    context => { providerCalls++; prompts.push(structuredClone(context.messages)); return fauxAssistantMessage([fauxToolCall('probe', { ...QUESTION, correctAnswer: 'absent' }, { id: 'invalid-question' })], { stopReason: 'toolUse' }); },
    context => { providerCalls++; prompts.push(structuredClone(context.messages)); return fauxAssistantMessage([fauxToolCall('send_to_user', { message: 'Scripted question follows.' }, { id: 'display-1' }), fauxToolCall('probe', QUESTION, { id: 'question-1' })], { stopReason: 'toolUse' }); },
    context => { providerCalls++; prompts.push(structuredClone(context.messages)); return fauxAssistantMessage([fauxText('The scripted provider received the learner answer.')]); },
  ]);
  // A Claude-shaped fake model enables the ORIGINAL send_to_user tool so a
  // mixed ordinary-result/question batch exercises the finishTurn stopper.
  const engine = { model: { ...faux.getModel(), id: 'claude-scripted-proof' }, streamFn: faux.streamSimple };
  const agent = createProberAgent(ctx, { engine, chatId: record.id, messages: [newUserMessage('Help me understand fractions.')], toolToggles: disabled });
  agent.subscribe(e => trace.push(e.type));
  async function runTurn(current: typeof agent, baseCount: number) {
    await new Promise<void>((resolve, reject) => {
      runPiTurn({ agent: current, onError: error => { reject(error); return String(error); }, onSettleFailure: reject,
        onFinish: (messages, isAborted) => { persistTurn(chatStore, record.id, baseCount, messages, isAborted); resolve(); },
      });
    });
  }
  await runTurn(agent, 0);
  requireCondition(providerCalls === 2, 'invalid question retries, valid question stops');
  const errors = agent.state.messages.filter((m: any) => m.role === 'toolResult' && m.isError);
  requireCondition(errors.length === 1 && (errors[0] as any).toolCallId === 'invalid-question', 'invalid question error keeps call identity');
  requireCondition(agent.state.messages.some((m: any) => m.role === 'toolResult' && m.toolCallId === 'display-1' && !m.isError), 'ordinary tool in mixed batch executes');
  checks.push('Original prober retries invalid question and stops after valid mixed output/question batch');
  requireCondition(!record.messages.some((m: any) => m.role === 'system'), 'original wire settlement omits request system chrome');
  requireCondition(!record.messages.some((m: any) => m.role === 'toolResult' && m.toolCallId === 'question-1'), 'synthetic question placeholder is omitted');
  const pending = danglingQuestionOf(record.messages);
  requireCondition(pending?.toolCallId === 'question-1', 'question remains pending after persistence');
  checks.push('Original persistence stamps native records, keeps errors, and omits synthetic question placeholder');
  const options = normalizeOptions(QUESTION.options);
  const answer = buildAnswer({ id: 'question-1', kind: 'quiz', question: QUESTION.question, mode: 'single-select', options, correctIndices: resolveCorrect(QUESTION.correctAnswer, options).indices, explanation: QUESTION.explanation, createdAt: new Date().toISOString() }, { values: ['half'] }, 'probe');
  requireCondition(answer.correct === true, 'original grading accepts correct option');
  record.messages.push(newAnswerResult('question-1', 'probe', answer));
  const restored: LhMessage[] = JSON.parse(JSON.stringify(record.messages));
  const baseCount = restored.length;
  const resumed = createProberAgent(ctx, { engine, chatId: record.id, messages: restored, toolToggles: disabled });
  resumed.subscribe(e => trace.push(e.type));
  await runTurn(resumed, baseCount);
  requireCondition(providerCalls === 3, 'resumed agent calls provider exactly once');
  const nativeAnswer = record.messages.find((m: any) => m.role === 'toolResult' && m.toolCallId === 'question-1');
  requireCondition(nativeAnswer?.details?.correct === true && nativeAnswer?.toolName === 'probe', 'answer identity and full details survive reconstruction');
  requireCondition(danglingQuestionOf(record.messages) === null, 'answer resolves pending question');
  const lastPrompt = prompts[2] as any[];
  requireCondition(lastPrompt.some(m => m.role === 'toolResult' && m.toolCallId === 'question-1' && JSON.stringify(m.content).includes('1/2')), 'resumed provider sees actual paired learner answer');
  requireCondition(toLlmMessages(restored).every((m: any) => !('id' in m)), 'model-facing conversion strips record IDs');
  checks.push('Original grading and native answer helpers preserve call identity and details through JSON restart and agent reconstruction');
  checks.push('Reconstructed original agent sends paired learner answer to deterministic provider');
  return { upstreamRevision: REVISION, provider: 'faux; no external requests', checks, providerCalls, promptSegments: runtimePromptSnapshot().segments, transcript: record.messages, trace,
    limitations: ['Scripted deterministic provider; no live model or credentials', 'In-memory synchronous test store; not Obsidian Vault API persistence', 'File, job, graph, prompt override and automatic provider facilities unsupported', 'Prober interaction only; full probe-to-teacher orchestration not yet integrated', 'Browser-target bundle does not establish physical mobile compatibility'] };
}
