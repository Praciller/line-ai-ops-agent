# Phase 6 Vercel Live LINE Design

**Status:** Approved architecture for Phase 6.

## Goal

Run the LINE AI Ops Agent continuously even when the owner's Windows workstation is powered off, with required monthly infrastructure cost of 0 THB.

## Selected architecture

Deploy the existing Express application to **Vercel Hobby** as the production webhook runtime. Vercel becomes the always-on HTTPS ingress and application host for `/health` and `/webhook`.

Local execution remains supported for development and tests, but the production LINE webhook must not depend on the workstation being online.

## Explicit exclusions

- No Cloudflare Tunnel, Workers, Pages, DNS routing, or other Cloudflare runtime dependency.
- No Tailscale Funnel or Tailscale production dependency.
- No ngrok or other local tunnel in the production path.
- No paid hosting plan or automatic paid fallback.
- No arbitrary shell, SQL, filesystem, browser, provider, model, or URL target exposed through LINE.
## Runtime structure

- `src/app.ts` remains the application factory and owns all routing/security behavior.
- `src/server.ts` remains local-development startup and may call `listen()`.
- A Vercel-specific entrypoint default-exports the Express app and **must not** call `listen()`.
- Production configuration is loaded from Vercel environment variables at invocation/module initialization.
- `/health` and `/webhook` retain their existing public paths and behavior.

## Production data flow

```text
LINE Messaging API
  -> HTTPS Vercel production URL
  -> Express /webhook
  -> LINE signature verification
  -> owner allowlist
  -> event dedupe
  -> deterministic project intelligence / optional free AI
  -> LINE Reply API
```

The production path must work with the workstation fully powered off.

## Vercel plan and cost guardrail

The target account is the existing Vercel **Hobby** team. The project must not require Pro features. If a Hobby quota is exhausted, service interruption is acceptable; silently upgrading to a paid plan is not.
## Environment and secrets

Production secrets are configured only through Vercel encrypted environment variables. Required for real LINE operation:

- `LINE_CHANNEL_SECRET`
- `LINE_CHANNEL_ACCESS_TOKEN`
- `LINE_OWNER_USER_IDS`

Optional runtime values include `OPENROUTER_API_KEY`, `GROQ_API_KEY`, and `DATABASE_URL`. No secret value may be committed, printed in CI, included in verification docs, or copied into LINE messages.

OpenRouter stays locked to `openrouter/free`. Groq stays optional and locked to the approved free-only model configuration; deterministic fallback remains available when AI is absent.

## Persistence behavior

`DATABASE_URL` remains optional. Without a cloud PostgreSQL database, project intelligence and LINE replies remain functional, but durable dedupe/audit/snapshots are degraded to process-local behavior and may not survive separate serverless invocations.

Phase 6 must not reuse an unrelated database merely to remove this limitation. A dedicated free database can be attached only when a zero-cost resource is explicitly available.

## LINE webhook administration

After production deployment succeeds, the LINE Messaging API webhook endpoint is set to exactly:

`https://<vercel-production-host>/webhook`

The endpoint must be HTTPS. Verification must use the official LINE webhook endpoint test and a real owner message. The previous webhook endpoint should be captured before mutation when practical so rollback is possible.
## Failure handling

- Missing LINE configuration must make `/webhook` unavailable rather than accepting unsigned traffic.
- Missing AI configuration must not degrade deterministic commands.
- Missing database configuration is an explicit degraded persistence mode, not an application startup failure.
- External provider, GitHub, site, or database failures continue to use the bounded fallback behavior already implemented.
- Deployment or webhook mutation failures must not expose credentials in errors or logs.

## Testing strategy

Automated tests must not deploy, mutate LINE configuration, or consume AI quota. Tests cover:

- Vercel entrypoint imports and default-exports an Express app without starting a listener.
- existing `/health` and signed `/webhook` behavior is unchanged through the cloud entrypoint.
- production config fails closed for incomplete LINE values.
- no Cloudflare/Tailscale runtime reference is added to the production deployment path.

Live validation is a separate bounded acceptance step after automated gates pass.

## Acceptance

Phase 6 is complete when:

1. Vercel Hobby project deploys successfully from this repository.
2. Production `/health` responds over HTTPS while the local dev server is stopped.
3. Required LINE secrets are configured only in Vercel.
4. LINE webhook points to the Vercel production `/webhook` endpoint and official verification succeeds.
5. A real owner `/help` or `/status` message receives a valid reply.
6. The app remains reachable after the workstation-local service is stopped.
7. CI, secret scans, and local tests pass.
8. Cloudflare and Tailscale are absent from the production ingress design.