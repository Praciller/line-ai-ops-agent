# Phase 6 Vercel Live LINE Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans or subagent-driven-development task-by-task.

**Goal:** Deploy the existing LINE AI Ops Agent on Vercel Hobby so it remains reachable when the workstation is off, then connect and verify the real LINE webhook.

**Architecture:** Keep `createApp()` as the single Express application factory. Add a Vercel entrypoint that default-exports the app without `listen()`, deploy it to the existing Hobby team, configure secrets only in Vercel, and point LINE Messaging API to the production `/webhook` URL.

**Tech Stack:** Node.js 22+, TypeScript, Express 5, LINE SDK, Vercel Hobby/Functions, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-13-phase-6-vercel-live-line-design.md`

## Global Constraints

- Required monthly infrastructure cost: 0 THB.
- Vercel Hobby only; no automatic paid upgrade.
- No Cloudflare, Tailscale, ngrok, or local tunnel in production.
- No secret committed or printed.
- Existing owner authorization, signature verification, dedupe, free-AI model locks, and deterministic fallbacks must remain intact.
- Do not reuse unrelated databases.
### Task 1: Vercel Express entrypoint

**Files:** create `index.ts`; create `tests/vercel-entrypoint.test.ts`; modify build config only if verification proves it is necessary.

- [ ] Write failing tests that import the Vercel entrypoint with safe test env, assert it is an Express request handler, and verify `/health` works without opening a listening socket.
- [ ] Confirm RED because the entrypoint does not exist.
- [ ] Implement a minimal default export: load `process.env`, call `createApp`, export the app; never call `listen()`.
- [ ] Run focused/full tests, typecheck, build, diff-check.
- [ ] Commit `feat: add Vercel Express entrypoint`.

### Task 2: Production deployment contract

**Files:** create/modify `vercel.json` only if Vercel build evidence requires it; update package scripts/docs as needed; create `tests/vercel-config.test.ts` for any committed routing/config contract.

- [ ] Verify Vercel Express detection/build against the current repository using the official CLI/tooling.
- [ ] Keep public routes exactly `/health` and `/webhook`.
- [ ] Reject any proposed deployment configuration that introduces Cloudflare/Tailscale/local-tunnel dependencies.
- [ ] Run tests/typecheck/build and commit only evidence-backed configuration.
### Task 3: Safe LINE webhook administration

**Files:** create `src/live/line-webhook.ts`, `tests/live-line-webhook.test.ts`.

- [ ] Reuse the isolated tested LINE admin client from the abandoned Tailscale branch without importing any Tailscale code.
- [ ] Verify fixed `api.line.me` set/get/test endpoints, HTTPS `/webhook` validation, and sanitized errors.
- [ ] Run focused/full tests, typecheck, build, diff-check.
- [ ] Commit `feat: add safe LINE webhook administration`.

### Task 4: Vercel project and secret configuration

**External state:** existing Vercel Hobby team `pracillatlove-3370s-projects`.

- [ ] Create/link a dedicated `line-ai-ops-agent` Vercel project from this GitHub repository.
- [ ] Configure production environment variables without echoing values. LINE variables are required for live webhook; OpenRouter may be configured for `/ask`; Groq remains optional.
- [ ] Do not set `DATABASE_URL` unless a dedicated zero-cost database exists.
- [ ] Deploy production and verify HTTPS `/health` while local server is stopped.
- [ ] Record only project/deployment IDs, public host, status, and non-secret health evidence.
### Task 5: Real LINE webhook validation

- [ ] Capture the current LINE webhook endpoint metadata before mutation when credentials are available.
- [ ] Set webhook endpoint to `https://<vercel-production-host>/webhook`.
- [ ] GET it back and verify exact match.
- [ ] Run the official LINE webhook endpoint test and require success.
- [ ] Send one real owner `/help` or `/status` command and verify one valid reply.
- [ ] Confirm the production endpoint remains reachable with the local dev server stopped.

### Task 6: Documentation and PR gate

**Files:** update `README.md`; create `docs/phase-6-verification.md`.

- [ ] Document Vercel Hobby as production runtime and remove local-tunnel language from current roadmap/status.
- [ ] Run fresh `npm ci`, tests, typecheck, build, dry-run, audit, diff-check, secret/history/local-path scans.
- [ ] Verify no Cloudflare/Tailscale runtime references exist in the Phase 6 production files.
- [ ] Commit docs, push `feat/live-line-vercel`, open PR #6 to `main`, verify CI, leave unmerged for owner review.

## Acceptance

- Production webhook is hosted on Vercel Hobby and works while the workstation is off.
- LINE signature verification and owner allowlist remain enforced.
- No Cloudflare/Tailscale/ngrok dependency exists in production.
- No paid service or paid AI model is required.
- Secrets remain environment-only.
- Missing dedicated DB is reported as a persistence limitation rather than hidden.