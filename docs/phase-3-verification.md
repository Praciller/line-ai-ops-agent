# Phase 3 Project Intelligence Verification

Date: 2026-09-12
Branch: `feat/project-intelligence`
Base: `main` at `856eaef`

## Scope verified

Phase 3 adds deterministic, read-only project intelligence for:

- GitHub public repository metadata, open pull requests, and latest workflow state
- OpenDQ repository evidence plus fixed HTTPS reachability
- Dream Logs repository evidence plus fixed HTTPS reachability
- resilient `/today` aggregation with deterministic ordering and partial-failure isolation
- LINE commands `/github`, `/opendq`, `/dreamlogs`, and `/today`

No Neon persistence, AI inference, Cloudflare Tunnel, proactive push, job radar, or knowledge retrieval is added in this phase.

## Phase 3 commits

- `78ece40` - project intelligence implementation plan
- `d6350e1` - safe project configuration and HTTP contracts
- `44cd482` - read-only GitHub project intelligence
- `9f6c52e` - OpenDQ and Dream Logs adapters
- `b5b5b15` - resilient daily project digest
- `2eaf172` - read-only project commands over LINE

## Fresh verification gate

The following commands were run from the Phase 3 working tree after documentation updates:

```text
npm ci                 PASS - 149 packages installed, 0 vulnerabilities
npm test               PASS - 15 test files, 56 tests
npm run typecheck      PASS
npm run build          PASS
npm run dry-run        PASS
npm audit              PASS - 0 vulnerabilities
git diff --check       PASS
```

The dry-run remained deterministic and reported LINE/database/AI as `not_configured` when their optional configuration was absent.

Build output contained runtime JavaScript only under `dist/`; no compiled test files were emitted.

`npm ci` reported that npm's install-scripts policy blocked the `esbuild@0.28.2` postinstall script because it was not explicitly approved. Tests, typecheck, and build still completed successfully. This was not auto-approved because Phase 3 does not require weakening the local install-script policy.

## Read-only and reliability evidence

- GitHub origin is fixed to `https://api.github.com`.
- GitHub owner/repository targets are startup configuration only; repository names must be simple slugs.
- GitHub requests use API version `2026-03-10` and GET-only HTTP through the shared client.
- External project calls use a bounded timeout and at most two total attempts.
- Successful project status can be cached in memory for the configured TTL.
- OpenDQ and Dream Logs URLs must be configured HTTPS URLs.

- Site HTTP success is rendered only as `reachable` evidence and is not treated as application-health proof.
- Repository-site adapters isolate GitHub failure from site failure and report `degraded` when only one evidence source fails.
- `/today` isolates adapter exceptions and preserves successful project lines.
- Adapter exception messages, stack traces, URLs, and transport internals are not returned in fallback output.
- Existing LINE signature verification, owner allowlist, dedupe, and reply-failure retry semantics remain covered by the full suite.

## Quota and external-call policy

Automated tests use injected fake HTTP/reply/project-intelligence dependencies.

```text
REAL_LINE_API_CALLS_DURING_TESTS=NO
REAL_GITHUB_API_CALLS_DURING_TESTS=NO
REAL_PROJECT_SITE_CALLS_DURING_TESTS=NO
REAL_AI_CALLS_DURING_TESTS=NO
REAL_DATABASE_CALLS_DURING_TESTS=NO
```

A static test-wiring audit found no use of the production project-intelligence factory or native `fetch` path from the test suites.

## Public repository safety audit

```text
TRACKED_ENV=PASS - `.env.example` only
ENV_HISTORY=PASS
LOCAL_PATH_CURRENT=PASS
LOCAL_PATH_HISTORY=PASS
REFINED_SECRET_CURRENT=PASS
REFINED_SECRET_HISTORY=PASS
SECRET_ASSIGN_CURRENT=PASS
SECRET_ASSIGN_HISTORY=PASS
```

The first broad `sk-` prefix scan produced false positives from the phrase `task-by-task` in Superpowers plan documents. A refined boundary/length-aware scan then passed across both the current tree and Git history. No credential value was printed during the audit.

## Deferred by design

- Durable event dedupe, audit history, project snapshots, provider telemetry, and message-budget state move to Phase 4 with Neon.
- OpenRouter Free, optional Groq Free fallback, sanitized AI context, and `/ask` move to Phase 5.
- Cloudflare Tunnel, real LINE webhook configuration, owner-only live E2E, and quota validation move to Phase 6.
- The current phase does not claim live LINE validation or continuous availability.

## Phase 3 acceptance result

```text
PROJECT_COMMANDS=PASS
READ_ONLY_TARGETS=PASS
TODAY_PARTIAL_FAILURE=PASS
BOUNDED_EXTERNAL_CALLS=PASS
ZERO_REAL_EXTERNAL_CALLS_IN_TESTS=PASS
PHASE_1_2_SECURITY_REGRESSION=PASS
PUBLIC_SAFETY_AUDIT=PASS
```

Phase 3 is ready for a feature-branch pull request after the committed-tree verification gate is rerun successfully.
