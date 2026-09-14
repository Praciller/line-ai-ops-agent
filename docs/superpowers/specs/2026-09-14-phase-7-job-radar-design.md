# Phase 7 Job Radar Design

**Status:** Approved architecture; written spec pending owner review.

## Goal

Add an owner-only `/jobs` command that returns a short, useful shortlist of current AI/Data/MLOps roles without requiring paid APIs, browser automation, scraping authenticated job boards, or AI inference.

The radar should avoid the previous failure mode where a job task returns nothing useful. If Thailand-only results are sparse, it should expand deterministically to remote/APAC roles that explicitly allow applicants from Thailand or worldwide.

## Scope

Phase 7 v1 is on-demand only. It does not send proactive LINE messages, apply to jobs, modify job-board accounts, store applications, or use browser automation.

The command remains read-only and owner-only under the existing LINE signature verification, owner allowlist, dedupe, audit, and reply flow.

## User profile for deterministic matching

Role priority:

1. AI Engineer
2. Data Engineer
3. MLOps Engineer / AI-ML Engineer

Location priority:

1. Thailand, especially Bangkok and Nakhon Ratchasima
2. Remote roles available worldwide or explicitly available from Thailand
3. APAC-compatible remote roles when Thailand-specific inventory is sparse

Primary skill signals include Python, SQL, LLM/agent systems, data pipelines, Kafka/Flink, Docker, CI/CD, MLOps, observability, and cloud/data-platform work. These are ranking signals, not hard requirements.

Salary is displayed when a source provides it, but v1 does not reject a role solely because salary is missing.

## Source strategy

Mandatory v1 sources are public, unauthenticated job feeds:

- **Jobicy** — `https://jobicy.com/api/v2/remote-jobs`
- **Himalayas** — `https://himalayas.app/jobs/api/search`
- **Remote OK** — `https://remoteok.com/api`

No API keys are required for these sources. Each adapter uses a fixed HTTPS host, fixed endpoint, and fixed internal query profile; user input can never choose an arbitrary URL or forward an arbitrary upstream search query.

Himalayas search requests must stay within the documented public API limits. Jobicy integration uses a 60-minute warm cache, and no background or automated polling loop may run more frequently than once per hour. Remote OK and Himalayas results must retain source attribution and an original/source job link.

Structured company-career feeds may be added later through the same adapter interface only when they are public, stable, and placed on a fixed allowlist. They are not required for Phase 7 v1 acceptance.

Explicitly excluded sources in v1:

- authenticated LinkedIn scraping
- JobsDB/Indeed browser scraping
- arbitrary user-provided job URLs
- paid job APIs
- search-engine scraping as a production dependency
- browser automation on Vercel

## Internal model

All source adapters normalize into one bounded model before ranking:

```ts
type JobListing = {
  source: 'jobicy' | 'himalayas' | 'remoteok';
  sourceId: string;
  title: string;
  company: string;
  location: string;
  remoteScope: string | null;
  employmentType: string | null;
  salary: string | null;
  postedAt: string | null;
  tags: readonly string[];
  url: string;
};
```

Descriptions are not required for LINE output. HTML job descriptions from upstream sources must not be rendered directly and are excluded from the ranking context unless safely reduced to plain text in a future phase.

Each adapter returns normalized listings plus source-level metadata such as fetch outcome and fetch timestamp. Adapter errors must not leak upstream bodies or credentials into logs.

## Retrieval flow

`/jobs` performs this flow:

```text
LINE /jobs
  -> existing signature/owner/dedupe controls
  -> JobRadar service
  -> parallel fixed-source fetches
  -> normalize
  -> eligibility filter
  -> deduplicate
  -> deterministic score
  -> top 5
  -> compact LINE response
```

Source fetches run in parallel with bounded timeouts. A single source failure must not fail `/jobs`; the radar returns results from healthy sources and marks partial-source degradation only in internal observability.

If every live source fails and a fresh-enough cache exists, the service may return cached results with a clear `cached` marker. If no source and no cache is available, return a concise deterministic unavailable message rather than invoking AI.

## Eligibility and fallback policy

The radar evaluates location eligibility before ranking:

- accept Thailand-local roles
- accept worldwide remote roles
- accept roles explicitly allowing Thailand
- accept APAC/Asia remote roles when source metadata does not exclude Thailand
- reject roles explicitly restricted to incompatible countries/regions

The first pass prefers Thailand-local and Thailand-explicit results. If fewer than five viable results remain, fill remaining slots from worldwide/APAC-compatible remote results.

No role is included merely because the title matches if the source explicitly says the role cannot be performed from Thailand.

## Deduplication

Deduplicate in this order:

1. canonical normalized job URL
2. normalized `company + title + location`

When duplicates exist across sources, prefer the record with clearer location eligibility, then newer posting date, then richer salary metadata. Keep only one source link in the LINE output but preserve source attribution for the selected record.

## Deterministic ranking

No LLM is used to score or select jobs in v1. The score is deterministic and explainable.

The score is capped at 100 points. The component rules are fixed:

- role: AI Engineer / Applied AI = 40; ML Engineer = 36; Data Engineer = 34; MLOps / ML Platform / AI-ML = 32; Data Platform = 24; unrelated role = reject
- skills: 5 points per matched fixed skill group, capped at 25
- location: Thailand-local or explicitly Thailand-eligible remote = 20; worldwide = 18; APAC/Asia with no Thailand exclusion = 14; incompatible or unresolvable scope = reject
- freshness: <=3 days = 10; <=7 = 8; <=14 = 6; <=30 = 3; older = 1; unknown = 2
- salary metadata present = 5; absent = 0

A viable result must have role score at least 24 and total score at least 45. The fixed skill vocabulary lives in `src/jobs/profile.ts` and uses title/tags/structured source fields only; no embeddings, descriptions, or AI inference are required.

Ties resolve by newer posting date, then source name, then normalized company/title to guarantee stable output.

## Response contract

Return at most five jobs. Each item contains only concise fields suitable for LINE:

```text
1. <title> — <company>
   <location/remote scope> · <age if known>
   Match: <up to 3 deterministic signals>
   Source: <source>
   Apply: <canonical/source URL>
```

If no viable job exists, return an explicit message such as `No strong matches found right now` plus which source classes were checked. Do not fabricate jobs and do not fall back to generic AI suggestions.

The response must stay inside LINE text limits with a lower internal cap. Long titles, company names, locations, and tags are truncated safely before rendering.

## Cache and network behavior

Use a small in-process cache keyed by source/query profile. Cache lifetime must be at least 60 minutes for Jobicy to respect its documented polling guidance. A common 60-minute TTL across all three sources is preferred for simplicity.

Vercel cold starts may lose cache state; therefore the implementation must still bound live calls per `/jobs` invocation and must never create background polling loops.

No scheduled polling or proactive notification is part of v1. If a future recurring job alert is added, it requires a separate design and must obey provider polling limits and the existing LINE message budget.

## Security boundaries

- fixed HTTPS source hosts only
- no user-controlled fetch URL
- no browser automation
- no arbitrary query forwarding that could become SSRF
- no authenticated cookies or job-board credentials
- no AI provider receives raw job descriptions
- no application submission or write action
- source payloads are treated as untrusted input
- output rendering escapes/removes control characters and enforces length bounds
- logs contain source/outcome/count/latency only, not full payloads

The existing LINE owner allowlist and signature verification remain mandatory before `/jobs` executes.

## Integration with existing command architecture

`/jobs` becomes a new simple owner command alongside `/today`.

Expected integration points:

- `src/line/commands.ts` — parse `/jobs`, include it in help, route execution
- `src/line/processor.ts` — existing command/audit/dedupe flow remains unchanged except recognizing `jobs`
- `src/persistence/audit.ts` — classify `jobs` as an auditable command
- `src/jobs/types.ts` — normalized job model and source result types
- `src/jobs/adapters/*` — Jobicy, Himalayas, Remote OK adapters
- `src/jobs/radar.ts` — orchestration, fallback, dedupe, ranking, rendering input
- `src/jobs/profile.ts` — fixed non-secret role/skill/location preferences
- `src/app.ts` — construct/inject JobRadar dependency

The jobs subsystem exposes one narrow typed interface: `JobRadar.find(): Promise<JobRadarResult>`. Rendering is a separate pure function from `JobRadarResult` to LINE text. Existing project-intelligence adapters must not be overloaded with job-board behavior.

## Observability

Reuse best-effort command auditing for `/jobs` success/error outcome and latency.

Source-level observability may record only:

- source name
- success / timeout / upstream error
- normalized result count
- cache hit/miss
- latency

No full upstream body, job description, or user identifier is stored for Phase 7 v1.

## Testing strategy

Automated tests use local fixtures and fake fetch implementations only. CI must not make live calls to Jobicy, Himalayas, Remote OK, LINE, AI, or a database.

Required coverage:

- command parser/help recognizes `/jobs`
- owner allowlist/dedupe behavior remains unchanged
- each adapter normalizes representative source payloads
- malformed/untrusted source fields are bounded safely
- one source failure still returns healthy-source results
- all-source failure returns cached results when available
- all-source failure without cache returns deterministic unavailable text
- Thailand/local eligibility outranks generic worldwide fallback
- incompatible location restrictions are rejected
- duplicates collapse deterministically
- scoring and tie-breaking are stable
- output contains at most five jobs with source attribution and URLs
- response remains within configured LINE output bounds
- no AI provider is invoked by `/jobs`

A separate opt-in live smoke test may call the public feeds after automated gates pass, but it must not run in normal CI.

## Cost and quota guardrails

Phase 7 must preserve the existing zero-cost operating requirement:

- no paid APIs
- no new paid Vercel feature
- no AI call for `/jobs`
- no database required
- no automatic upgrade or paid fallback

If all free sources become unavailable, `/jobs` degrades cleanly instead of switching to a paid source.

## Acceptance criteria

Phase 7 v1 is complete when:

1. `/jobs` is owner-only and works through the existing signed LINE webhook flow.
2. Jobicy, Himalayas, and Remote OK adapters are implemented behind fixed HTTPS endpoints.
3. Results are normalized, eligibility-filtered, deduplicated, deterministically ranked, and capped at five.
4. Thailand-local matches are preferred and sparse inventory falls back to Thailand-eligible worldwide/APAC remote roles.
5. Incompatible location-restricted jobs are excluded.
6. Each displayed result includes source attribution and a valid original/source job URL.
7. A single upstream failure does not fail the whole command.
8. No AI inference, paid API, browser automation, or database is required for `/jobs`.
9. Automated tests use fixtures only and all project quality gates pass.
10. A manual production `/jobs` E2E returns either useful real matches or an explicit truthful no-match/degraded response without fabricated jobs.

## Explicitly deferred

- scheduled/proactive job alerts
- application tracking
- auto-apply or form submission
- resume tailoring per job
- company-career adapters without a stable structured public feed
- persistent job history/database storage
- semantic/embedding ranking
- AI-generated explanations
- `/learn` local knowledge retrieval
- HITL write actions

These require separate approval/design work after the read-only job radar is proven useful in production.
