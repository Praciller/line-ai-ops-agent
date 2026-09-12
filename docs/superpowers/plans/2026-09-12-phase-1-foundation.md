# Phase 1 Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a testable TypeScript foundation with strict free-only configuration, secret-safe logging, health reporting, and a local dry-run entrypoint.

**Architecture:** A small Express service exposes health only; behavior is decomposed into config, logging, health, app, and CLI modules. No LINE, database, project adapters, or live AI calls are introduced in Phase 1.

**Tech Stack:** Node.js >=22, TypeScript, Express, Zod, Vitest, Supertest, tsx.

**Spec:** `docs/superpowers/specs/2026-09-12-personal-ai-ops-line-design.md`

## Global Constraints
- Required monthly infrastructure cost: 0 THB.
- No paid API is required for normal operation.
- No destructive action from LINE in MVP.
- No arbitrary SQL, shell, filesystem, or browser execution exposed as a chat command.
- Existing Dream Logs, OpenDQ, and other repositories must not be modified by Phase 1.
- Secrets stay in environment variables/local secret storage and are never committed.
- The system must remain useful when AI providers are unavailable or rate-limited.
- Production behavior must be introduced by a failing test first.

---
### Task 1: Project harness and free-only configuration

**Files:**
- Create: `package.json`, `tsconfig.json`, `.gitignore`, `.env.example`
- Create: `src/config.ts`
- Test: `tests/config.test.ts`

**Interfaces:**
- Produces: `loadConfig(env: NodeJS.ProcessEnv): AppConfig`
- `AppConfig` exposes `nodeEnv`, `port`, `serviceName`, `logLevel`, `openRouterModel`.

- [ ] **Step 1: Create only the test/build harness config files and install dependencies.**
  Use Node >=22 and ESM. Define `npm test` = `vitest run`, `npm run typecheck` = `tsc --noEmit`, `npm run build` = `tsc`, `npm run dev` = `tsx src/server.ts`, and `npm run dry-run` = `tsx src/cli.ts`.
- [ ] **Step 2: Write failing config tests.**
  Assert defaults include `serviceName=personal-ai-ops-line`, `port=3000`, and `openRouterModel=openrouter/free`; assert a model such as `anthropic/claude-sonnet-4` throws a paid-route configuration error.
- [ ] **Step 3: Run `npm test -- tests/config.test.ts` and confirm RED because `src/config.ts` does not exist.**
- [ ] **Step 4: Implement minimal `src/config.ts` with Zod validation and an explicit equality guard for `OPENROUTER_MODEL=openrouter/free`.**
- [ ] **Step 5: Run config tests and `npm run typecheck`; both must pass.**
- [ ] **Step 6: Commit `chore: scaffold foundation and free-only config`.**

### Task 2: Secret-safe structured logger

**Files:**
- Create: `src/logging.ts`
- Test: `tests/logging.test.ts`

**Interfaces:**
- Produces: `redactSecrets(value: unknown, secrets: readonly string[]): unknown`
- Produces: `createLogger(options)` with `info`, `warn`, `error` methods writing one JSON object per line.
- [ ] **Step 1: Write failing logging tests.**
  Feed nested objects and strings containing configured secret values; expect every secret replaced with `[REDACTED]` and non-secret content preserved.
- [ ] **Step 2: Run `npm test -- tests/logging.test.ts` and confirm RED because logging behavior is missing.**
- [ ] **Step 3: Implement recursive redaction for strings, arrays, and plain objects plus JSON-line log output.**
- [ ] **Step 4: Run logging tests and the full test suite; both must pass.**
- [ ] **Step 5: Commit `feat: add secret-safe structured logging`.**

### Task 3: Health model and Express endpoint

**Files:**
- Create: `src/health.ts`, `src/app.ts`, `src/server.ts`
- Test: `tests/health.test.ts`

**Interfaces:**
- Produces: `buildHealthReport(config: AppConfig): HealthReport`.
- Produces: `createApp(config: AppConfig): Express`. `src/server.ts` loads validated config and listens on `config.port`.
- `GET /health` returns HTTP 200 with service name, `status=ok`, `mode=dry-run`, and Phase 1 component states.

- [ ] **Step 1: Write failing Supertest coverage for `GET /health`.**
  Assert `200`, `application/json`, correct service name, `status: "ok"`, `mode: "dry-run"`, and components `line/database/ai` marked `not_configured`.
- [ ] **Step 2: Run `npm test -- tests/health.test.ts` and confirm RED because app/health modules are missing.**
- [ ] **Step 3: Implement the minimal typed health report and Express app.**
- [ ] **Step 4: Run health tests and full tests; both must pass.**
- [ ] **Step 5: Commit `feat: add foundation health endpoint`.**

### Task 4: Dry-run CLI
**Files:**
- Create: `src/cli.ts`
- Test: `tests/cli.test.ts`

**Interfaces:**
- Produces: `runDryRun(env, write): number`.
- CLI prints one JSON health report and exits 0 on valid configuration; invalid paid-route configuration prints a redacted error and exits non-zero.

- [ ] **Step 1: Write failing CLI tests around `runDryRun`.**
  Capture output through an injected writer; assert valid config emits parseable health JSON and paid OpenRouter model returns exit code 1 without echoing secret env values.
- [ ] **Step 2: Run `npm test -- tests/cli.test.ts` and confirm RED because the CLI module is missing.**
- [ ] **Step 3: Implement minimal CLI using `loadConfig`, `buildHealthReport`, and the secret-safe logger/redaction helper.**
- [ ] **Step 4: Run CLI tests and `npm run dry-run`; both must produce the expected dry-run health output without external calls.**
- [ ] **Step 5: Commit `feat: add local dry-run command`.**

### Task 5: Foundation verification and operator docs

**Files:**
- Create: `README.md`
- Modify: `.env.example`

**Interfaces:**
- Documents local install, tests, typecheck, dry-run behavior, zero-cost contract, and Phase 1 non-goals.

- [ ] **Step 1: Add README instructions that use `npm install`, `npm test`, `npm run typecheck`, and `npm run dry-run`; state that Phase 1 performs no LINE/DB/AI network calls.**
- [ ] **Step 2: Run `npm test`, `npm run typecheck`, `npm run build`, and `npm run dry-run` fresh.**
- [ ] **Step 3: Run `git diff --check` and inspect `git status --short`.**
- [ ] **Step 4: Commit `docs: document phase 1 foundation`.**
- [ ] **Step 5: Compare implementation against Sections 2, 5, 11, 12, 13, and Phase 1 of the approved spec; record any unmet item before calling Phase 1 complete.**

