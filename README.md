# LINE AI Ops Agent

A zero-cost, local-first operations agent controlled through LINE. It combines owner-only LINE transport, deterministic read-only project intelligence, optional PostgreSQL observability, and optional free-only AI reasoning.

Phases 1-6 are complete and the production LINE webhook is live on Vercel Hobby. The local PC is not required to keep the production webhook reachable. Dedicated Neon live verification remains pending because persistence is optional and the connected Neon organization is Vercel-managed.

## Current capabilities

- Node.js 22+ and TypeScript service foundation
- official LINE SDK signature verification on `POST /webhook`
- owner-only command authorization and pre-execution webhook dedupe
- `/help`, `/status`, `/github`, `/opendq`, `/dreamlogs`, `/today`, `/jobs`, and `/ask <question>`
- read-only GitHub/OpenDQ/Dream Logs adapters with bounded retry and cache
- read-only `/jobs` radar using fixed public Jobicy, Himalayas, and Remote OK feeds with deterministic Thailand-first ranking
- optional PostgreSQL durable dedupe, audit, snapshots, digests, provider telemetry, and message-budget accounting
- OpenRouter `openrouter/free` as the primary optional AI route
- optional Groq fallback locked to `openai/gpt-oss-20b`
- normalized bounded questions and deterministic project context only; no unrestricted tools or filesystem content reach AI providers
- deterministic `/today` and deterministic `/ask` fallback when AI is unavailable
- DB-aware `/health` and runtime `/status` reporting

## Runtime flow

```text
LINE webhook -> signature verification -> owner allowlist -> durable/local dedupe
                                                       |
                                                       v
                                  deterministic command router
                           project adapters / /today digest
                              |                  |
                              |                  +-> /ask free-AI router
                              |                      OpenRouter Free -> Groq
                              |                              |
                              +------ sanitized context <---+
                                                       |
                                  audit/telemetry (metadata only)
                                                       |
                                                       v
                                              LINE Reply API
```

## Public deployment shape

The intended zero-cost deployment uses Vercel Hobby with the Express entrypoint in `index.ts` and the production alias `line-ai-ops-agent.vercel.app`. Vercel stores only the required production environment variables; `DATABASE_URL` remains unset until a dedicated persistence decision is made. No tunnel, VPN overlay, or paid runtime is required.

## Safety boundaries

- Required monthly infrastructure cost remains 0 THB.
- LINE, database, OpenRouter, and Groq credentials are environment-only and must never be committed.
- OpenRouter is locked to `openrouter/free`; paid OpenRouter model identifiers fail configuration validation.
- Groq is locked to `openai/gpt-oss-20b`; any other Groq model identifier fails configuration validation.
- Only configured owner LINE user IDs may execute commands.
- LINE text cannot choose repository names, filesystem paths, URLs, shell commands, SQL, browser actions, providers, or model IDs.
- `/jobs` uses only fixed HTTPS hosts and fixed internal source queries; LINE input cannot supply a fetch URL or arbitrary upstream query.
- AI receives only a normalized owner question and sanitized deterministic `/today` context.
- Provider errors never include API keys or upstream response bodies.
- Command audit stores command name, outcome, latency, provider name, stable error class, event ID, and timestamps only; raw `/ask` questions are not persisted.
- Provider telemetry stores provider/model/outcome/latency/error class only; prompts and responses are not persisted.
- Database or AI failure does not disable deterministic read-only commands.
- Automated tests use test doubles and consume no real LINE, GitHub, AI, or database quota.

## Commands

- `/help` - list supported commands.
- `/status` - runtime service/component status.
- `/github` - summarize allowlisted public GitHub repositories.
- `/opendq` - read-only OpenDQ repository/site evidence.
- `/dreamlogs` - read-only Dream Logs repository/site evidence.
- `/today` - resilient deterministic digest across configured project adapters; never calls AI.
- `/ask <question>` - optional AI reasoning over sanitized deterministic context with deterministic fallback.

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

`npm run jobs:smoke` is an explicit live smoke for the three public job feeds. It is never run by normal CI and should not be looped or scheduled more frequently than provider guidance allows.

For a production deployment, configure the environment variables in the hosting provider rather than committing a local `.env` file. The same deterministic test, typecheck, build, and dry-run gates apply before deployment.

Phase 6 deployment evidence is tracked in [`docs/phase-6-verification.md`](docs/phase-6-verification.md). Phase 7 job-radar verification is tracked in [`docs/phase-7-verification.md`](docs/phase-7-verification.md).

## LINE configuration

LINE is optional. Provide all three values together in an untracked `.env` or process environment:

```text
LINE_CHANNEL_SECRET=<secret>
LINE_CHANNEL_ACCESS_TOKEN=<token>
LINE_OWNER_USER_IDS=<comma-separated owner IDs>
```

Partial LINE configuration is rejected at startup.

## Free AI configuration

AI is optional. Without provider keys, `/ask` falls back to deterministic project context and the rest of the bot remains fully usable.

```text
OPENROUTER_MODEL=openrouter/free
OPENROUTER_API_KEY=
GROQ_MODEL=openai/gpt-oss-20b
GROQ_API_KEY=
AI_PROVIDER_ORDER=openrouter,groq
AI_REQUEST_TIMEOUT_MS=8000
AI_MAX_OUTPUT_TOKENS=400
```

`OPENROUTER_MODEL` and `GROQ_MODEL` are fail-closed model locks. Provider order may contain only unique `openrouter` and `groq` tokens. A provider without a configured key is skipped.

The AI request path allows one bounded attempt per configured provider. Timeout, 429, 5xx, network, or malformed-response failures fall through to the next configured free provider; all-provider failure returns deterministic project context rather than failing the bot.

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

The migration creates `line_events`, `command_runs`, `project_snapshots`, `daily_digests`, `provider_outcomes`, and `message_budget`.

Database failure is surfaced as `database: unhealthy` and service `degraded`, while deterministic read-only commands continue using bounded fallback behavior where applicable.

### Message budget

Phase 4 implements accounting only; it does **not** send proactive messages. Future proactive sends must reserve budget atomically before delivery. Defaults are 250 chargeable messages/month and 5 proactive messages/day. Dry-run budget checks do not mutate counters.

## Current limitations

- Live dedicated Neon migration verification is pending because the connected Neon organization is Vercel-managed; the unrelated `glms-postgres` project is intentionally not reused.
- Groq live inference verification is pending explicit confirmation that the current Groq account/key is on the Free Plan. The key is available locally, but no Groq inference request is made until that zero-cost condition is verified.
- In DB outage mode, dedupe falls back to bounded in-memory state and therefore is not durable across process restarts.
- Project-status and Phase 7 job-feed caches remain in-memory and may be lost on Vercel cold start.
- Job-feed availability and location metadata are controlled by public upstream sources; `/jobs` degrades truthfully rather than fabricating matches.
- Site reachability does not prove application correctness or data freshness.

## Roadmap

1. Phase 1 Foundation - complete
2. Phase 2 LINE transport - complete
3. Phase 3 Project intelligence - complete
4. Phase 4 Persistence and observability - complete with live dedicated-Neon provisioning limitation
5. Phase 5 Free AI enhancement - code complete; OpenRouter Free live smoke verified; Groq live smoke pending Free Plan confirmation
6. Phase 6 Live LINE validation - complete; Vercel Hobby deployment, Messaging API webhook verification, Use webhook activation, and real owner-only `/status` E2E all verified
7. Phase 7 Job radar - implementation in progress; owner-only, read-only, zero-cost, deterministic matching across Jobicy/Himalayas/Remote OK
8. Later backlog - local knowledge retrieval, then carefully scoped HITL write actions

## License

MIT. See [LICENSE](LICENSE).
