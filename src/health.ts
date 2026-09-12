import type { AppConfig } from './config.js';

export type ComponentState = 'not_configured';

export type HealthReport = {
  service: string;
  status: 'ok';
  mode: 'dry-run';
  components: {
    line: ComponentState;
    database: ComponentState;
    ai: ComponentState;
  };
};

export function buildHealthReport(config: AppConfig): HealthReport {
  return {
    service: config.serviceName,
    status: 'ok',
    mode: 'dry-run',
    components: {
      line: 'not_configured',
      database: 'not_configured',
      ai: 'not_configured',
    },
  };
}
