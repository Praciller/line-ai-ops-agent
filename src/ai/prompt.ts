export const MAX_ASK_QUESTION_CHARS = 500;
export const MAX_AI_CONTEXT_CHARS = 6000;
export const MAX_LINE_REPLY_CHARS = 4800;

export function normalizeAskQuestion(value: string): string {
  return value
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function sanitizeDeterministicContext(value: string): string {
  return value
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/g, ' ')
    .replace(/\t/g, ' ')
    .trim()
    .slice(0, MAX_AI_CONTEXT_CHARS);
}

export function buildAiUserPrompt(question: string, context: string): string {
  return [
    '<untrusted_question>',
    question,
    '</untrusted_question>',
    '<deterministic_context>',
    context,
    '</deterministic_context>',
  ].join('\n');
}
