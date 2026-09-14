# Phase 7 Job Radar Verification

Status: `IN_PROGRESS`

## Design

- Command: `/jobs`
- Access: owner-only through the existing signed LINE webhook path
- Sources: Jobicy, Himalayas, Remote OK
- Ranking: deterministic, Thailand-first, no AI inference
- Cost: no paid API, no required database, no browser automation
- Cache: in-process 60-minute source cache; no background polling loop

## Automated verification

```text
TESTS=NOT_RUN_FINAL
TYPECHECK=NOT_RUN_FINAL
BUILD=NOT_RUN_FINAL
DRY_RUN=NOT_RUN_FINAL
NPM_AUDIT=NOT_RUN_FINAL
DIFF_CHECK=NOT_RUN_FINAL
SECRET_SCAN=NOT_RUN_FINAL
```

Automated CI tests use fixtures and injected fetch implementations. Normal CI must not call live job feeds.

## Live source smoke

```text
JOBICY_LIVE=NOT_RUN
HIMALAYAS_LIVE=NOT_RUN
REMOTEOK_LIVE=NOT_RUN
LIVE_MATCH_COUNT=NOT_RUN
```

Only source/outcome/count/latency metadata and bounded rendered results may be printed. Full upstream payloads and descriptions are not verification artifacts.

## Production acceptance

```text
PRODUCTION_DEPLOYMENT=NOT_RUN
PRODUCTION_HEALTH=NOT_RUN
REAL_OWNER_JOBS_E2E=NOT_RUN
PRODUCTION_WEBHOOK_HTTP=NOT_RUN
DUPLICATE_REPLY=NOT_RUN
RUNTIME_ERRORS=NOT_RUN
```

The Phase 7 pull request must remain open and unmerged until the owner explicitly approves merge after live `/jobs` E2E.
