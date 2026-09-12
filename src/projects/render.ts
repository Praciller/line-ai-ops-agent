import type { ProjectStatus } from './types.js';

export function renderProjectStatus(status: ProjectStatus): string {
  return `${status.title}: ${status.state} - ${status.summary}`;
}

export function renderUnavailable(title: string): string {
  return `${title}: temporarily unavailable`;
}

export function renderToday(lines: readonly string[]): string {
  return ['Today - Project Intelligence', ...lines].join('\n');
}
