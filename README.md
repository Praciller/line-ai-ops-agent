# LINE AI Ops Agent

A zero-cost, local-first AI operations agent controlled through LINE, with safe project monitoring, deterministic fallbacks, and free AI providers.

This project is under active development. **Phase 2 — LINE Transport** is implemented on the current feature branch; live LINE/tunnel validation is intentionally deferred to Phase 6.

## Current capabilities

- Node.js 22+ and TypeScript service foundation
- strict free-only AI route validation
- secret-safe structured logging
- typed `/health` reporting and local dry-run CLI
- official LINE SDK signature verification on `POST /webhook`
- owner-only command authorization
- duplicate `webhookEventId` suppression
- deterministic `/help` and `/status` commands
- injected reply transport for quota-free automated tests

Phase 2 does **not** add Neon persistence, project adapters, live AI calls, proactive sends, or Cloudflare Tunnel automation.

## LINE transport flow

```text
LINE webhook
    |
    v
official SDK signature verification + JSON parsing
    |
    v
text-event normalization -> owner allowlist -> command router
    |
    v
bounded event dedupe -> reply port -> LINE Reply API
```

## Safety boundaries

- Required monthly infrastructure cost remains 0 THB.
- Paid OpenRouter model identifiers are rejected by configuration.
- Missing or invalid LINE signatures are rejected before event processing.
- Only configured owner LINE user IDs may execute commands.
- Non-command text, non-owner events, standby events, and unsupported messages are ignored.
- No shell, SQL, filesystem path, browser action, arbitrary URL, or model-selection command is exposed.
- `.env` files remain outside Git; `.env.example` contains no credentials.
- Tests use fake reply ports and make no real LINE, AI, or database calls.

## Commands

`/help` lists the currently supported commands.

`/status` returns deterministic local component status without external AI calls.

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

To run the local HTTP service:

```bash
npm run dev
```

Health endpoint: <http://localhost:3000/health>

LINE transport is optional. Leave the three LINE values empty to keep the service in local foundation mode. To enable the webhook locally, provide all three values together in an untracked `.env` or process environment:

```text
LINE_CHANNEL_SECRET=<LINE channel secret>
LINE_CHANNEL_ACCESS_TOKEN=<LINE channel access token>
LINE_OWNER_USER_IDS=<comma-separated owner LINE user IDs>
```

Partial LINE configuration is rejected at startup. Never commit real values.

## HTTP behavior

- `GET /health` — deterministic component status.
- `POST /webhook` — 503 when LINE is not configured.
- Missing/invalid LINE signature — 401.
- Signed invalid JSON — 400.
- Valid signed webhook — 200 after owner-only deterministic processing.

The current in-memory dedupe is intentionally process-local and bounded. Durable dedupe/audit state moves to Neon in Phase 4.

## Current limitations

- In-memory dedupe does not survive process restarts; durable Neon persistence is Phase 4.
- Live AI providers are Phase 5 and are not called by the current implementation.
- Cloudflare Tunnel setup and real LINE end-to-end validation are Phase 6.
- Phase 2 has not yet been validated against a real LINE account.

## Roadmap

1. Phase 1 Foundation — complete
2. Phase 2 LINE transport — current
3. Phase 3 Project intelligence
4. Phase 4 Persistence & observability — Neon persistence
5. Phase 5 Free AI enhancement — live AI providers
6. Phase 6 Live LINE validation — Cloudflare Tunnel and real LINE E2E

## License

MIT. See [LICENSE](LICENSE).
