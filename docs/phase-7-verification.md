# Phase 7 Job Radar Verification

Status: `PREPRODUCTION_VERIFIED`

## Design

- Command: `/jobs`
- Access: owner-only through the existing signed LINE webhook path
- Sources: Jobicy, Himalayas, Remote OK
- Ranking: deterministic, Thailand-first, no AI inference
- Cost: no paid API, no required database, no browser automation
- Cache: in-process 60-minute source cache; no background polling loop

## Automated verification

```text
TESTS=PASS_168_OF_168
TYPECHECK=PASS
BUILD=PASS
DRY_RUN=PASS
NPM_AUDIT=PASS_0_VULNERABILITIES
DIFF_CHECK=PASS
SECRET_SCAN=PASS_0_FINDINGS
```

Automated CI tests use fixtures and injected fetch implementations. Normal CI does not call live job feeds.

## Live source smoke

The one permitted post-fix live smoke completed successfully for all three fixed public feeds:

```text
JOBICY_LIVE=PASS
HIMALAYAS_LIVE=PASS
REMOTEOK_LIVE=PASS
LIVE_MATCH_COUNT=2
```

The first live smoke exposed that Remote OK represents missing salary metadata as `salary_min=0` and `salary_max=0`, which rendered as `Salary: 0-0`. A TDD regression test and normalization fix now treat non-positive salary bounds as missing. The post-fix smoke produced no `Salary: 0-0` output. Only sanitized source status and bounded rendered fields are retained; upstream descriptions and raw payloads are not verification artifacts.

## Production acceptance

```text
PRODUCTION_DEPLOYMENT=NOT_RUN_FINAL
PRODUCTION_HEALTH=NOT_RUN_FINAL
REAL_OWNER_JOBS_E2E=OWNER_ACTION_REQUIRED
PRODUCTION_WEBHOOK_HTTP=NOT_RUN_FINAL
DUPLICATE_REPLY=NOT_RUN_FINAL
RUNTIME_ERRORS=NOT_RUN_FINAL
```

Production deployment and the real owner `/jobs` LINE E2E remain pending. The Phase 7 pull request must remain open and unmerged until the owner explicitly approves merge after live `/jobs` E2E.
