import { renderProjectStatus, renderToday, renderUnavailable } from './render.js';
import type { ProjectAdapter } from './types.js';

export type ProjectIntelligence = {
  github(): Promise<string>;
  opendq(): Promise<string>;
  dreamlogs(): Promise<string>;
  today(): Promise<string>;
};

type ProjectIntelligenceAdapters = {
  github: ProjectAdapter;
  opendq: ProjectAdapter;
  dreamlogs: ProjectAdapter;
};

async function renderAdapter(adapter: ProjectAdapter, title: string): Promise<string> {
  try {
    return renderProjectStatus(await adapter.getStatus());
  } catch {
    return renderUnavailable(title);
  }
}

export function createProjectIntelligence(
  adapters: ProjectIntelligenceAdapters,
): ProjectIntelligence {
  return {
    github: () => renderAdapter(adapters.github, 'GitHub'),
    opendq: () => renderAdapter(adapters.opendq, 'OpenDQ'),
    dreamlogs: () => renderAdapter(adapters.dreamlogs, 'Dream Logs'),
    async today(): Promise<string> {
      const entries = [
        { adapter: adapters.github, title: 'GitHub' },
        { adapter: adapters.opendq, title: 'OpenDQ' },
        { adapter: adapters.dreamlogs, title: 'Dream Logs' },
      ] as const;
      const results = await Promise.allSettled(
        entries.map(({ adapter }) => adapter.getStatus()),
      );
      const lines = results.map((result, index) =>
        result.status === 'fulfilled'
          ? renderProjectStatus(result.value)
          : renderUnavailable(entries[index]!.title),
      );
      return renderToday(lines);
    },
  };
}
