import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

async function readJson(path: string) {
  return JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8')) as Record<string, any>;
}

describe('Vercel production TypeScript contract', () => {
  it('keeps test-only globals and eager Node type loading out of production tsconfig', async () => {
    const config = await readJson('../tsconfig.json');

    expect(config.compilerOptions.types).toBeUndefined();
    expect(config.include).toContain('index.ts');
    expect(config.include).not.toContain('tests/**/*.ts');
  });

  it('uses a dedicated test tsconfig for Node and Vitest globals', async () => {
    const config = await readJson('../tsconfig.test.json');

    expect(config.extends).toBe('./tsconfig.json');
    expect(config.compilerOptions.types).toEqual(['node', 'vitest/globals']);
    expect(config.include).toContain('tests/**/*.ts');
  });

  it('pins Node to the approved Vercel major', async () => {
    const pkg = await readJson('../package.json');
    expect(pkg.engines.node).toBe('22.x');
    expect(pkg.scripts.typecheck).toBe('tsc --noEmit -p tsconfig.test.json');
  });
});

describe('Vercel production type dependencies', () => {
  it('ships only the type packages required to compile production source', async () => {
    const pkg = await readJson('../package.json');

    expect(pkg.dependencies['@types/node']).toBeDefined();
    expect(pkg.dependencies['@types/express']).toBeDefined();
    expect(pkg.dependencies['@types/pg']).toBeDefined();
    expect(pkg.devDependencies['@types/supertest']).toBeDefined();
    expect(pkg.devDependencies['vitest']).toBeDefined();
  });
});
