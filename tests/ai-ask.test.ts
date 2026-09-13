import { describe, expect, it } from 'vitest';

import { createAiAskService, AiQuestionError } from '../src/ai/ask.js';
import { buildAiUserPrompt } from '../src/ai/prompt.js';
import { AiUnavailableError, type AiRouter } from '../src/ai/router.js';
import type { AiGenerateInput } from '../src/ai/types.js';
import type { ProjectIntelligence } from '../src/projects/intelligence.js';

function projects(today: string): ProjectIntelligence {
  return {
    github: async () => 'github',
    opendq: async () => 'opendq',
    dreamlogs: async () => 'dreamlogs',
    today: async () => today,
  };
}

function capturingRouter(captured: AiGenerateInput[], text = 'AI answer'): AiRouter {
  return {
    async ask(input) {
      captured.push(input);
      return { text, providerUsed: 'openrouter', model: 'openrouter/free' };
    },
  };
}

describe('AI ask service', () => {
  it('normalizes the owner question before routing', async () => {
    const captured: AiGenerateInput[] = [];
    const service = createAiAskService({
      projects: projects('Today - Project Intelligence'),
      router: capturingRouter(captured),
      maxOutputTokens: 300,
    });

    await service.ask('  What\n\u0000 needs\tattention?  ');
    expect(captured[0]?.question).toBe('What needs attention?');
  });

  it('rejects empty and over-500-character questions', async () => {
    const service = createAiAskService({
      projects: projects('digest'), router: undefined, maxOutputTokens: 300,
    });
    await expect(service.ask(' \n\t ')).rejects.toMatchObject({ code: 'question_required' });
    await expect(service.ask('x'.repeat(501))).rejects.toBeInstanceOf(AiQuestionError);
  });

  it('bounds deterministic context to 6000 characters', async () => {
    const captured: AiGenerateInput[] = [];
    const service = createAiAskService({
      projects: projects('x'.repeat(7000)), router: capturingRouter(captured), maxOutputTokens: 300,
    });
    await service.ask('status?');
    expect(captured[0]?.context).toHaveLength(6000);
  });

  it('formats explicit untrusted question and deterministic context delimiters', () => {
    expect(buildAiUserPrompt('What now?', 'GitHub: ok')).toBe([
      '<untrusted_question>',
      'What now?',
      '</untrusted_question>',
      '<deterministic_context>',
      'GitHub: ok',
      '</deterministic_context>',
    ].join('\n'));
  });

  it('returns bounded AI text with provider metadata on success', async () => {
    const captured: AiGenerateInput[] = [];
    const service = createAiAskService({
      projects: projects('digest'),
      router: capturingRouter(captured, 'A'.repeat(6000)),
      maxOutputTokens: 300,
    });

    const result = await service.ask('What now?');
    expect(result.providerUsed).toBe('openrouter');
    expect(result.text.length).toBeLessThanOrEqual(4800);
  });

  it('falls back to deterministic context when all AI providers are unavailable', async () => {
    const router: AiRouter = {
      async ask() {
        throw new AiUnavailableError();
      },
    };
    const service = createAiAskService({
      projects: projects('Today - Project Intelligence\nGitHub: degraded'),
      router,
      maxOutputTokens: 300,
    });

    const result = await service.ask('What needs attention?');
    expect(result.providerUsed).toBeNull();
    expect(result.text).toContain('Today - Project Intelligence');
    expect(result.text).toContain('GitHub: degraded');
    expect(result.text).not.toContain('AiUnavailableError');
  });

  it('uses the same deterministic fallback when no provider is configured', async () => {
    const service = createAiAskService({
      projects: projects('Dream Logs: ok'), router: undefined, maxOutputTokens: 300,
    });
    await expect(service.ask('status?')).resolves.toEqual({
      text: 'AI unavailable - deterministic context:\nDream Logs: ok',
      providerUsed: null,
    });
  });
});
