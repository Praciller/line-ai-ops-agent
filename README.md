# LINE AI Ops Agent

A zero-cost, local-first operations agent controlled through LINE. It combines owner-only LINE transport, deterministic read-only project intelligence, and optional PostgreSQL persistence/observability.

Phase 4 - Persistence and Observability is implemented on `feat/persistence-observability`. Live AI inference, Cloudflare Tunnel, and real LINE end-to-end validation remain deferred.

## Current capabilities

- Node.js 22+ and TypeScript service foundation
- official LINE SDK signature verification on `POST /webhook`
- owner-only command authorization
- duplicate `webhookEventId` suppression before command execution
- `/help`, `/status`, `/github`, `/opendq`, `/dreamlogs`, and `/today`
- read-only GitHub/OpenDQ/Dream Logs adapters with bounded retry and cache
- optional PostgreSQL persistence using `pg`
- durable LINE event ledger when PostgreSQL is healthy, with bounded in-memory fallback on DB failure
- SHA-256 source-ID hashing before persistence; raw LINE user IDs are not written to the persistence schema
- metadata-only command audit records
- best-effort project snapshots and deterministic daily digest persistence
- provider outcome metadata store for later free-AI routing
- proactive-message budget accounting with default monthly cap 250 and daily cap 5
- DB-aware `/health` and runtime `/status` reporting

## Runtime flow

```text
LINE webhook -> signature verification -> owner allowlist -> durable/local dedupe
                                                       |
                                                       v
                                  deterministic command router
                         project adapters / runtime status provider
                                                       |
                         audit + snapshots + digest metadata (best effort)
                                                       |
                                                       v
                                              LINE Reply API
```

## Safety boundaries

- Required monthly infrastructure cost remains 0 THB.
- Database, LINE, and later AI credentials are environment-only and must never be committed.
- Paid OpenRouter model identifiers are rejected by configuration.
- Only configured owner LINE user IDs may execute commands.
- LINE text cannot choose repository names, filesystem paths, URLs, shell commands, SQL, browser actions, or model IDs.
- Project adapters are read-only and use configured allowlists/endpoints only.
- Raw chat transcript content is not part of the Phase 4 persistence schema.
- Command audits store command name, outcome, latency, provider metadata, stable error class, event ID, and timestamps only.
- Database persistence failure does not disable deterministic read-only commands.
- Automated tests use test doubles and do not consume LINE, GitHub, AI, or database quota.

## Commands

- `/help` - list supported commands.
- `/status` - runtime service/component health; reports configured database failures as degraded.
- `/github` - summarize allowlisted public GitHub repositories.
- `/opendq` - read-only OpenDQ repository/site evidence.
- `/dreamlogs` - read-only Dream Logs repository/site evidence.
- `/today` - resilient deterministic digest across configured project adapters.

Unknown slash commands return help. Ordinary text receives no reply.

## Local setup

Requirements: Node.js 22 or newer and npm 12 or compatible.

```bash
npm ci
npm test
npm run typecheck
npm run build
npm run dry-run
```

Run the local service with `npm run dev`. Health endpoint: `GET http://localhost:3000/health`.

## LINE configuration

LINE is optional. Provide all three values together in an untracked `.env` or process environment:

```text
LINE_CHANNEL_SECRET=<secret>
LINE_CHANNEL_ACCESS_TOKEN=<token>
LINE_OWNER_USER_IDS=<comma-separated owner IDs>
```

Partial LINE configuration is rejected at startup.

## Project configuration

```text
PROJECT_GITHUB_OWNER=Praciller
PROJECT_GITHUB_REPOS=line-ai-ops-agent,opendq-observatory,dreamlogsdata
OPENDQ_STATUS_URL=https://opendq-observatory.vercel.app/
DREAMLOGS_STATUS_URL=https://dreamlogsdata.com/
PROJECT_HTTP_TIMEOUT_MS=4000
PROJECT_CACHE_TTL_MS=300000
```

Repository names must be simple slugs and project status URLs must use HTTPS.

## PostgreSQL / Neon persistence

Persistence is optional. Without `DATABASE_URL`, the service retains deterministic commands and process-local dedupe.

```text
DATABASE_URL=
DATABASE_CONNECT_TIMEOUT_MS=3000
DATABASE_POOL_MAX=3
MESSAGE_MONTHLY_HARD_LIMIT=250
MESSAGE_DAILY_PROACTIVE_HARD_LIMIT=5
```

With a dedicated PostgreSQL/Neon database configured, apply committed migrations with:

```bash
npm run db:migrate
```

The migration creates:

- `line_events`
- `command_runs`
- `project_snapshots`
- `daily_digests`
- `provider_outcomes`
- `message_budget`

Database failure is surfaced as `database: unhealthy` and service `degraded`, while read-only commands continue using bounded fallback behavior where applicable.

### Message budget

Phase 4 implements accounting only; it does **not** send proactive messages. Future proactive sends must reserve budget atomically before delivery. Defaults are 250 chargeable messages/month and 5 proactive messages/day. Dry-run budget checks do not mutate counters.

## Current Neon provisioning limitation

The authenticated Neon organization is currently managed by Vercel. Direct creation of the planned dedicated `line-ai-ops-agent` Neon project is restricted by that account policy. The unrelated existing `glms-postgres` project is intentionally not reused or modified.

The persistence implementation, migration, mock-based integration coverage, and configuration are complete, but live dedicated-Neon migration verification remains pending until a standalone Neon project can be provisioned through the account UI/integration.

## Current limitations

- Live dedicated Neon migration verification is pending because the connected Neon organization is Vercel-managed.
- In DB outage mode, dedupe falls back to bounded in-memory state and therefore is not durable across process restarts.
- Project-status cache remains in-memory.
- Site reachability does not prove application correctness or data freshness.
- Live OpenRouter/Groq inference and `/ask` are Phase 5.
- Cloudflare Tunnel and real owner-only LINE E2E validation are Phase 6.

## Roadmap

1. Phase 1 Foundation - complete
2. Phase 2 LINE transport - complete
3. Phase 3 Project intelligence - complete
4. Phase 4 Persistence and observability - code complete; live dedicated-Neon verification pending account provisioning
5. Phase 5 Free AI enhancement - OpenRouter Free, optional Groq Free fallback, `/ask`
6. Phase 6 Live LINE validation - Cloudflare Tunnel and real owner-only E2E
7. Later backlog - job radar and local knowledge retrieval, then carefully scoped HITL write actions

## License

MIT. See [LICENSE](LICENSE).