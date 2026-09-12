# Phase 3 Project Intelligence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add read-only GitHub, OpenDQ, and Dream Logs intelligence plus deterministic `/github`, `/opendq`, `/dreamlogs`, and resilient `/today` commands.

**Architecture:** Project intelligence sits behind small read-only adapters. External targets come only from validated configuration; LINE text never supplies repository names, paths, URLs, or network targets. GitHub REST and fixed HTTPS checks use injected HTTP clients, explicit timeouts, one bounded retry, short in-memory caching, and deterministic rendering.

**Tech Stack:** Node.js >=22, TypeScript, Express, Vitest, native `fetch`, LINE SDK 11.2.0.

**Spec:** `docs/superpowers/specs/2026-09-12-personal-ai-ops-line-design.md`

## Global Constraints
- Required monthly infrastructure cost: 0 THB.
- No paid API is required for normal operation.
- Read-only adapters only; no GitHub write scopes or project mutation.
- No LINE command accepts filesystem paths, shell, SQL, browser actions, URL targets, repository names, or model names.
- External calls use configured allowlisted targets, explicit timeout, and bounded retry.
- `/today` must remain useful when one or more adapters fail.
- Tests make no real GitHub, LINE, AI, database, or project-site calls.
- Phase 3 does not add Neon, AI inference, Cloudflare Tunnel, jobs, or knowledge retrieval.

---### Task 1: Safe project configuration and shared contracts

**Files:**
- Modify: `.env.example`, `src/config.ts`
- Create: `src/projects/types.ts`, `src/projects/http.ts`
- Test: `tests/project-config.test.ts`, `tests/project-http.test.ts`

**Interfaces:**
- `AppConfig.projects` exposes validated GitHub owner/repo allowlist, fixed OpenDQ/Dream Logs HTTPS URLs, timeout, and cache TTL.
- `ProjectAdapter.getStatus(): Promise<ProjectStatus>` is read-only.
- `ProjectStatus` exposes `key`, `title`, `state`, `summary`, `details`, and `capturedAt`.
- `ProjectHttpClient.request(url): Promise<ProjectHttpResponse>` accepts only URLs passed by configured adapters.

- [ ] Write failing tests for defaults, invalid repository slugs, non-HTTPS project URLs, timeout bounds, and bounded retry behavior.
- [ ] Run focused tests and confirm RED.
- [ ] Implement validated project config, project contracts, and native-fetch HTTP client using `AbortSignal.timeout` with at most two total attempts.
- [ ] Run focused tests, full tests, and typecheck.
- [ ] Commit `feat: add safe project intelligence contracts`.

### Task 2: Read-only GitHub intelligence adapter

**Files:**
- Create: `src/projects/github.ts`, `src/projects/cache.ts`
- Test: `tests/github-adapter.test.ts`, `tests/project-cache.test.ts`

**Interfaces:**
- `GitHubRepoSummary` contains repository name, default branch, pushed time, up to five open PRs, and latest workflow state.
- `GitHubProjectAdapter.getStatus()` summarizes only configured repositories under the configured owner.
- GitHub API base is fixed to `https://api.github.com`; command text cannot change it.
- `CachedProjectAdapter` reuses a successful status for the configured TTL to reduce unauthenticated REST usage.

- [ ] Write failing tests for repository metadata, open PRs, latest workflow, one-repo failure isolation, fixed API origin, and TTL cache behavior.
- [ ] Confirm RED.
- [ ] Implement GitHub REST reads with explicit API headers and normalized error classes; never send write requests.
- [ ] Run focused/full tests and typecheck.
- [ ] Commit `feat: add read-only GitHub project intelligence`.### Task 3: OpenDQ and Dream Logs project adapters

**Files:**
- Create: `src/projects/repository-site.ts`, `src/projects/opendq.ts`, `src/projects/dreamlogs.ts`
- Test: `tests/repository-site-adapter.test.ts`

**Interfaces:**
- A repository-site adapter combines one configured GitHub repository summary with one fixed HTTPS reachability check.
- HTTP reachability is evidence only: a successful HTTP response means `reachable`, not application correctness.
- If GitHub succeeds but the site check fails, status is `degraded`; if both checks fail, status is `unavailable`.
- OpenDQ uses repo `opendq-observatory` and its configured status URL; Dream Logs uses repo `dreamlogsdata` and its configured status URL.

- [ ] Write failing tests for healthy evidence, site-only failure, GitHub-only failure, total failure, and no mutation/network-target override surface.
- [ ] Confirm RED.
- [ ] Implement the shared repository-site adapter and thin OpenDQ/Dream Logs factories.
- [ ] Run focused/full tests and typecheck.
- [ ] Commit `feat: add OpenDQ and Dream Logs adapters`.

### Task 4: Resilient project intelligence service and `/today`

**Files:**
- Create: `src/projects/intelligence.ts`, `src/projects/render.ts`
- Test: `tests/project-intelligence.test.ts`

**Interfaces:**
- `ProjectIntelligence` exposes `github()`, `opendq()`, `dreamlogs()`, and `today()`.
- `today()` executes project adapters concurrently and isolates failures with `Promise.allSettled` semantics.
- Rendering is deterministic, concise, and does not expose raw stack traces, secrets, URLs, or transport internals.
- A failed adapter renders a stable `temporarily unavailable` line while successful adapters remain visible.

- [ ] Write failing tests for all-success digest, one-adapter failure, multiple failures, deterministic ordering, and sanitized failure text.
- [ ] Confirm RED.
- [ ] Implement intelligence aggregation and rendering.
- [ ] Run focused/full tests and typecheck.
- [ ] Commit `feat: add resilient daily project digest`.

### Task 5: LINE command integration

**Files:**
- Modify: `src/line/commands.ts`, `src/line/processor.ts`, `src/app.ts`
- Test: `tests/line-commands.test.ts`, `tests/line-processor.test.ts`, `tests/line-webhook.test.ts`

**Interfaces:**
- Supported project commands are `/github`, `/opendq`, `/dreamlogs`, and `/today` in addition to Phase 2 `/help` and `/status`.
- `executeCommand(text, config, intelligence): Promise<string | null>` handles asynchronous project commands.
- Unknown slash commands still return help; ordinary non-command text returns null.
- The app creates production project intelligence from validated config unless a fake is injected for tests.

- [ ] Write failing parser/executor/processor/webhook tests for all four project commands and ensure ordinary text still performs no adapter call.
- [ ] Confirm RED.
- [ ] Implement async command execution and application wiring without changing owner authorization or dedupe order.
- [ ] Run focused/full tests, typecheck, and build.
- [ ] Commit `feat: expose read-only project commands over LINE`.### Task 6: Phase 3 documentation and acceptance gate

**Files:**
- Modify: `README.md`, `.env.example`
- Create: `docs/phase-3-verification.md`

**Interfaces:**
- Document project targets, zero-cost/read-only behavior, public GitHub REST limits, cache/timeout/retry behavior, project commands, and current limitations.
- Explicitly state that project-site reachability is not a health guarantee and that Phase 3 does not use AI or Neon.

- [ ] Update README and safe example configuration without adding credentials or local absolute paths.
- [ ] Run fresh `npm ci`, `npm test`, `npm run typecheck`, `npm run build`, `npm run dry-run`, `npm audit`, and `git diff --check`.
- [ ] Verify tests perform zero real GitHub/site/LINE/AI/database calls and inspect tracked files/history for secrets or local paths.
- [ ] Create `docs/phase-3-verification.md` with fresh evidence and deferred Phase 4–6 work.
- [ ] Commit `docs: document phase 3 project intelligence`.
- [ ] Push `feat/project-intelligence`, open PR against `main`, verify GitHub Actions, and leave the PR unmerged for owner review.

## Acceptance for Phase 3
- `/github`, `/opendq`, `/dreamlogs`, and `/today` work through read-only adapters.
- `/today` remains useful when at least one adapter fails.
- No command can choose a repository, filesystem path, or URL target.
- External calls have explicit timeout, bounded retry, and cache behavior.
- Tests consume no real external quota.
- Existing Phase 1–2 security, owner authorization, signature verification, and dedupe behavior remain green.
