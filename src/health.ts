import type { AppConfig } from './config.js';
import type { DatabaseHealthState } from './persistence/health.js';

export type ComponentState = 'not_configured' | 'configured' | 'ok' | 'unhealthy';

export type HealthReport = {
  service: string;
  status: 'ok' | 'degraded';
  mode: 'dry-run';
  components: {
    line: ComponentState;
    database: ComponentState;
    ai: ComponentState;
  };
};

export function buildHealthReport(
  config: AppConfig,
  databaseState?: DatabaseHealthState,
): HealthReport {
  const database = config.database
    ? (databaseState ?? 'configured')
    : 'not_configured';
  return {
    service: config.serviceName,
    status: database === 'unhealthy' ? 'degraded' : 'ok',
    mode: 'dry-run',
    components: {
      line: config.line ? 'configured' : 'not_configured',
      database,
      ai: config.ai ? 'configured' : 'not_configured',
    },
  };
}
