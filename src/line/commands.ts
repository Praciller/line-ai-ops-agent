import type { AppConfig } from '../config.js';
import { buildHealthReport, type HealthReport } from '../health.js';
import type { ProjectIntelligence } from '../projects/intelligence.js';

type SimpleCommandName = 'help' | 'status' | 'github' | 'opendq' | 'dreamlogs' | 'today' | 'jobs';

export type LineCommand =
  | { name: SimpleCommandName }
  | { name: 'ask'; question: string };

const supported = new Set<SimpleCommandName>([
  'help', 'status', 'github', 'opendq', 'dreamlogs', 'today', 'jobs',
]);

export function parseCommand(text: string): LineCommand | null {
  const trimmed = text.trim();
  if (!trimmed.startsWith('/')) return null;
  const whitespace = trimmed.search(/\s/);
  const token = (whitespace === -1 ? trimmed.slice(1) : trimmed.slice(1, whitespace)).toLowerCase();
  const remainder = whitespace === -1 ? '' : trimmed.slice(whitespace).trim();
  if (token === 'ask') return { name: 'ask', question: remainder };
  if (remainder) return { name: 'help' };
  return supported.has(token as SimpleCommandName)
    ? { name: token as SimpleCommandName }
    : { name: 'help' };
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
    '/jobs - show ranked AI/Data/MLOps opportunities',
    '/ask <question> - reason over sanitized project context with free AI fallback',
  ].join('\n');
}

export function renderHealthStatus(report: HealthReport): string {
  return [
    `${report.service} status: ${report.status}`,
    `LINE: ${report.components.line}`,
    `Database: ${report.components.database}`,
    `AI: ${report.components.ai}`,
  ].join('\n');
}

export function renderStatus(config: AppConfig): string {
  return renderHealthStatus(buildHealthReport(config));
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
