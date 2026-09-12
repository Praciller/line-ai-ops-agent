import type { AppConfig } from '../config.js';
import { buildHealthReport } from '../health.js';

export type LineCommand = { name: 'help' | 'status' };

export function parseCommand(text: string): LineCommand | null {
  const normalized = text.trim().toLowerCase();
  if (!normalized.startsWith('/')) return null;
  if (normalized === '/status') return { name: 'status' };
  return { name: 'help' };
}

export function renderHelp(): string {
  return [
    'LINE AI Ops Agent',
    '/help — show supported commands',
    '/status — show local component status',
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
