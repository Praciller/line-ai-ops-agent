import type { AppConfig } from '../config.js';
import { buildHealthReport } from '../health.js';
import type { ProjectIntelligence } from '../projects/intelligence.js';

export type LineCommand = {
  name: 'help' | 'status' | 'github' | 'opendq' | 'dreamlogs' | 'today';
};

const supported = new Set<LineCommand['name']>([
  'help', 'status', 'github', 'opendq', 'dreamlogs', 'today',
]);

export function parseCommand(text: string): LineCommand | null {
  const normalized = text.trim().toLowerCase();
  if (!normalized.startsWith('/')) return null;
  const name = normalized.slice(1) as LineCommand['name'];
  return supported.has(name) ? { name } : { name: 'help' };
}

export function renderHelp(): string {
  return [
    'LINE AI Ops Agent',
    '/help - show supported commands',
    '/status - show local component status',
    '/github - summarize allowlisted GitHub repositories',
    '/opendq - show OpenDQ read-only evidence',
    '/dreamlogs - show Dream Logs read-only evidence',
    '/today - show resilient project digest',
  ].join('\n');
}

export function renderStatus(config: AppConfig): string {
  const report = buildHealthReport(config);
  return [
    `${report.service} status: ${report.status}`,
    `LINE: ${report.components.line}`,
    `Database: ${report.components.database}`,
    `AI: ${report.components.ai}`,
  ].join('\n');
}

export function routeCommand(text: string, config: AppConfig): string | null {
  const command = parseCommand(text);
  if (!command) return null;
  return command.name === 'status' ? renderStatus(config) : renderHelp();
}

export async function executeCommand(
  text: string,
  config: AppConfig,
  projects: ProjectIntelligence,
): Promise<string | null> {
  const command = parseCommand(text);
  if (!command) return null;

  switch (command.name) {
    case 'status': return renderStatus(config);
    case 'github': return projects.github();
    case 'opendq': return projects.opendq();
    case 'dreamlogs': return projects.dreamlogs();
    case 'today': return projects.today();
    default: return renderHelp();
  }
}
