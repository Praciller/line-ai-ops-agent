# LINE AI Ops Agent

A zero-cost, local-first AI operations agent controlled through LINE, with safe project monitoring, deterministic fallbacks, and free AI providers.

This project is under active development. The repository currently contains **Phase 1 — Foundation**; later phases are planned and are not represented as completed production functionality.

## Current phase

Phase 1 provides:

- Node.js 22+ and TypeScript service foundation
- strict free-only AI route validation
- secret-safe structured logging
- typed `/health` reporting
- local dry-run CLI
- automated tests, type checking, and a build

Phase 1 intentionally makes no LINE, database, AI-provider, or other external network calls. LINE, Neon, GitHub/project adapters, live AI calls, and tunnel automation are not implemented yet.

## Architecture

```text
local CLI or HTTP request
          |
          v
  typed config + free-only policy
          |
          +--> deterministic health report
          +--> secret-redacted structured logs
          +--> /health endpoint
```

The intended direction is LINE transport over a local-first operations core. External integrations will be added behind explicit adapters and allowlists as the project progresses.

## Safety boundaries

- No paid service is required for the current foundation.
- The configuration rejects non-free OpenRouter model identifiers; it must not silently fall back to paid routes.
- Tests and the dry-run path do not consume LINE, AI, or database quotas.
- Secrets stay outside Git and are redacted from structured logs.
- The current service is local-only and read-only.
- Future commands will use explicit allowlists; arbitrary shell commands, SQL, filesystem paths, URLs, and model names are out of scope.

## Local setup

Requirements: Node.js 22 or newer and npm 12 or compatible.

```bash
npm ci
npm test
npm run typecheck
npm run build
npm run dry-run
```

The dry-run command prints one JSON health report. To run the local HTTP service:

```bash
npm run dev
```

Then open <http://localhost:3000/health>. The report marks LINE, database, and AI as `not_configured` rather than claiming those dependencies are healthy.

Copy `.env.example` to `.env` only when local overrides are needed. The example file contains safe defaults and placeholders only.

## Roadmap

1. Phase 1 Foundation — current
2. Phase 2 LINE transport
3. Phase 3 Project intelligence
4. Phase 4 Persistence & observability
5. Phase 5 Free AI enhancement
6. Phase 6 Live LINE validation

## License

MIT. See [LICENSE](LICENSE).
