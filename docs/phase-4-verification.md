# Phase 4 Persistence and Observability Verification

Date: 2026-09-13
Branch: `feat/persistence-observability`
Implementation HEAD before documentation commit: `65d9bc722a290ff29342d78d0f3ee9ce9e9685ac`

## Classification

`COMPLETE_WITH_LIMITATION`

Phase 4 code, migrations, automated verification, budget controls, runtime database health, and persistence boundaries are complete. Live migration against a newly provisioned dedicated Neon project is pending because the authenticated Neon organization is managed by Vercel and rejects direct project creation through the Neon API.

The unrelated existing `glms-postgres` project was not reused or modified.

## Implemented scope

- Optional PostgreSQL configuration and bounded `pg` connection pool.
- Transaction abstraction that keeps a transaction on one PostgreSQL client.
- Idempotent committed migration for six Phase 4 tables.
- Durable `webhookEventId` claim with PostgreSQL conflict protection.
- SHA-256 hashing of LINE source IDs before persistence.
- Bounded in-memory dedupe fallback only when durable persistence errors.
- Duplicate command execution is suppressed before project intelligence runs.
- Metadata-only command audit with stable error classes.
- Best-effort project snapshots and deterministic daily digest persistence.
- Provider outcome metadata store for Phase 5 AI routing.
- Atomic proactive-message budget accounting with dry-run support.
- Default monthly hard limit: 250 chargeable sends.
- Default daily proactive hard limit: 5 sends.
- Runtime DB health reports `not_configured`, `ok`, or `unhealthy`.
- Service health becomes `degraded` when a configured DB probe fails.
- Read-only commands remain usable during persistence failure.

## Fresh verification

The following commands were run from a fresh `npm ci` on the current Phase 4 working tree:

```text
npm ci                 PASS
npm test               PASS — 21 test files / 91 tests
npm run typecheck      PASS
npm run build          PASS
npm run dry-run        PASS
npm audit              PASS — 0 vulnerabilities
git diff --check       PASS
compiled test output   0 files
tracked-file hygiene   PASS
```

The local npm policy continued to block the `esbuild@0.28.2` postinstall script. Tests, typecheck, and build still passed, so the policy was not weakened or auto-approved.
## Safety verification

- Production/current secret scan: PASS.
- Git history production secret scan: PASS.
- Dummy PostgreSQL credentials exist only in test fixtures and were classified as non-production fixtures.
- Unsafe non-empty secret assignments: 0.
- Tracked `.env` files other than `.env.example`: 0.
- Local absolute Windows paths in tracked production content: 0.
- Raw LINE user IDs in `src/` or migrations: 0.
- Raw LINE chat transcript persistence paths: none.
- Tests use injected fakes/test doubles and do not consume LINE, AI, GitHub, project-site, or database quota by default.

## Live Neon verification

Planned target: dedicated Neon project `line-ai-ops-agent` in `aws-ap-southeast-1` (Singapore).

Result: `BLOCKED_BY_ACCOUNT_PROVISIONING_POLICY`.

The only authenticated Neon organization is Vercel-managed. Direct project creation through the Neon API is restricted for that organization, and the available Vercel connector does not expose a database-provisioning action. No existing unrelated Neon project was repurposed as a workaround.

Because a dedicated project could not be created safely, these live-only checks remain pending:

- applying `npm run db:migrate` to the dedicated Neon project;
- verifying the six tables against live Neon metadata;
- live DB health probe;
- live budget dry-run smoke test.

## Phase 4 acceptance

```text
PERSISTENCE_OPTIONAL=PASS
DURABLE_DEDUPE_IMPLEMENTED=PASS
DB_FAILURE_FALLBACK=PASS
SOURCE_ID_HASHING=PASS
COMMAND_AUDIT_METADATA_ONLY=PASS
PROJECT_OBSERVABILITY_BEST_EFFORT=PASS
MESSAGE_BUDGET_ATOMIC=PASS
DB_HEALTH_VISIBLE=PASS
AUTOMATED_TEST_GATE=PASS
LIVE_DEDICATED_NEON=BLOCKED_BY_ACCOUNT_PROVISIONING_POLICY
```

Phase 4 is ready for code review with the live-Neon limitation explicitly documented. Phase 5 must not depend on a successful live Neon connection; deterministic behavior remains the required fallback.