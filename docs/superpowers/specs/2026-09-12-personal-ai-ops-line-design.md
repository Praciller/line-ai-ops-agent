# Personal AI Ops Agent via LINE — Design Spec

Date: 2026-09-12
Status: Proposed for owner review
Working repo: `personal-ai-ops-line`

## 1. Goal
Build a personal LINE-based command center that connects the owner's existing engineering ecosystem without becoming another standalone portfolio site.

The agent should answer operational questions, summarize project status, surface important issues, and optionally use free AI inference for summarization/reasoning.

## 2. Hard constraints
- Required monthly infrastructure cost: 0 THB.
- No paid API is required for normal operation.
- No destructive action from LINE in MVP.
- No arbitrary SQL, shell, filesystem, or browser execution exposed as a chat command.
- Existing Dream Logs, OpenDQ, and other repositories must not be modified by the MVP.
- Secrets stay in environment variables/local secret storage and are never committed.
- The system must remain useful when AI providers are unavailable or rate-limited.

## 3. Recommended approach
Use a local-first desktop service on the Windows workstation, exposed to LINE through Cloudflare Tunnel.

This is preferred because it can safely read allowlisted local project status and does not require paid always-on hosting.

The trade-off is explicit: the agent is available only while the workstation and service are running.
## 4. Alternatives considered
### A. Local-first desktop agent — selected
Pros: zero required hosting cost, can inspect allowlisted local repos, simple deployment, good fit for personal use.
Cons: unavailable when the workstation is off; tunnel lifecycle must be managed.

### B. Cloud-only serverless webhook
Pros: always available and can stay within free tiers.
Cons: cannot directly inspect local repositories or desktop state; pushes more state and integrations into cloud services.

### C. Cloud relay + local worker
Pros: always-on LINE endpoint plus local capabilities.
Cons: significantly more moving parts, authentication, queues, and failure modes; rejected for MVP as unnecessary complexity.

## 5. Free-only service policy
- LINE Official Account Free plan for the chat surface.
- Cloudflare Tunnel for public ingress from LINE to the local webhook.
- Neon Free PostgreSQL for durable agent state/audit history.
- OpenRouter `openrouter/free` as the default optional AI route.
- Groq Free plan as an optional secondary AI provider.
- Deterministic non-AI fallback for every core command.
- GitHub public REST API for read-only public repository data initially; authenticated access can be added later with an owner-supplied token.

The application must never automatically upgrade, subscribe, or fall back to a paid model/service.
## 6. MVP command surface
- `/help` — list supported commands and current provider/database status.
- `/today` — concise operational digest from configured project adapters.
- `/github` — read-only public GitHub repository/PR/workflow summary for allowlisted repos.
- `/opendq` — OpenDQ project status using configured GitHub/HTTP/local read-only checks.
- `/dreamlogs` — Dream Logs status using configured GitHub/HTTP/local read-only checks.
- `/ask <question>` — optional AI summarization/reasoning over sanitized adapter output only.
- `/status` — service, database, tunnel-facing health, AI-provider availability, and message-budget state.

MVP deliberately excludes `/jobs` and `/learn`; those become Phase 2 after the core transport, safety, and observability layers are proven.

## 7. Architecture
```text
LINE user
   |
   v
LINE Messaging API
   |
   v
Express webhook -> signature verification -> event dedupe -> command router
                                                   |
                  +--------------------------------+------------------+
                  |                                |                  |
             project adapters                AI router          audit/memory
          GitHub/OpenDQ/DreamLogs       OpenRouter Free -> Groq      Neon
                  |                                |
                  +------------ sanitized context-+
                               |
                               v
                         reply composer
                               |
                               v
                         LINE Reply API
```
## 8. Component boundaries
### Webhook gateway
Receives LINE events, validates the LINE signature, rejects unsupported event types, and emits normalized commands. It does not contain project-specific business logic.

### Command router
Maps an allowlisted command to one handler. Unknown commands return help text. Command arguments are validated before adapters are called.

### Project adapters
Each adapter exposes a small read-only interface such as `getStatus()` and `getDigest()`. Local access is restricted to explicit configured repository paths; no user-provided path is accepted.

### AI router
Receives sanitized structured facts, never raw environment variables or unrestricted filesystem contents. Provider order is configurable, with free-only providers and deterministic fallback.

### Persistence
Neon stores event dedupe keys, audit metadata, daily digests, provider outcomes, and message-budget counters. It does not store secrets.

## 9. Data model
Minimum tables:
- `line_events`: event id/hash, type, source id hash, received time, processing status.
- `command_runs`: command, outcome, latency, provider used, error class, timestamps.
- `project_snapshots`: project key, normalized JSON status, captured time.
- `daily_digests`: date, deterministic digest, optional AI-enhanced digest.
- `message_budget`: month, chargeable sends, hard limit, last updated.

No raw LINE chat transcript retention is required for MVP.
## 10. Free-tier guardrails
LINE Free currently provides 300 broadcast messages/month in Thailand. The MVP therefore prefers Reply API responses to interactive commands and does not schedule broadcast traffic by default.

Any future proactive push notification must pass a budget guard:
- default monthly hard cap: 250 chargeable messages;
- default daily proactive cap: 5;
- no broadcast to follower lists in MVP;
- dry-run mode must be available for scheduled/proactive messages;
- when the cap is reached, log the event and do not send.

AI routing must use only providers/models explicitly marked free in configuration. `openrouter/free` is the default route; Groq Free is optional. A paid model identifier fails configuration validation.

## 11. Security boundaries
- Verify LINE webhook signatures before parsing commands.
- Permit only explicitly configured LINE user IDs to run owner commands.
- Use hashed source IDs in audit tables where the raw ID is unnecessary.
- Read-only adapters only; no GitHub write scopes in MVP.
- No command may accept a filesystem path, shell command, SQL string, URL target, or model name directly from LINE.
- HTTP project checks use an allowlist of configured endpoints.
- Secrets are loaded from environment variables and redacted from logs.
- AI prompts receive normalized facts only, not arbitrary local file contents.
- Rate-limit inbound commands per owner/source to reduce abuse and loops.
## 12. Reliability and error handling
- LINE events are idempotent: duplicate webhook delivery must not repeat command execution.
- Adapter failures are isolated; one project failure must not break `/today`.
- AI 429/5xx/timeout falls back to deterministic output.
- Database failure returns a degraded-but-useful response when the command does not require persistence.
- External calls use explicit connect/read timeouts and bounded retries.
- Health endpoints distinguish `ok`, `degraded`, and `unhealthy`.

## 13. Testing strategy
Implementation follows test-driven development.

Required automated tests:
- LINE signature validation and invalid-signature rejection.
- webhook event normalization and duplicate suppression.
- command routing, validation, and unknown-command behavior.
- owner authorization.
- each project adapter with mocked external/local inputs.
- free-model configuration guard and provider fallback.
- secret/log redaction.
- message-budget hard stops.
- `/today` partial-failure behavior.
- health endpoint states.

Integration tests use mocks/test doubles and must not consume LINE or AI quota by default.
## 14. Implementation phases
### Phase 1 — Foundation
TypeScript service, config validation, logging/redaction, health endpoint, test harness, and local dry-run CLI.

### Phase 2 — LINE transport
Webhook signature verification, owner authorization, dedupe, `/help`, `/status`, and reply composer.

### Phase 3 — Project intelligence
Read-only adapters for GitHub, OpenDQ, and Dream Logs; `/github`, `/opendq`, `/dreamlogs`, and deterministic `/today`.

### Phase 4 — Persistence and observability
Neon schema/migrations, audit records, project snapshots, provider telemetry, and message-budget accounting.

### Phase 5 — Free AI enhancement
OpenRouter Free provider, Groq Free fallback, normalized-context prompts, timeout/429 fallback, and `/ask`.

### Phase 6 — Live LINE validation
Cloudflare Tunnel setup, real webhook verification, owner-only end-to-end tests, quota/budget verification, and runbook.

### Phase 7 — Phase-2 backlog after stable MVP
Job radar and local knowledge-base retrieval, followed later by carefully scoped HITL write actions if useful.
## 15. Acceptance criteria for MVP
MVP is complete only when all of the following are true:
- all automated tests pass without real external quota consumption;
- invalid LINE signatures and non-owner commands are rejected;
- duplicate LINE events execute at most once;
- `/help`, `/status`, `/github`, `/opendq`, `/dreamlogs`, `/today`, and `/ask` work end-to-end;
- `/today` remains useful when one adapter and all AI providers fail;
- no required service has a monthly charge;
- configuration rejects known paid AI routes;
- proactive sends cannot exceed configured daily/monthly caps;
- logs contain no configured secret values;
- no LINE command can trigger arbitrary shell/SQL/filesystem/network targets;
- real LINE validation is performed with owner-only access and documented rollback/stop steps.

## 16. Cost contract verified for this design
Verified on 2026-09-12 against current provider documentation:
- LINE OA Free: 0 THB/month with 300 broadcast messages/month in Thailand.
- Neon Free: free plan remains available; intended capacity is sufficient for this personal MVP.
- Cloudflare Tunnel: available on all Cloudflare plans; no paid Access plan is required merely to publish an application.
- OpenRouter `openrouter/free`: prompt and completion token price is $0.
- Groq exposes documented Free Plan rate limits; it is optional fallback only.

If any required provider removes its free tier later, the application must fail closed or switch to another explicitly free adapter. It must never silently incur charges.

## 17. Non-goals
This MVP is not a general-purpose remote administration shell, enterprise chatbot, public multi-user bot, or replacement for the existing project applications.
## 18. Tunnel lifecycle
For development and first live validation, use a free TryCloudflare Quick Tunnel. Its hostname is temporary and changes on restart, so startup tooling should capture the generated HTTPS URL and update the LINE webhook endpoint through LINE's official webhook-settings API.

Quick Tunnel is explicitly a development/testing transport with no uptime SLA. The MVP must document this limitation rather than presenting it as production hosting.

If a stable hostname is later wanted, a named Cloudflare Tunnel may be attached to an already-owned Cloudflare-managed zone only after owner approval and without enabling paid Cloudflare add-ons. This is optional and not required for MVP acceptance.
