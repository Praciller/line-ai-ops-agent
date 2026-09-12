# Phase 2 LINE Transport Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans task-by-task. All behavioral changes follow TDD.

**Goal:** Add secure owner-only LINE webhook transport with signature verification, event dedupe, deterministic `/help` and `/status`, and quota-free tests.

**Architecture:** Keep LINE transport behind explicit interfaces. The official LINE SDK verifies and parses webhook bodies at the route boundary; normalized events then pass through owner authorization, in-memory dedupe, deterministic command routing, and an injected reply port.

**Tech Stack:** Node.js >=22, TypeScript, Express, Zod, Vitest, Supertest, `@line/bot-sdk` 11.2.0.

**Spec:** `docs/superpowers/specs/2026-09-12-personal-ai-ops-line-design.md`

## Global Constraints
- Required monthly infrastructure cost remains 0 THB.
- Tests must make zero real LINE, AI, database, or other quota-consuming calls.
- Invalid LINE signatures must be rejected before event processing.
- Only configured owner LINE user IDs may execute commands.
- No shell, SQL, filesystem path, browser action, arbitrary URL, or model selection command is exposed.
- Phase 2 remains deterministic and does not require AI or Neon.
- Secrets remain environment-only and redacted from logs.
- Duplicate `webhookEventId` values must not execute twice.

---### Task 1: LINE configuration contract

**Files:**
- Modify: `package.json`, `package-lock.json`, `.env.example`, `src/config.ts`, `src/health.ts`
- Test: `tests/config.test.ts`, `tests/health.test.ts`

**Interfaces:**
- `AppConfig.line` is either `null` or `{ channelSecret, channelAccessToken, ownerUserIds }`.
- LINE configuration is valid only when secret, access token, and at least one owner user ID are supplied together.
- `buildHealthReport()` reports LINE as `configured` only when `AppConfig.line` is non-null.

- [ ] Write failing tests for absent LINE config, complete LINE config, partial-config rejection, owner-ID parsing, and configured health state.
- [ ] Run focused tests and confirm RED for missing behavior.
- [ ] Install `@line/bot-sdk@11.2.0` and implement minimum config/health changes.
- [ ] Run focused tests, full tests, and typecheck.
- [ ] Commit `feat: add secure LINE transport configuration`.

### Task 2: Command normalization and deterministic router

**Files:**
- Create: `src/line/events.ts`, `src/line/commands.ts`
- Test: `tests/line-events.test.ts`, `tests/line-commands.test.ts`

**Interfaces:**
- `normalizeCommandEvent(event): NormalizedCommandEvent | null` accepts only active text-message events with `userId`, `replyToken`, and `webhookEventId`.
- `parseCommand(text)` recognizes `/help` and `/status`; non-command text returns null and unknown slash commands resolve to help text.
- `renderStatus(config)` returns deterministic component status with no external calls.

- [ ] Write failing normalization/router tests, including standby and non-text rejection.
- [ ] Confirm RED.
- [ ] Implement the smallest typed event and command modules.
- [ ] Run focused and full tests.
- [ ] Commit `feat: add LINE command normalization and routing`.### Task 3: In-memory event dedupe

**Files:**
- Create: `src/line/dedupe.ts`
- Test: `tests/line-dedupe.test.ts`

**Interfaces:**
- `EventDeduper.claim(eventId): boolean` returns false for an already-claimed event.
- `EventDeduper.release(eventId): void` permits retry after a processing failure.
- `InMemoryEventDeduper` is bounded to avoid unbounded memory growth and will be replaced by Neon-backed persistence in Phase 4.

- [ ] Write failing tests for first claim, duplicate claim, release/retry, and bounded eviction.
- [ ] Confirm RED.
- [ ] Implement the minimal bounded deduper.
- [ ] Run focused and full tests.
- [ ] Commit `feat: add webhook event dedupe`.

### Task 4: Reply port and webhook processor

**Files:**
- Create: `src/line/reply.ts`, `src/line/processor.ts`
- Test: `tests/line-processor.test.ts`

**Interfaces:**
- `LineReplyPort.reply(replyToken, text): Promise<void>` abstracts quota-consuming transport.
- `createLineSdkReplyClient(token)` is the production adapter.
- `processWebhookEvents(events, deps)` authorizes owner IDs, dedupes, routes commands, replies only to recognized command events, and releases the dedupe claim if reply delivery fails.

- [ ] Write failing tests with an in-memory fake reply port for authorized, unauthorized, duplicate, ignored, and reply-failure/retry behavior.
- [ ] Confirm RED without making network calls.
- [ ] Implement the reply adapter and processor.
- [ ] Run focused and full tests plus typecheck.
- [ ] Commit `feat: add owner-only LINE webhook processor`.### Task 5: Express webhook boundary

**Files:**
- Modify: `src/app.ts`
- Test: `tests/line-webhook.test.ts`

**Interfaces:**
- `POST /webhook` uses the official LINE SDK middleware before any event processing.
- Missing/invalid signature returns 401 and performs no command or reply work.
- Invalid JSON returns 400.
- Valid empty verification webhook returns 200.
- If LINE configuration is absent, `/webhook` returns 503 without exposing configuration details.

- [ ] Write failing signed/unsigned Supertest cases using locally generated HMAC signatures and an injected fake reply port.
- [ ] Confirm RED.
- [ ] Add the route-specific LINE middleware, processor wiring, and sanitized error mapping.
- [ ] Run webhook tests and full suite.
- [ ] Commit `feat: add verified LINE webhook endpoint`.

### Task 6: Phase 2 verification and docs

**Files:**
- Modify: `README.md`, `.env.example`
- Create: `docs/phase-2-verification.md`

**Interfaces:**
- Document owner-only setup, safe placeholders, current commands, local testing, and the explicit absence of Neon/AI/live tunnel work.

- [ ] Document `/help`, `/status`, LINE env vars, signature verification, owner allowlist, and dedupe behavior without including real credentials.
- [ ] Run fresh `npm ci`, `npm test`, `npm run typecheck`, `npm run build`, `npm run dry-run`, and `git diff --check`.
- [ ] Verify tests consume no real LINE quota and no `.env` or secrets are tracked.
- [ ] Commit `docs: document phase 2 LINE transport`.
- [ ] Compare Phase 2 against approved spec Sections 6, 7, 8, 11, 12, 13, and Phase 2 scope before opening a PR.