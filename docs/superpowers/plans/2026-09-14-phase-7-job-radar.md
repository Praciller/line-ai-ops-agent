# Phase 7 Job Radar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a zero-cost, owner-only `/jobs` command that retrieves current AI/Data/MLOps roles from fixed public feeds, filters for Thailand eligibility, ranks deterministically, and returns at most five attributed results in LINE.

**Architecture:** Introduce a standalone `src/jobs/` subsystem with fixed-host source adapters, normalization, deterministic eligibility/scoring/deduplication, a 60-minute in-process cache, and a pure LINE renderer. Inject a `JobRadar` dependency into the existing webhook processor so signature verification, owner allowlisting, dedupe, auditing, and reply behavior stay unchanged.

**Tech Stack:** Node.js 22 built-in `fetch`, TypeScript, Zod 4, Vitest 5, existing Express/LINE SDK runtime.

**Spec:** `docs/superpowers/specs/2026-09-14-phase-7-job-radar-design.md`

## Global Constraints

- `/jobs` is on-demand, read-only, owner-only, and must not send proactive messages.
- Fixed public sources only: Jobicy, Himalayas, Remote OK; no authenticated scraping or arbitrary URLs.
- No paid API, AI inference, browser automation, database requirement, or automatic paid fallback.
- Thailand-local / Thailand-explicit roles rank before worldwide/APAC fallback; incompatible locations are rejected.
- Maximum 5 displayed jobs; every result keeps source attribution and original/source URL.
- CI uses fixtures/fake fetch only; no live job APIs, LINE, AI, or database calls.
- Never log full upstream payloads or job descriptions.
- Jobicy warm-cache TTL: 60 minutes; no background polling loops.
- Himalayas request limit must not exceed 20 jobs per call; preserve Himalayas attribution.
- Remote OK results must credit Remote OK and retain the original Remote OK job URL.

---

## File map

**Create**
- `src/jobs/types.ts` — normalized listing/result/source contracts.
- `src/jobs/profile.ts` — fixed role, skill, and location profile.
- `src/jobs/ranking.ts` — eligibility, scoring, dedupe, stable sorting.
- `src/jobs/render.ts` — pure bounded LINE text rendering.
- `src/jobs/adapters/types.ts` — adapter and fetch contracts.
- `src/jobs/adapters/http.ts` — bounded fixed-host fetch helper.
- `src/jobs/adapters/jobicy.ts` — Jobicy normalization.
- `src/jobs/adapters/himalayas.ts` — Himalayas normalization.
- `src/jobs/adapters/remoteok.ts` — Remote OK normalization.
- `src/jobs/radar.ts` — parallel orchestration, cache, partial-failure policy.
- `src/jobs/factory.ts` — production adapter/radar construction.
- `scripts/jobs-live-smoke.ts` — opt-in live source smoke, never CI.
- `tests/jobs-ranking.test.ts`
- `tests/jobs-jobicy.test.ts`
- `tests/jobs-himalayas.test.ts`
- `tests/jobs-remoteok.test.ts`
- `tests/jobs-radar.test.ts`
- `tests/jobs-render.test.ts`
- `tests/jobs-live-smoke.test.ts`

**Modify**
- `src/line/commands.ts`, `src/line/processor.ts`, `src/persistence/audit.ts`, `src/app.ts`
- `tests/line-commands.test.ts`, `tests/line-processor.test.ts`, `tests/command-audit.test.ts`
- `package.json`, `README.md`, `docs/phase-7-verification.md`

---

### Task 1: Core job contracts and deterministic ranking

**Files:**
- Create: `src/jobs/types.ts`, `src/jobs/profile.ts`, `src/jobs/ranking.ts`
- Test: `tests/jobs-ranking.test.ts`

**Interfaces:**
- Produces `JobListing`, `RankedJob`, `JobSource`, `JobSourceBatch`, `JobSourceStatus`, `JobRadarResult`.
- Produces `classifyEligibility(job): Eligibility | null`, `scoreJob(job, nowMs)`, `dedupeAndRank(jobs, nowMs)`.

- [ ] **Step 1: Write failing ranking tests**

```ts
it('prefers Thailand-local AI roles and rejects incompatible scope', () => {
  const ranked = dedupeAndRank([
    job({ title: 'AI Engineer', location: 'Bangkok, Thailand' }),
    job({ title: 'AI Engineer', location: 'United States only', remoteScope: 'US only' }),
    job({ title: 'Data Engineer', location: 'Worldwide', remoteScope: 'Worldwide' }),
  ], NOW);
  expect(ranked.map((x) => x.listing.location)).toEqual(['Bangkok, Thailand', 'Worldwide']);
  expect(ranked[0]?.score).toBeGreaterThan(ranked[1]?.score ?? 0);
});
```

- [ ] **Step 2: Run `npx vitest run tests/jobs-ranking.test.ts`**
Expected: FAIL because `src/jobs/ranking.ts` does not exist.

- [ ] **Step 3: Implement exact core contracts and profile constants**

```ts
export type JobSource = 'jobicy' | 'himalayas' | 'remoteok';
export type Eligibility = 'thailand' | 'worldwide' | 'apac';
export type JobListing = {
  source: JobSource; sourceId: string; title: string; company: string;
  location: string; remoteScope: string | null; employmentType: string | null;
  salary: string | null; postedAt: string | null; tags: readonly string[]; url: string;
};
export type RankedJob = {
  listing: JobListing; eligibility: Eligibility; score: number; signals: readonly string[];
};
export type JobSourceBatch = { source: JobSource; jobs: readonly JobListing[]; fetchedAt: string };
export type JobSourceStatus = {
  source: JobSource; outcome: 'success' | 'timeout' | 'error' | 'cache'; count: number; latencyMs: number;
};
export type JobRadarResult = { jobs: readonly RankedJob[]; sources: readonly JobSourceStatus[]; generatedAt: string };
```

Implement the fixed score table directly, then reject `role < 24` or total `< 45`:

```ts
const ROLE_RULES = [
  [/\b(ai engineer|applied ai)\b/i, 40],
  [/\b(machine learning|ml) engineer\b/i, 36],
  [/\bdata engineer\b/i, 34],
  [/\b(mlops|ml platform|ai[- ]?ml)\b/i, 32],
  [/\bdata platform\b/i, 24],
] as const;
const freshness = (days: number | null) => days === null ? 2
  : days <= 3 ? 10 : days <= 7 ? 8 : days <= 14 ? 6 : days <= 30 ? 3 : 1;
```

Add 5 points per matched fixed skill group capped at 25, use the spec's location scores, dedupe by normalized URL then normalized `company + title + location`, and apply the stable tie-break order from the spec.

- [ ] **Step 4: Add edge-case tests** for duplicate URLs, duplicate normalized identity, unknown date, APAC fallback, worldwide, salary, stable tie resolution, and malformed control characters.
- [ ] **Step 5: Run `npx vitest run tests/jobs-ranking.test.ts`**
Expected: PASS.
- [ ] **Step 6: Commit**

```bash
git add src/jobs/types.ts src/jobs/profile.ts src/jobs/ranking.ts tests/jobs-ranking.test.ts
git commit -m "feat: add deterministic job ranking core"
```

---

### Task 2: Safe fixed-host HTTP layer and Jobicy adapter

**Files:**
- Create: `src/jobs/adapters/types.ts`, `src/jobs/adapters/http.ts`, `src/jobs/adapters/jobicy.ts`
- Test: `tests/jobs-jobicy.test.ts`

**Interfaces:**
- `JobSourceAdapter = { source: JobSource; fetch(signal?: AbortSignal): Promise<JobSourceBatch> }`
- `FetchLike = typeof fetch`
- `fetchJson(url: URL, allowedHost: string, fetchFn: FetchLike, signal?: AbortSignal): Promise<unknown>`

- [ ] **Step 1: Write failing adapter tests** using a fake fetch and a representative Jobicy payload.

```ts
const payload = { jobs: [{
  id: 123, url: 'https://jobicy.com/jobs/ai-engineer', jobTitle: 'AI Engineer',
  companyName: 'Example', jobIndustry: ['Data Science'], jobType: ['full-time'],
  jobGeo: 'Anywhere', pubDate: '2026-09-14T00:00:00Z',
  salaryMin: 80000, salaryMax: 120000, salaryCurrency: 'USD', salaryPeriod: 'yearly',
}] };
expect((await createJobicyAdapter(fakeFetch(payload)).fetch()).jobs[0]).toMatchObject({
  source: 'jobicy', title: 'AI Engineer', company: 'Example', remoteScope: 'Anywhere',
});
```

- [ ] **Step 2: Run `npx vitest run tests/jobs-jobicy.test.ts`**
Expected: FAIL because adapter modules do not exist.
- [ ] **Step 3: Implement host-locked JSON fetch**

```ts
export async function fetchJson(
  url: URL, allowedHost: string, fetchFn: FetchLike, signal?: AbortSignal,
): Promise<unknown> {
  if (url.protocol !== 'https:' || url.hostname !== allowedHost) throw new Error('JobSourceHostError');
  const response = await fetchFn(url, { method: 'GET', signal, headers: { accept: 'application/json' } });
  if (!response.ok) throw new Error(response.status === 429 ? 'JobSourceRateLimitError' : 'JobSourceHttpError');
  return response.json();
}
```

Use Zod to parse only the fields required by the normalized model. Ignore `jobDescription` entirely. Build the Jobicy request internally as `https://jobicy.com/api/v2/remote-jobs?count=100`; do not accept query text or URLs from LINE input.

- [ ] **Step 4: Add safety tests** proving non-Jobicy hosts are rejected, HTML descriptions are not retained, malformed records are skipped, and HTTP bodies are not included in thrown errors.
- [ ] **Step 5: Run `npx vitest run tests/jobs-jobicy.test.ts`**
Expected: PASS.
- [ ] **Step 6: Commit**

```bash
git add src/jobs/adapters/types.ts src/jobs/adapters/http.ts src/jobs/adapters/jobicy.ts tests/jobs-jobicy.test.ts
git commit -m "feat: add safe Jobicy job source"
```

---

### Task 3: Himalayas and Remote OK adapters

**Files:**
- Create: `src/jobs/adapters/himalayas.ts`, `src/jobs/adapters/remoteok.ts`
- Test: `tests/jobs-himalayas.test.ts`, `tests/jobs-remoteok.test.ts`

**Interfaces:** Both implement `JobSourceAdapter` and reuse `fetchJson`.

- [ ] **Step 1: Write failing Himalayas test** using the current public shape: `jobs[]` with `title`, `companyName`, `employmentType`, `locationRestrictions`, `minSalary`, `maxSalary`, `currency`, `salaryPeriod`, `categories`, `pubDate`, `applicationLink`, `guid`.
- [ ] **Step 2: Implement Himalayas adapter** with fixed request `https://himalayas.app/jobs/api/search?q=engineer&sort=recent&page=1`; parse at most 20 records and normalize only approved fields:

```ts
const HimalayasJob = z.object({
  title: z.string(), companyName: z.string(), employmentType: z.string().nullable().optional(),
  locationRestrictions: z.array(z.object({ name: z.string() })).default([]),
  minSalary: z.number().nullable().optional(), maxSalary: z.number().nullable().optional(),
  currency: z.string().nullable().optional(), salaryPeriod: z.string().nullable().optional(),
  categories: z.array(z.string()).default([]), pubDate: z.union([z.string(), z.number()]).nullable().optional(),
  applicationLink: z.string().url(), guid: z.union([z.string(), z.number()]),
});
```

Map empty `locationRestrictions` to `Worldwide`; otherwise join country names into both `location` and `remoteScope`. Keep `applicationLink` as the displayed source URL.
- [ ] **Step 3: Write failing Remote OK test** where the first metadata object is ignored and job records use `id`, `position`, `company`, `location`, `tags`, `date`/`epoch`, `salary_min`, `salary_max`, and `url`.
- [ ] **Step 4: Implement Remote OK adapter** with fixed endpoint `https://remoteok.com/api`; ignore the first metadata object, validate job rows, retain only `remoteok.com` job URLs, and never keep descriptions.

```ts
const RemoteOkJob = z.object({
  id: z.union([z.string(), z.number()]), position: z.string(), company: z.string(),
  location: z.string().default('Worldwide'), tags: z.array(z.string()).default([]),
  date: z.string().nullable().optional(), epoch: z.number().nullable().optional(),
  salary_min: z.number().nullable().optional(), salary_max: z.number().nullable().optional(),
  url: z.string().url(),
});
const jobs = Array.isArray(raw) ? raw.slice(1) : [];
return jobs.flatMap((item) => normalizeRemoteOk(RemoteOkJob.safeParse(item)));
```

- [ ] **Step 5: Add attribution/safety assertions**: source names are exact, canonical links are preserved, incompatible/malformed URL records are skipped, descriptions never enter `JobListing`.
- [ ] **Step 6: Run adapter tests**

```bash
npx vitest run tests/jobs-himalayas.test.ts tests/jobs-remoteok.test.ts
```
Expected: PASS.
- [ ] **Step 7: Commit**

```bash
git add src/jobs/adapters/himalayas.ts src/jobs/adapters/remoteok.ts tests/jobs-himalayas.test.ts tests/jobs-remoteok.test.ts
git commit -m "feat: add Himalayas and Remote OK sources"
```

---

### Task 4: JobRadar orchestration, cache, and partial failure

**Files:**
- Create: `src/jobs/radar.ts`
- Test: `tests/jobs-radar.test.ts`

**Interfaces:**
- Consumes `JobSourceAdapter[]` and `dedupeAndRank`.
- Produces `JobRadar = { find(): Promise<JobRadarResult> }` with a 5-second default source timeout.

- [ ] **Step 1: Write failing orchestration tests** for three parallel sources, one-source failure, all-source failure, and warm-cache behavior.

```ts
const radar = createJobRadar([ok('jobicy', [A]), fail('himalayas'), ok('remoteok', [B])], {
  now: () => NOW_MS, ttlMs: 60 * 60 * 1000,
});
const result = await radar.find();
expect(result.sources.find((x) => x.source === 'himalayas')?.outcome).toBe('error');
expect(result.jobs.length).toBeGreaterThan(0);
```

- [ ] **Step 2: Run `npx vitest run tests/jobs-radar.test.ts`**
Expected: FAIL because `createJobRadar` does not exist.
- [ ] **Step 3: Implement per-source cache and parallel retrieval**

```ts
export interface JobRadar { find(): Promise<JobRadarResult>; }
export function createJobRadar(
  adapters: readonly JobSourceAdapter[],
  options: { now?: () => number; ttlMs?: number; timeoutMs?: number } = {},
): JobRadar {
  const now = options.now ?? Date.now;
  const ttlMs = options.ttlMs ?? 60 * 60 * 1000;
  const timeoutMs = options.timeoutMs ?? 5000;
  const cache = new Map<JobSource, { expiresAt: number; batch: JobSourceBatch }>();
  return {
    async find() {
      const sourceRuns = await Promise.all(adapters.map(async (adapter) => {
        const startedAt = now();
        const cached = cache.get(adapter.source);
        if (cached && cached.expiresAt > startedAt) {
          return { batch: cached.batch, status: { source: adapter.source, outcome: 'cache' as const, count: cached.batch.jobs.length, latencyMs: 0 } };
        }
        try {
          const batch = await adapter.fetch(AbortSignal.timeout(timeoutMs));
          cache.set(adapter.source, { expiresAt: startedAt + ttlMs, batch });
          return { batch, status: { source: adapter.source, outcome: 'success' as const, count: batch.jobs.length, latencyMs: Math.max(0, now() - startedAt) } };
        } catch (error) {
          const outcome = error instanceof DOMException && error.name === 'TimeoutError' ? 'timeout' as const : 'error' as const;
          return { batch: { source: adapter.source, jobs: [], fetchedAt: new Date(startedAt).toISOString() }, status: { source: adapter.source, outcome, count: 0, latencyMs: Math.max(0, now() - startedAt) } };
        }
      }));
      const generatedAtMs = now();
      return {
        jobs: dedupeAndRank(sourceRuns.flatMap((run) => run.batch.jobs), generatedAtMs).slice(0, 5),
        sources: sourceRuns.map((run) => run.status),
        generatedAt: new Date(generatedAtMs).toISOString(),
      };
    },
  };
}
```

Use 60-minute default TTL. Fresh cached data skips network fetch for that source. `JobSourceStatus` records only source/outcome/count/latency; never include upstream response bodies/messages in results or logs.

- [ ] **Step 4: Add tests** proving cached sources are not fetched twice inside TTL, expired cache refetches, result order is deterministic, and all-source failure returns an empty result rather than throwing.
- [ ] **Step 5: Run `npx vitest run tests/jobs-radar.test.ts`**
Expected: PASS.
- [ ] **Step 6: Commit**

```bash
git add src/jobs/radar.ts tests/jobs-radar.test.ts
git commit -m "feat: orchestrate resilient job radar"
```

---

### Task 5: Bounded LINE rendering

**Files:**
- Create: `src/jobs/render.ts`
- Test: `tests/jobs-render.test.ts`

**Interfaces:**
- `renderJobRadar(result: JobRadarResult, now?: number): string`
- Output cap: 4,500 characters, maximum five jobs.

- [ ] **Step 1: Write failing renderer tests** for 5-result cap, attribution, age, match signals, long field truncation, control-character stripping, no-match text, and degraded-source text.

```ts
const text = renderJobRadar({
  jobs: [J1, J2, J3, J4, J5, J6],
  sources: [{ source: 'remoteok', outcome: 'error', count: 0, latencyMs: 10 }],
  generatedAt: NOW,
});
expect(text.match(/^\d+\./gm)).toHaveLength(5);
expect(text).toContain('Source: Himalayas');
expect(text.length).toBeLessThanOrEqual(4500);
```

- [ ] **Step 2: Run `npx vitest run tests/jobs-render.test.ts`**
Expected: FAIL because renderer does not exist.
- [ ] **Step 3: Implement pure renderer** with safe text normalization and deterministic output; never render descriptions.

```ts
const clean = (value: string, max: number) => value.replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
export function renderJobRadar(result: JobRadarResult, nowMs = Date.now()): string {
  if (result.jobs.length === 0) return `No strong matches found right now\nChecked: ${result.sources.map((x) => x.source).join(', ')}`;
  const body = result.jobs.slice(0, 5).map((job, index) => [
    `${index + 1}. ${clean(job.listing.title, 90)} — ${clean(job.listing.company, 70)}`,
    `   ${clean(job.listing.location || job.listing.remoteScope || 'Remote', 80)}`,
    `   Match: ${job.signals.slice(0, 3).map((x) => clean(x, 32)).join(', ')}`,
    `   Source: ${job.listing.source}`,
    `   Apply: ${job.listing.url}`,
  ].join('\n')).join('\n\n');
  return body.slice(0, 4500);
}
```
- [ ] **Step 4: Run renderer tests**
Expected: PASS.
- [ ] **Step 5: Commit**

```bash
git add src/jobs/render.ts tests/jobs-render.test.ts
git commit -m "feat: render bounded job radar replies"
```

---

### Task 6: LINE command, audit, and processor integration

**Files:**
- Modify: `src/line/commands.ts`, `src/line/processor.ts`, `src/persistence/audit.ts`
- Modify tests: `tests/line-commands.test.ts`, `tests/line-processor.test.ts`, `tests/command-audit.test.ts`

**Interfaces:**
- `SimpleCommandName` gains `'jobs'`.
- `ProcessorDeps` gains optional `jobs?: JobRadar`.
- `/jobs` executes `jobs.find()` then `renderJobRadar(result)`; it never invokes `AiAskService`.

- [ ] **Step 1: Add failing parser/help/audit tests**

```ts
expect(parseCommand('/JOBS')).toEqual({ name: 'jobs' });
expect(renderHelp()).toContain('/jobs');
expect(classifyAuditCommand('/jobs')).toBe('jobs');
```

- [ ] **Step 2: Add failing processor test** proving owner `/jobs` calls injected radar once, duplicate event calls it once, non-owner calls it zero times, and injected AI ask service remains untouched.
- [ ] **Step 3: Run targeted tests**

```bash
npx vitest run tests/line-commands.test.ts tests/line-processor.test.ts tests/command-audit.test.ts
```
Expected: FAIL until command/audit/processor types are updated.
- [ ] **Step 4: Implement the minimal integration** while preserving existing status/ask/project branches.

```ts
// audit.ts
export type AuditCommandName = 'help' | 'status' | 'github' | 'opendq' | 'dreamlogs' | 'today' | 'jobs' | 'ask' | 'unknown';

// processor.ts inside the existing command dispatch
} else if (command === 'jobs') {
  response = deps.jobs ? renderJobRadar(await deps.jobs.find()) : 'Job radar unavailable';
} else if (command === 'ask') {
  // preserve the existing /ask branch unchanged
}
```

Add `'jobs'` to `SimpleCommandName`, the supported command set, help text, and `knownCommands`. Do not route `/jobs` through `ProjectIntelligence` or `AiAskService`.
- [ ] **Step 5: Rerun targeted tests**
Expected: PASS.
- [ ] **Step 6: Commit**

```bash
git add src/line/commands.ts src/line/processor.ts src/persistence/audit.ts tests/line-commands.test.ts tests/line-processor.test.ts tests/command-audit.test.ts
git commit -m "feat: expose owner jobs command"
```

---

### Task 7: Production factory and app wiring

**Files:**
- Create: `src/jobs/factory.ts`
- Modify: `src/app.ts`
- Add/modify tests: `tests/jobs-radar.test.ts`, `tests/line-webhook.test.ts`

**Interfaces:**
- `createJobRadarFromDefaults(fetchFn: FetchLike = fetch): JobRadar`
- `AppOptions` gains `jobs?: JobRadar` for test injection.

- [ ] **Step 1: Write failing app-level test** that injects a fake `JobRadar`, sends a valid signed `/jobs` webhook, and expects one LINE reply with radar text.
- [ ] **Step 2: Write failing factory test** proving the default factory constructs exactly Jobicy/Himalayas/Remote OK adapters and requires no env secret.
- [ ] **Step 3: Run targeted tests**

```bash
npx vitest run tests/jobs-radar.test.ts tests/line-webhook.test.ts
```
Expected: FAIL before factory/app wiring exists.
- [ ] **Step 4: Implement production construction**

```ts
export function createJobRadarFromDefaults(fetchFn: FetchLike = fetch): JobRadar {
  return createJobRadar([
    createJobicyAdapter(fetchFn),
    createHimalayasAdapter(fetchFn),
    createRemoteOkAdapter(fetchFn),
  ]);
}
```

In `createApp`, construct `const jobs = options.jobs ?? createJobRadarFromDefaults();` only after LINE config is present, then pass `jobs` into `processWebhookEvents`.
- [ ] **Step 5: Rerun targeted tests**
Expected: PASS.
- [ ] **Step 6: Commit**

```bash
git add src/jobs/factory.ts src/app.ts tests/jobs-radar.test.ts tests/line-webhook.test.ts
git commit -m "feat: wire job radar into production app"
```

---

### Task 8: Opt-in live smoke and documentation

**Files:**
- Create: `scripts/jobs-live-smoke.ts`, `docs/phase-7-verification.md`
- Modify: `package.json`, `README.md`

**Interfaces:**
- Add script `jobs:smoke = tsx scripts/jobs-live-smoke.ts`.
- Smoke prints only sanitized `JobSourceStatus` summaries plus the bounded rendered result; never full payloads/descriptions.

- [ ] **Step 1: Add a testable smoke entry function**

```ts
export async function runJobsLiveSmoke(radar: JobRadar = createJobRadarFromDefaults()): Promise<number> {
  const result = await radar.find();
  console.log(JSON.stringify(result.sources));
  console.log(renderJobRadar(result));
  return result.sources.some((source) => source.outcome === 'success' || source.outcome === 'cache') ? 0 : 1;
}
```

Import `pathToFileURL` from `node:url` and guard execution with `if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href)` so importing it in tests does not make network calls. Add `tests/jobs-live-smoke.test.ts` with an injected fake `JobRadar` to prove the import path never hits live sources.

- [ ] **Step 2: Update README** to add `/jobs`, source attribution, zero-cost/no-AI behavior, cache policy, and Phase 7 status without adding personal secrets or local paths.
- [ ] **Step 3: Create verification doc skeleton** with factual fields only: sources, tests, live smoke, deployment, LINE E2E, secret scan.
- [ ] **Step 4: Run `npm run typecheck && git diff --check`**
Expected: PASS.
- [ ] **Step 5: Commit**

```bash
git add scripts/jobs-live-smoke.ts package.json README.md docs/phase-7-verification.md
git commit -m "docs: add phase 7 job radar verification flow"
```

---

### Task 9: Full verification, PR, production smoke, and owner LINE E2E

**Files:**
- Finalize: `docs/phase-7-verification.md`
- No new runtime files unless verification exposes a defect.

- [ ] **Step 1: Run fresh full quality gates**

```bash
npm ci
npm test
npm run typecheck
npm run build
npm run dry-run
npm audit
git diff --check
```
Expected: all tests PASS, typecheck/build/dry-run PASS, audit reports 0 vulnerabilities, diff check PASS.

- [ ] **Step 2: Run public-repo safety scan** against tracked files only. Require zero actual LINE/OpenRouter/Vercel secret values, zero `.env.local`, zero arbitrary fetch targets, zero authenticated job-board credentials, and no job descriptions persisted/logged.

- [ ] **Step 3: Run opt-in live source smoke once**

```bash
npm run jobs:smoke
```
Expected: at least one public source succeeds; failures are reported only by source name/outcome and do not expose payloads. Do not loop/retry aggressively.

- [ ] **Step 4: Finalize verification doc** with exact factual results from the commands above.
- [ ] **Step 5: Push implementation branch and open PR** to `main`; require CI success and zero unresolved review threads before production mutation.
- [ ] **Step 6: Deploy the verified branch to Vercel Hobby production** using the existing `line-ai-ops-agent` project; require deployment `READY` and `GET /health` HTTP 200 with LINE/AI still configured.
- [ ] **Step 7: Ask the owner for exactly one manual action:** send `/jobs` once to `AI Ops Agent`.
- [ ] **Step 8: Verify production evidence**: one `POST /webhook` HTTP 200 for the owner message, no runtime error cluster, and owner receives either useful real matches or the truthful deterministic no-match/degraded response. Confirm no duplicate canned reply.
- [ ] **Step 9: Update `docs/phase-7-verification.md`** with live E2E evidence; do not record job-board payloads, LINE user IDs, or credentials.
- [ ] **Step 10: Re-run `git diff --check` and targeted tests if the verification doc changed. Commit docs only.**
- [ ] **Step 11: Stop for explicit owner merge approval.** Do not merge the Phase 7 PR automatically.
- [ ] **Step 12: After approval, merge with expected head SHA, verify `main` CI success, sync local `main`, and confirm canonical production `/health` remains HTTP 200.**

## Final acceptance report

Return these evidence fields without secrets:

```text
CLASSIFICATION=
PHASE_7=
JOB_SOURCES=jobicy,himalayas,remoteok
JOBICY_LIVE=
HIMALAYAS_LIVE=
REMOTEOK_LIVE=
JOBS_COMMAND=
OWNER_ONLY=
AI_USED_BY_JOBS=NO
DATABASE_REQUIRED=NO
TESTS=
TYPECHECK=
BUILD=
DRY_RUN=
NPM_AUDIT=
SECRET_SCAN=
PRODUCTION_DEPLOYMENT=
PRODUCTION_HEALTH=
REAL_OWNER_JOBS_E2E=
PR_NUMBER=
PR_STATE=
PR_CI_STATUS=
PR_MERGED=
NEXT_ACTION=
```
