import type { AnswerRequest, ClientQuestion } from '../../../upstream/learnharness/src/core/question-core.ts';
import type { NativeRequest } from './deepseek-engine';
import { ProviderBudgetStateError, type ProviderBudgetLedger } from './provider-budget';

export const AI_LEARNER_LIMITS = Object.freeze({ outputTokens: 512, timeoutMs: 20000, profileCharacters: 1200 });

/** One bounded student-role request. The answer key and teacher explanation are deliberately absent. */
export async function simulateLearnerAnswer(input: {
  request: NativeRequest;
  apiKey: string;
  goal: string;
  question: ClientQuestion;
  profile: string;
  budget?: ProviderBudgetLedger;
  signal?: AbortSignal;
}): Promise<AnswerRequest> {
  const apiKey = input.apiKey.trim();
  if (!apiKey) throw new Error('Enter a DeepSeek key before starting the AI learner.');
  if (input.signal?.aborted) throw new Error('AI learner request was cancelled.');
  const profile = input.profile.trim().slice(0, AI_LEARNER_LIMITS.profileCharacters);
  if (!profile) throw new Error('Describe the simulated learner before asking them to answer.');
  const question = input.question;
  if (!input.budget) throw new ProviderBudgetStateError('A durable session spend ledger is required; AI-learner request blocked.');
  const prompt = {
    lessonGoal: input.goal,
    learnerProfile: profile,
    question: question.question,
    context: question.context ?? '',
    answerMode: question.mode,
    options: question.options.map(({ value, label, description }) => ({ value, label, ...(description ? { description } : {}) })),
  };
  const controller = new AbortController();
  const abort = () => controller.abort();
  input.signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(abort, AI_LEARNER_LIMITS.timeoutMs);
  try {
    let rejectOnAbort!: (reason: Error) => void;
    const interrupted = new Promise<never>((_, reject) => { rejectOnAbort = reject; });
    const onAbort = () => rejectOnAbort(new Error('AI learner request was cancelled or timed out.'));
    controller.signal.addEventListener('abort', onAbort, { once: true });
    const body = JSON.stringify({
      model: 'deepseek-flash', stream: false, max_tokens: AI_LEARNER_LIMITS.outputTokens,
      thinking: { type: 'disabled' },
      messages: [
        { role: 'system', content: 'You are simulating a learner, not a tutor. Answer naturally from the learner profile. Do not teach, reveal hidden answers, or claim knowledge not in the profile. Return only a JSON object with keys values (array of exact option values), text (string or empty), thinking (short first-person reasoning), and confidence (integer 0 to 100). For text mode, put the answer in text and use an empty values array. For choice modes, select only supplied values and leave text empty.' },
        { role: 'user', content: JSON.stringify(prompt) },
      ],
    });
    const reservation = await input.budget.reserve(body, AI_LEARNER_LIMITS.outputTokens);
    const pending = input.request({
      url: 'https://api.deepseek.com/chat/completions', method: 'POST', throw: false,
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body,
    }).catch(() => { throw new Error('AI learner network request failed.'); });
    const response = await Promise.race([pending, interrupted]);
    controller.signal.removeEventListener('abort', onAbort);
    if (input.signal?.aborted || controller.signal.aborted) throw new Error('AI learner request was cancelled or timed out.');
    if (response.status < 200 || response.status >= 300) throw new Error(`AI learner request failed (HTTP ${response.status}).`);
    const envelope = JSON.parse(response.text);
    // Keep the maximum reservation if usage is absent or malformed; actual
    // provider cost is then uncertain and must continue to count against cap.
    const rawUsage = envelope.usage;
    const usage = rawUsage && typeof rawUsage === 'object'
      ? { input: rawUsage.prompt_tokens, output: rawUsage.completion_tokens }
      : undefined;
    await input.budget.settle(reservation.id, usage);
    const content = envelope.choices?.[0]?.message?.content;
    if (typeof content !== 'string') throw new Error('AI learner returned no answer.');
    const raw = JSON.parse(content.replace(/^```(?:json)?\s*|\s*```$/g, '')) as Record<string, unknown>;
    const values = Array.isArray(raw.values) ? raw.values.filter((value): value is string => typeof value === 'string') : [];
    const allowed = new Set(question.options.map(option => option.value));
    if (values.some(value => !allowed.has(value)) || (question.mode !== 'text' && !values.length)) throw new Error('AI learner returned an invalid choice; no answer was saved.');
    if (question.mode !== 'multi-select' && values.length > 1) throw new Error('AI learner returned multiple choices for a single-choice question; no answer was saved.');
    const text = typeof raw.text === 'string' ? raw.text.slice(0, 2000) : '';
    if (question.mode === 'text' && !text.trim()) throw new Error('AI learner returned no written answer; no answer was saved.');
    const thinking = typeof raw.thinking === 'string' ? raw.thinking.slice(0, 2000) : '';
    const confidence = typeof raw.confidence === 'number' && Number.isFinite(raw.confidence) ? Math.max(0, Math.min(100, Math.round(raw.confidence))) : 50;
    return { values, ...(text ? { text, other: text } : {}), thinking, confidence };
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error('AI learner returned an unreadable answer; no answer was saved.');
    throw error;
  } finally {
    clearTimeout(timer);
    input.signal?.removeEventListener('abort', abort);
  }
}
