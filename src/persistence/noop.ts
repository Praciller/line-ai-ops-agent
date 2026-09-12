import type { CommandAudit, CommandAuditInput } from './audit.js';

export class NoopCommandAudit implements CommandAudit {
  async record(_input: CommandAuditInput): Promise<void> {}
}