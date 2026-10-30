import { createFauxCore, fauxAssistantMessage, fauxToolCall, fauxText } from '@earendil-works/pi-ai';
import type { PiEngine } from '../../../upstream/learnharness/src/agent/models.ts';

/** A clearly labeled scripted exercise, using the original agent/tool runtime. No model or learning replacement. */
export function createDemoEngine(): PiEngine {
  const faux = createFauxCore({});
  let handoffClosing = false;
  let planPresentationNeeded = false;
  let toolId = 0;
  const call = (name: string, input: unknown) => fauxToolCall(name, input, { id: `demo-${name}-${++toolId}` });
  const response = (context: any) => {
    const messages = context.messages as any[];
    const answeredProbe = messages.some(message => message.role === 'toolResult' && message.toolName === 'probe' && message.details?.kind);
    const completedProbe = messages.some(message => message.role === 'assistant' && message.content?.some((part: any) => part.type === 'toolCall' && part.name === 'probe_done'));
    const planned = messages.some(message => message.role === 'toolResult' && message.toolName === 'plan_init' && message.details?.ok);
    const teacherQuizCalls = messages.flatMap(message => message.role === 'assistant'
      ? (message.content ?? []).filter((part: any) => part.type === 'toolCall' && part.name === 'quiz')
      : []);
    const answeredQuiz = (call: any) => messages.some(message => message.role === 'toolResult'
      && message.toolName === 'quiz' && message.toolCallId === call.id && message.details?.kind);
    const prediction = teacherQuizCalls.find((part: any) => part.arguments?.type === 'predict');
    const check = teacherQuizCalls.find((part: any) => part.arguments?.type === 'check');
    if (handoffClosing) {
      handoffClosing = false;
      return fauxAssistantMessage([fauxText('Your assessment is saved. The original teacher is preparing a short plan.')]);
    }
    if (planPresentationNeeded) {
      planPresentationNeeded = false;
      return fauxAssistantMessage([fauxText('The plan starts by identifying each denominator, then combines the counts. Accept it and we will check the key idea.')]);
    }
    if (check && answeredQuiz(check)) return fauxAssistantMessage([fauxText('Scripted exercise complete. Your answer and reasoning are saved in the original session.')]);
    if (planned && !prediction) return fauxAssistantMessage([call('quiz', {
      question: 'Before we combine the groups, what should represent each group in the combined rate?',
      options: [{ label: 'Its success rate alone', value: 'rate' }, { label: 'Its successes and attempts', value: 'counts' }],
      correctAnswer: 'counts', explanation: 'The numerator and denominator preserve each group’s contribution.', nodeId: 'denominator', type: 'predict',
    })], { stopReason: 'toolUse' });
    if (prediction && answeredQuiz(prediction) && !check) return fauxAssistantMessage([
      fauxText('Use the actual counts: add the successes and add the attempts. Here that gives (1 + 9) / (2 + 10), so the combined rate is 10/12. The group with more attempts contributes more weight.'),
      call('quiz', {
      question: 'Why should unequal groups not receive equal weight in the combined rate?',
      options: [{ label: 'Their denominators differ', value: 'denominators' }, { label: 'The smaller rate is always less accurate', value: 'accuracy' }],
      correctAnswer: 'denominators', explanation: 'The larger group represents more attempts.', nodeId: 'combined-rate', type: 'check',
      }),
    ], { stopReason: 'toolUse' });
    if (completedProbe && !planned) {
      planPresentationNeeded = true;
      return fauxAssistantMessage([call('plan_init', { mermaid: 'graph TD\n  denominator[Identify each denominator]\n  combined-rate[Combine successes and attempts]\n  denominator --> combined-rate' })], { stopReason: 'toolUse' });
    }
    if (answeredProbe && !completedProbe) {
      handoffClosing = true;
      return fauxAssistantMessage([call('probe_done', { assessment: { strands: [{ strand: 'weighted rates', assessment: 'can add counts after identifying both denominators' }], summary: 'Ready for a short derivation from denominators to the combined rate.' } })], { stopReason: 'toolUse' });
    }
    return fauxAssistantMessage([call('probe', {
      question: 'Group A has 1 success in 2 attempts; group B has 9 successes in 10 attempts. What is the combined success rate?',
      options: [{ label: '70%', value: 'equal-groups' }, { label: '83⅓%', value: 'weighted' }, { label: '90%', value: 'larger-only' }],
      correctAnswer: 'weighted', explanation: 'Add successes and attempts: (1 + 9) / (2 + 10) = 10/12 = 83⅓%. Equal weighting of unequal groups loses the denominator.',
    })], { stopReason: 'toolUse' });
  };
  faux.setResponses(Array.from({ length: 8 }, () => response));
  return { model: faux.getModel(), streamFn: faux.streamSimple };
}
