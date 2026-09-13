# Phase 5 Free AI Enhancement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add optional free-only AI reasoning for `/ask` while preserving deterministic usefulness when every AI provider is missing, rate-limited, timed out, or unavailable.

**Architecture:** Keep AI behind a narrow `AiRouter` port. OpenRouter `openrouter/free` is the default primary provider and Groq Free is optional fallback using `openai/gpt-oss-20b`; providers receive only a bounded owner question plus deterministic sanitized project digest. Provider failures are isolated and recorded as metadata-only observability, while `/ask` falls back to deterministic project context.

**Tech Stack:** Node.js 22+, TypeScript, built-in `fetch`, Zod config, Vitest, existing ObservabilityStore.

**Spec:** `docs/superpowers/specs/2026-09-12-personal-ai-ops-line-design.md`

## Global Constraints

- Required monthly infrastructure cost remains 0 THB.
- Never route to a paid model or silently upgrade a provider plan.
- OpenRouter model is locked to `openrouter/free`.
- Groq fallback model is locked to `openai/gpt-oss-20b`, verified on 2026-09-13 against Groq Free Plan docs.
- AI provider URLs are fixed in code; LINE text cannot supply provider, model, URL, shell, SQL, filesystem, or browser targets.
- Provider secrets stay environment-only and are never logged, persisted, or committed.
- AI sees only a normalized bounded question plus deterministic sanitized project digest.
- `/today` stays deterministic and does not consume AI quota.
- Tests make zero real provider calls.

---

### Task 1: Free-only AI configuration contract

**Files:** Modify `src/config.ts`, `.env.example`; create `tests/ai-config.test.ts`.

**Interfaces:** `AiConfig` contains optional OpenRouter/Groq keys, provider order, request timeout, max output tokens, locked model IDs. `AppConfig.ai` is `AiConfig | null`. AI is disabled when both keys are absent.

- [ ] Write failing tests for no-key disabled state, OpenRouter-only, Groq-only, provider-order validation, model-lock validation, timeout/output-token bounds, and no secret exposure through health/config rendering.
- [ ] Run `npm test -- tests/ai-config.test.ts` and confirm RED for missing `ai` contract.
- [ ] Implement minimal config parsing. Allowed provider order tokens are only `openrouter` and `groq`, no duplicates; unavailable providers are skipped at runtime.
- [ ] Keep `OPENROUTER_MODEL=openrouter/free`; add `GROQ_MODEL=openai/gpt-oss-20b` and reject any other values.
- [ ] Run focused/full tests, typecheck, build, diff-check.
- [ ] Commit `feat: add free-only AI configuration`.

### Task 2: Fixed-endpoint provider clients

**Files:** Create `src/ai/types.ts`, `src/ai/http.ts`, `src/ai/openrouter.ts`, `src/ai/groq.ts`; create `tests/ai-providers.test.ts`.

**Interfaces:** `AiProvider.generate(input): Promise<AiProviderResult>`. Input contains `question`, `context`, and output-token limit. Result contains text/provider/model/latency metadata; provider errors use stable typed categories without response bodies.

- [ ] Write failing tests for exact fixed URLs, bearer auth, locked model IDs, bounded timeout, response parsing, empty-content rejection, 429 classification, 5xx classification, and sanitized errors.
- [ ] Confirm RED because provider modules do not exist.
- [ ] Implement fetch-injected clients. OpenRouter uses `https://openrouter.ai/api/v1/chat/completions`; Groq uses `https://api.groq.com/openai/v1/chat/completions`.
- [ ] Never include API keys in thrown errors or telemetry.
- [ ] Run focused/full tests, typecheck, build, diff-check.
- [ ] Commit `feat: add free AI provider clients`.

### Task 3: Free-provider router and metadata telemetry

**Files:** Create `src/ai/router.ts`; modify `src/persistence/observability.ts` only if a narrow adapter is needed; create `tests/ai-router.test.ts`.

**Interfaces:** `AiRouter.ask(input): Promise<{ text: string; providerUsed: string; model: string }>`; router follows configured order, skips providers without keys, and falls through on timeout, 429, 5xx, malformed/empty response, or provider exception. If all providers fail it returns a typed unavailable result/error for Task 4 to handle deterministically.

- [ ] Write failing tests for OpenRouter success, OpenRouter 429 -> Groq success, timeout -> fallback, unavailable provider skip, all-providers-fail, order override, and best-effort provider telemetry.
- [ ] Confirm RED because router does not exist.
- [ ] Implement router with no retries inside a provider; one bounded attempt per configured free provider.
- [ ] Record provider/model/outcome/latency/error-class only; never prompt, response, key, or raw exception message.
- [ ] Make telemetry failure non-blocking.
- [ ] Run focused/full tests, typecheck, build, diff-check.
- [ ] Commit `feat: add free AI provider fallback`.

### Task 4: Sanitized `/ask` reasoning service with deterministic fallback

**Files:** Create `src/ai/ask.ts`, `src/ai/prompt.ts`; create `tests/ai-ask.test.ts`.

**Interfaces:** `AiAskService.ask(question): Promise<{ text: string; providerUsed: string | null }>` obtains context only from `ProjectIntelligence.today()`. Normalize control characters/whitespace, require 1-500 question characters, bound context to 6000 characters, and bound provider output for LINE-safe replies.

- [ ] Write failing tests for empty question rejection/help, normalization, 500-character bound, context truncation, prompt containing only question + deterministic digest, successful AI reply, and deterministic fallback when router is unavailable.
- [ ] Confirm RED because ask/prompt modules do not exist.
- [ ] Implement prompt with explicit untrusted-question and deterministic-context delimiters; instruct model not to invent unavailable facts and to answer concisely.
- [ ] Fallback text must include the deterministic digest and never include provider exception details.
- [ ] `/today` itself must remain AI-free.
- [ ] Run focused/full tests, typecheck, build, diff-check.
- [ ] Commit `feat: add deterministic-safe ask service`.

### Task 5: LINE `/ask`, audit provider metadata, and AI health state

**Files:** Modify `src/line/commands.ts`, `src/line/processor.ts`, `src/persistence/audit.ts`, `src/health.ts`, `src/app.ts`; update command/processor/webhook/health tests.

**Interfaces:** parser recognizes `/ask <question>` without treating question text as a command name. Processor uses injected `AiAskService`, preserves owner authorization + pre-execution dedupe, and records only provider name in `command_runs.provider_used`. Health reports AI `configured` when at least one free provider key is configured, otherwise `not_configured`; AI absence never degrades service health.

- [ ] Write failing tests for parser args, help text, owner `/ask`, no-question behavior, non-owner isolation, duplicate execution once, deterministic fallback reply, provider-used audit metadata, and AI health state.
- [ ] Confirm RED against current command/processor/app behavior.
- [ ] Wire ask service after owner authorization and dedupe; never persist question text.
- [ ] Keep ordinary text ignored and unknown slash commands mapped to help.
- [ ] Run focused/full tests, typecheck, build, diff-check.
- [ ] Commit `feat: expose free AI ask command over LINE`.

### Task 6: Live free-provider verification, documentation, and PR gate

**Files:** Modify `README.md`, `.env.example`; create `docs/phase-5-verification.md`.

**Live policy:** live calls are bounded manual smoke checks only after Tasks 1-5 pass. Detect provider-key presence without printing values. If no secure key is available, report an owner-gated credential/login step instead of inventing or exposing one. Never make a paid call.

- [ ] Detect `OPENROUTER_API_KEY` / `GROQ_API_KEY` presence without echoing values; do not search or print secret contents.
- [ ] If securely available, run one minimal OpenRouter `openrouter/free` smoke request and one Groq `openai/gpt-oss-20b` smoke request, recording only provider/model/status/latency class.
- [ ] If credentials are unavailable, document live-provider verification as pending and tell the owner exactly where authentication/key setup is needed.
- [ ] Update README/example config with current 2026-09-13 free model facts and deprecation note; no secret values.
- [ ] Run fresh `npm ci`, tests, typecheck, build, dry-run, audit, diff-check, build-artifact check, secret/history/local-path scans.
- [ ] Commit docs, push `feat/free-ai-enhancement`, open PR to `main`, verify CI, leave PR unmerged.

## Phase 5 Acceptance

- `/ask` works for owner commands and never exposes arbitrary tool execution.
- OpenRouter uses only `openrouter/free` and Groq fallback uses only `openai/gpt-oss-20b`.
- All-provider failure returns deterministic sanitized project context instead of failing the bot.
- Provider telemetry contains metadata only; command audit can record provider name but never question/prompt/response text.
- `/today` remains deterministic and consumes no AI quota.
- AI secrets are environment-only and absent from logs/repository/history.
- Tests pass with zero real provider calls.
- Live smoke verification is bounded and free-only when credentials are securely available.
