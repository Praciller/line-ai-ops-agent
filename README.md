# LINE AI Ops Agent

A zero-cost, local-first operations agent controlled through LINE. It combines owner-only LINE transport with deterministic, read-only project intelligence for GitHub, OpenDQ, and Dream Logs.

Phase 3 - Project Intelligence is implemented on the current feature branch. Neon persistence, live AI inference, Cloudflare Tunnel, and real LINE end-to-end validation remain intentionally deferred.

## Current capabilities

- Node.js 22+ and TypeScript service foundation
- strict free-only AI route validation
- secret-safe structured logging
- deterministic `/health` and local dry-run CLI
- official LINE SDK signature verification on `POST /webhook`
- owner-only command authorization and duplicate `webhookEventId` suppression
- deterministic `/help`, `/status`, `/github`, `/opendq`, `/dreamlogs`, and `/today`
- public GitHub REST reads for an allowlisted owner/repository set
- fixed HTTPS reachability checks for OpenDQ and Dream Logs
- bounded retry, request timeout, and in-memory project-status caching
- resilient `/today` output when one or more project adapters fail
- injected reply and intelligence ports for quota-free automated tests

## Project intelligence flow

```text
LINE webhook -> signature verification -> owner allowlist -> command router
                                                     |
                                                     v
                              read-only project intelligence
                        GitHub / OpenDQ / Dream Logs adapters
                                                     |
                                                     v
                           deterministic sanitized reply
```

## Safety boundaries

- Required monthly infrastructure cost remains 0 THB.
- Paid OpenRouter model identifiers are rejected by configuration.
- Missing or invalid LINE signatures are rejected before event processing.
- Only configured owner LINE user IDs may execute commands.
- Project targets come only from validated configuration; LINE text cannot choose repository names, filesystem paths, URLs, shell commands, SQL, browser actions, or model IDs.
- GitHub access is read-only and unauthenticated for public repositories in Phase 3.
- Site checks use fixed configured HTTPS endpoints only.
- HTTP success is treated as reachability evidence, not proof that an application is healthy.
- Adapter failures are rendered as stable `temporarily unavailable` text; raw exceptions, stack traces, and transport internals are not returned to LINE.
- `.env` files remain outside Git; `.env.example` contains no credentials.
- Automated tests inject fake LINE/project dependencies and make no real LINE, GitHub, project-site, AI, or database calls.

## Commands

- `/help` - list supported commands.
- `/status` - deterministic service/component status.
- `/github` - summarize configured public GitHub repositories, open PR count, and latest workflow state.
- `/opendq` - combine read-only OpenDQ repository evidence with fixed site reachability.
- `/dreamlogs` - combine read-only Dream Logs repository evidence with fixed site reachability.
- `/today` - deterministic project digest in GitHub -> OpenDQ -> Dream Logs order, with partial-failure isolation.

Unknown slash commands fall back to help. Ordinary text receives no reply.

## Local setup

Requirements: Node.js 22 or newer and npm 12 or compatible.

```bash
npm ci
npm test
npm run typecheck
npm run build
npm run dry-run
```

Run the local HTTP service with `npm run dev`. Health endpoint: `GET http://localhost:3000/health`.

LINE transport is optional. Leave all three LINE values empty to keep LINE disabled. To enable the webhook locally, provide all three together in an untracked `.env` or process environment:

```text
LINE_CHANNEL_SECRET=<LINE channel secret>
LINE_CHANNEL_ACCESS_TOKEN=<LINE channel access token>
LINE_OWNER_USER_IDS=<comma-separated owner LINE user IDs>
```

Partial LINE configuration is rejected at startup. Never commit real values.

## Project configuration

Phase 3 defaults are explicit and can be overridden only through startup configuration, never through LINE command text:

```text
PROJECT_GITHUB_OWNER=Praciller
PROJECT_GITHUB_REPOS=line-ai-ops-agent,opendq-observatory,dreamlogsdata
OPENDQ_STATUS_URL=https://opendq-observatory.vercel.app/
DREAMLOGS_STATUS_URL=https://dreamlogsdata.com/
PROJECT_HTTP_TIMEOUT_MS=4000
PROJECT_CACHE_TTL_MS=300000
```

The GitHub adapter uses API version `2026-03-10`. GitHub currently permits unauthenticated public-data REST requests at 60 requests per hour per originating IP. The default five-minute cache reduces repeated reads, while the HTTP client uses a four-second timeout and at most two total attempts for transient failures.

Repository names must be simple slugs; values such as `owner/repo` or path-like input are rejected. Project status URLs must use HTTPS.

## HTTP behavior

- `GET /health` - deterministic component status.
- `POST /webhook` - 503 when LINE is not configured.
- Missing/invalid LINE signature - 401.
- Signed invalid JSON - 400.
- Valid signed owner webhook - 200 after owner-only command processing.

The current webhook dedupe and project-status cache are intentionally process-local. Durable event/audit/snapshot state moves to Neon in Phase 4.

## Current limitations

- In-memory webhook dedupe does not survive process restarts.
- Project-status cache is in-memory only.
- Public GitHub reads are subject to GitHub's unauthenticated rate limits.
- Site reachability does not prove application correctness, data freshness, or production health.
- Dream Logs/OpenDQ checks do not mutate either project.
- Neon persistence and observability are Phase 4.
- Live OpenRouter/Groq inference and `/ask` are Phase 5.
- Cloudflare Tunnel and real LINE owner-only end-to-end validation are Phase 6.
- Phase 3 automated tests intentionally do not consume real external quota.

## Roadmap

1. Phase 1 Foundation - complete
2. Phase 2 LINE transport - complete
3. Phase 3 Project intelligence - current
4. Phase 4 Persistence and observability - Neon audit/snapshots/durable dedupe/message budget
5. Phase 5 Free AI enhancement - OpenRouter Free, Groq Free fallback, `/ask`
6. Phase 6 Live LINE validation - Cloudflare Tunnel and real owner-only E2E
7. Later backlog - job radar and local knowledge retrieval, followed by carefully scoped HITL write actions if useful

## License

MIT. See [LICENSE](LICENSE).
