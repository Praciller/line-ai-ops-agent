export type ProjectKey = 'github' | 'opendq' | 'dreamlogs';

export type ProjectState = 'ok' | 'degraded' | 'unavailable';

export type ProjectStatus = {
  key: ProjectKey;
  title: string;
  state: ProjectState;
  summary: string;
  details: readonly string[];
  capturedAt: string;
};

export interface ProjectAdapter {
  getStatus(): Promise<ProjectStatus>;
}
