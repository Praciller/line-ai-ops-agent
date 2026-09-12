# Personal AI Ops Agent via LINE

Personal command center for operational checks across the owner's engineering ecosystem, exposed through LINE while keeping required monthly infrastructure cost at **0 THB**.

## Current status

This repository is in **Phase 1 — Foundation**.

Implemented in this phase:
- TypeScript service foundation on Node.js 22+
- strict free-only AI route validation
- structured logging with secret redaction
- typed health reporting
- local dry-run CLI
- Express `/health` endpoint
- automated tests and type checking

Not implemented yet:
- LINE webhook transport
- Neon persistence
- GitHub/OpenDQ/Dream Logs adapters
- live AI provider calls
- Cloudflare Tunnel automation
## Local setup

Requirements:
- Node.js 22 or newer
- npm 12 or compatible

```bash
npm install
npm test
npm run typecheck
npm run build
npm run dry-run
```

Expected dry-run output is a single JSON health report. Phase 1 performs **no LINE, database, or AI network calls**.

To run the local HTTP service:

```bash
npm run dev
```

Then open:

```text
http://localhost:3000/health
```

The Phase 1 health report intentionally marks LINE, database, and AI as `not_configured` rather than reporting them as healthy.
## Configuration

Copy `.env.example` to `.env` when local overrides are needed.

```text
NODE_ENV=development
PORT=3000
SERVICE_NAME=personal-ai-ops-line
LOG_LEVEL=info
OPENROUTER_MODEL=openrouter/free
```

`OPENROUTER_MODEL` is intentionally restricted to `openrouter/free` in the current foundation. A paid model identifier is rejected during configuration loading.

## Zero-cost and safety contract

- No paid service is required for normal operation.
- The application must never silently fall back to a paid AI route.
- Secrets must remain outside Git and are redacted from structured logs.
- Phase 1 is local-only and read-only.
- Future LINE commands will use explicit allowlists; arbitrary shell, SQL, filesystem paths, URLs, and model names are out of scope.

Design and implementation planning documents are under `docs/superpowers/`.
