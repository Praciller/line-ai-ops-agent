# Phase 4 Persistence and Observability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add optional Neon PostgreSQL persistence for durable LINE event dedupe, command audits, project snapshots, daily digests, provider telemetry, message-budget accounting, and database-aware health without making existing read-only commands depend on database availability.

**Architecture:** Persistence sits behind async interfaces. PostgreSQL is configured only through `DATABASE_URL`; tests inject fake stores and make zero real database calls. When Neon is configured, durable dedupe is primary and telemetry is best-effort. When the database is absent or unavailable, read-only commands remain useful through bounded in-memory fallback and explicit degraded health.

**Tech Stack:** Node.js >=22, TypeScript, Express, Vitest, `pg`/node-postgres, Neon PostgreSQL, SQL migrations.

**Spec:** `docs/superpowers/specs/2026-09-12-personal-ai-ops-line-design.md`

## Global Constraints
- Required monthly infrastructure cost remains 0 THB.
- Use a separate Neon Free project for this agent; do not modify unrelated Neon databases.
- No raw LINE chat transcript is stored.
- Raw LINE user IDs are not persisted; store only SHA-256 source hashes where identity evidence is needed.
- Secrets stay in environment variables and are never committed or logged.
- Database outage must not make `/help`, `/status`, `/github`, `/opendq`, `/dreamlogs`, or `/today` unusable.
- Tests make no real LINE, GitHub, project-site, AI, or database calls by default.
- Phase 4 adds no proactive sends and no AI inference; only their accounting/telemetry interfaces.

---

### Task 1: Database configuration, PostgreSQL pool, and migrations

**Files:** Modify `package.json`, `package-lock.json`, `.env.example`, `src/config.ts`; create `src/persistence/types.ts`, `src/persistence/postgres.ts`, `src/persistence/migrations.ts`, `src/persistence/migrate-cli.ts`, `migrations/001_persistence.sql`; test `tests/database-config.test.ts`, `tests/migrations.test.ts`.

**Interfaces:** `AppConfig.database` is `null` or `{ url, connectTimeoutMs, poolMax }`. `DATABASE_CONNECT_TIMEOUT_MS` defaults 3000 (500-10000); `DATABASE_POOL_MAX` defaults 3 (1-5). `DatabaseExecutor.query(text, values?)` is injectable. `runMigrations` creates `schema_migrations` and applies each migration once. `npm run db:migrate` never prints the URL.

**Schema:** `line_events`, `command_runs`, `project_snapshots`, `daily_digests`, `provider_outcomes`, and `message_budget`, with non-negative checks, processing-status checks, and indexes for time/project lookups.

- [ ] Write failing config and migration tests; confirm RED.
- [ ] Install `pg` and `@types/pg` without approving unrelated install scripts.
- [ ] Implement config, pool factory, migration runner/CLI, and SQL schema.
- [ ] Run focused/full tests, typecheck, build, diff-check.
- [ ] Commit `feat: add Neon persistence foundation`.

### Task 2: Durable event ledger and async dedupe

**Files:** Modify `src/line/events.ts`, `src/line/dedupe.ts`, `src/line/processor.ts`, `src/app.ts`; create `src/persistence/event-ledger.ts`, `src/persistence/fallback-dedupe.ts`, `src/security/hash.ts`; update dedupe/processor/webhook tests.

**Interfaces:** normalized events add `eventType`, `sourceIdHash`, `receivedAt`. `EventDeduper.claim(event): Promise<boolean>`, `release(eventId): Promise<void>`, `markProcessed(eventId): Promise<void>`. PostgreSQL claim uses `INSERT ... ON CONFLICT DO NOTHING RETURNING event_id`; fallback is used only when primary throws, never when primary returns duplicate.

- [ ] Write failing hash, async dedupe, durable claim, retry, processed-state, and DB-error fallback tests; confirm RED.
- [ ] Implement event ledger, async contracts, fallback composition, and processor awaits.
- [ ] Preserve owner authorization, duplicate suppression, and reply-failure retry behavior.
- [ ] Run focused/full tests, typecheck, build, diff-check.
- [ ] Commit `feat: add durable LINE event dedupe`.

### Task 3: Command-run audit with failure isolation

**Files:** Create `src/persistence/audit.ts`, `src/persistence/noop.ts`; modify `src/line/processor.ts`, `src/app.ts`; test `tests/command-audit.test.ts` and processor tests.

**Interfaces:** audit stores allowlisted command name only, outcome (`success|ignored|error`), latency, nullable provider/error class, event ID, timestamps. Raw message text and exception messages are not stored. Audit failure never blocks a successful deterministic reply.

- [ ] Write failing success/error/unknown/audit-failure tests; confirm RED.
- [ ] Implement PostgreSQL and no-op audit ports and processor timing.
- [ ] Run focused/full tests, typecheck, build.
- [ ] Commit `feat: add command audit telemetry`.

### Task 4: Project snapshots, daily digests, and provider telemetry

**Files:** Create `src/persistence/observability.ts`, `src/projects/persistent-intelligence.ts`; modify `src/projects/factory.ts`; test persistence and wrapper behavior.

**Interfaces:** save normalized `ProjectStatus` JSON, upsert one deterministic digest per UTC date, and record provider/model/outcome/latency/error-class metadata without prompt/response text. Persistence failures never change user-facing project results.

- [ ] Write failing snapshot/digest/provider/failure-isolation tests; confirm RED.
- [ ] Implement observability store and project-intelligence wrapper.
- [ ] Run focused/full tests, typecheck, build.
- [ ] Commit `feat: persist project observability`.

### Task 5: Atomic message budget and database-aware health

**Files:** Create `src/persistence/budget.ts`, `src/persistence/health.ts`; modify `src/config.ts`, `src/health.ts`, `src/app.ts`, `src/line/commands.ts`; update health/status tests.

**Interfaces:** defaults `MESSAGE_MONTHLY_HARD_LIMIT=250`, `MESSAGE_DAILY_PROACTIVE_HARD_LIMIT=5`. `reserveProactive(at, dryRun)` returns allowed/reason/usage/limits. Dry-run never mutates. Reservation uses one PostgreSQL client transaction and row locking/upsert semantics. Phase 4 does not send proactive messages. DB health is `not_configured|ok|unhealthy`; service health becomes degraded on configured DB failure while read-only commands remain available.

- [ ] Write failing monthly/daily/reset/dry-run/transaction/health/status tests; confirm RED.
- [ ] Implement atomic budget repository and DB health probe with injectable test doubles.
- [ ] Run focused/full tests, typecheck, build.
- [ ] Commit `feat: add message budget and database health`.

### Task 6: Live Neon verification, docs, and PR gate

**Files:** Modify `README.md`, `.env.example`; create `docs/phase-4-verification.md`.

**Live policy:** create dedicated Neon project `line-ai-ops-agent` in `aws-ap-southeast-1` (Singapore), never reuse `glms-postgres`. Keep `DATABASE_URL` only in untracked local secret storage. Apply committed migrations and verify schema with Neon metadata. Live Neon is used only for bounded Phase 4 integration verification; tests remain mock-based.

- [ ] Provision dedicated Neon project after Tasks 1-5 are green.
- [ ] Store connection string locally without echoing it; run `npm run db:migrate`.
- [ ] Verify required tables and a safe health/budget-dry-run smoke path.
- [ ] Update README/example config and create factual verification doc with no secrets.
- [ ] Run fresh `npm ci`, tests, typecheck, build, dry-run, audit, diff-check, and secret/local-path scans.
- [ ] Commit docs, push `feat/persistence-observability`, open PR to `main`, verify CI, leave PR unmerged.

## Acceptance for Phase 4
- Neon is optional at startup and uses a dedicated agent project when enabled.
- Healthy DB provides durable webhook uniqueness; DB outage falls back to bounded local dedupe without disabling read-only commands.
- Persisted LINE identity is hashed; raw user IDs and raw chat transcripts are absent from schema/write paths.
- Audits store allowlisted commands and stable error classes only.
- Project snapshots/digests are best-effort; provider telemetry stores metadata only.
- Budget enforces monthly 250 and daily proactive 5 defaults atomically with dry-run support.
- DB health is visible without leaking connection details.
- Tests pass with zero real external quota and no tracked secrets/local absolute paths.