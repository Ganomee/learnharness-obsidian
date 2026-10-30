import { derivePlanStatusesLh, derivedNodeStatus, type PlanTree } from '../../../upstream/learnharness/src/core/contracts/plan.ts';
import { phaseAt3Lh, type Phase3 } from '../../../upstream/learnharness/src/core/phases.ts';
import { hasProbeDone, type LhMessage } from '../../../upstream/learnharness/src/core/native-messages.ts';

export interface LearningProgress {
  phase: Phase3;
  phaseIndex: number;
  probeAsked: number;
  probeAnswered: number;
  checksAnswered: number;
  checksCorrect: number;
  activeNode: string | null;
  visitedNodes: ReadonlySet<string>;
}

export interface AnswerFeedback {
  label: string;
  verdict: string | null;
  response: string;
  choices: Array<{ label: string; selected: boolean; correct: boolean }>;
  thinking?: string;
  confidence?: number;
  explanation?: string;
  referenceAnswer?: string;
}

/** Render data for the original answer contract without grading open responses. */
export function answerFeedback(answer: any, toolName?: string): AnswerFeedback {
  const label = toolName === 'probe' ? 'Starting-point probe' : toolName === 'recall' ? 'Teacher recall'
    : answer?.kind === 'quiz' ? 'Teacher check' : answer?.kind === 'explain' ? 'Open recall' : 'Open question';
  const verdict = answer?.kind === 'quiz'
    ? answer.dontKnow ? 'Skipped · answer when ready' : answer.correct === true ? 'Correct' : answer.correct === false ? 'Not quite yet · review this step' : null
    : null;
  return {
    label,
    verdict,
    response: answer?.dontKnow ? 'I don’t know yet' : answer?.text || answer?.answers?.map((item: any) => item.label).join(', ') || answer?.committedAnswer || '',
    choices: answer?.kind === 'quiz' && Array.isArray(answer.options) ? answer.options.map((option: any) => ({
      label: String(option.label ?? ''), selected: (answer.answers ?? []).some((item: any) => item.index === option.index),
      correct: (answer.correctIndices ?? []).includes(option.index),
    })) : [],
    ...(typeof answer?.thinking === 'string' && answer.thinking ? { thinking: answer.thinking } : {}),
    ...(typeof answer?.confidence === 'number' ? { confidence: answer.confidence } : {}),
    ...(typeof answer?.explanation === 'string' && answer.explanation ? { explanation: answer.explanation } : {}),
    ...(typeof answer?.committedAnswer === 'string' && answer.committedAnswer ? { referenceAnswer: answer.committedAnswer } : {}),
  };
}

/** Derive the visible session path from the same original native events as LearnHarness. */
export function deriveLearningProgress(messages: readonly LhMessage[], tree?: PlanTree): LearningProgress {
  const phase = phaseAt3Lh(messages);
  const probeCalls = new Map<string, string>();
  const probeResults = new Set<string>();
  const quizCalls = new Set<string>();
  let checksCorrect = 0;

  for (const message of messages as readonly any[]) {
    if (message.role === 'assistant' && Array.isArray(message.content)) {
      for (const block of message.content) {
        if (block.type !== 'toolCall' || typeof block.id !== 'string') continue;
        if (block.name === 'probe' || block.name === 'recall') probeCalls.set(block.id, block.name);
        if (block.name === 'quiz' || block.name === 'explain') quizCalls.add(block.id);
      }
    } else if (message.role === 'toolResult') {
      if ((message.toolName === 'probe' || message.toolName === 'recall') && probeCalls.has(message.toolCallId) && !message.isError && message.details?.kind) {
        probeResults.add(message.toolCallId);
      }
      if ((message.toolName === 'quiz' || message.toolName === 'explain') && quizCalls.has(message.toolCallId) && !message.isError && message.details?.kind) {
        if (message.details.correct === true) checksCorrect++;
      }
    }
  }

  const position = tree ? derivePlanStatusesLh(tree, messages) : { current: null, visited: new Set<string>() };
  return {
    phase,
    phaseIndex: phase === 'probe' ? 0 : phase === 'plan' ? 1 : 2,
    probeAsked: probeCalls.size,
    probeAnswered: probeResults.size,
    checksAnswered: [...quizCalls].filter(id => messages.some((message: any) => message.role === 'toolResult'
      && (message.toolName === 'quiz' || message.toolName === 'explain') && message.toolCallId === id && !message.isError && message.details?.kind)).length,
    checksCorrect,
    activeNode: position.current,
    visitedNodes: position.visited,
  };
}

export function planNodeProgress(tree: PlanTree, progress: LearningProgress): Array<{ id: string; title: string; summary?: string; status: 'current' | 'visited' | 'upcoming' }> {
  const statuses = { current: progress.activeNode, visited: progress.visitedNodes };
  return tree.nodes.map(node => ({ ...node, status: derivedNodeStatus(statuses, node.id) }));
}

export function phaseLabel(phase: Phase3): string {
  return phase === 'probe' ? 'Finding your starting point' : phase === 'plan' ? 'Building your route' : 'Learning and checking each step';
}
