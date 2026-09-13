import type { ProjectIntelligence } from '../projects/intelligence.js';
import { AiUnavailableError, type AiRouter } from './router.js';
import {
  MAX_ASK_QUESTION_CHARS,
  MAX_LINE_REPLY_CHARS,
  normalizeAskQuestion,
  sanitizeDeterministicContext,
} from './prompt.js';

export type AiAskResult = {
  text: string;
  providerUsed: string | null;
};

export interface AiAskService {
  ask(question: string): Promise<AiAskResult>;
}

export class AiQuestionError extends Error {
  constructor(readonly code: 'question_required' | 'question_too_long') {
    super(code === 'question_required' ? 'Question is required' : 'Question is too long');
    this.name = 'AiQuestionError';
  }
}

type AiAskServiceOptions = {
  projects: ProjectIntelligence;
  router?: AiRouter;
  maxOutputTokens: number;
};

function truncateLineText(value: string): string {
  if (value.length <= MAX_LINE_REPLY_CHARS) return value;
  let result = value.slice(0, MAX_LINE_REPLY_CHARS);
  const last = result.charCodeAt(result.length - 1);
  if (last >= 0xd800 && last <= 0xdbff) result = result.slice(0, -1);
  return result;
}

function deterministicFallback(context: string): AiAskResult {
  return {
    text: truncateLineText(`AI unavailable - deterministic context:\n${context}`),
    providerUsed: null,
  };
}

export function createAiAskService(options: AiAskServiceOptions): AiAskService {
  return {
    async ask(question: string): Promise<AiAskResult> {
      const normalizedQuestion = normalizeAskQuestion(question);
      if (!normalizedQuestion) throw new AiQuestionError('question_required');
      if (normalizedQuestion.length > MAX_ASK_QUESTION_CHARS) {
        throw new AiQuestionError('question_too_long');
      }

      const context = sanitizeDeterministicContext(await options.projects.today());
      if (!options.router) return deterministicFallback(context);

      try {
        const result = await options.router.ask({
          question: normalizedQuestion,
          context,
          maxOutputTokens: options.maxOutputTokens,
        });
        return { text: truncateLineText(result.text), providerUsed: result.providerUsed };
      } catch (error) {
        if (error instanceof AiUnavailableError) return deterministicFallback(context);
        throw error;
      }
    },
  };
}
