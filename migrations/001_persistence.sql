CREATE TABLE IF NOT EXISTS line_events (
  event_id text PRIMARY KEY,
  event_type text NOT NULL,
  source_id_hash text NOT NULL,
  received_at timestamptz NOT NULL,
  processing_status text NOT NULL CHECK (processing_status IN ('processing', 'processed', 'failed')),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS command_runs (
  id bigserial PRIMARY KEY,
  event_id text NULL,
  command text NOT NULL,
  outcome text NOT NULL CHECK (outcome IN ('success', 'ignored', 'error')),
  latency_ms integer NOT NULL CHECK (latency_ms >= 0),
  provider_used text NULL,
  error_class text NULL,
  started_at timestamptz NOT NULL,
  finished_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_command_runs_started_at ON command_runs(started_at DESC);

CREATE TABLE IF NOT EXISTS project_snapshots (
  id bigserial PRIMARY KEY,
  project_key text NOT NULL,
  normalized_status jsonb NOT NULL,
  captured_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_project_snapshots_key_time ON project_snapshots(project_key, captured_at DESC);

CREATE TABLE IF NOT EXISTS daily_digests (
  digest_date date PRIMARY KEY,
  deterministic_digest text NOT NULL,
  ai_enhanced_digest text NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS provider_outcomes (
  id bigserial PRIMARY KEY,
  provider text NOT NULL,
  model text NULL,
  outcome text NOT NULL,
  latency_ms integer NOT NULL CHECK (latency_ms >= 0),
  error_class text NULL,
  recorded_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_provider_outcomes_recorded_at ON provider_outcomes(recorded_at DESC);

CREATE TABLE IF NOT EXISTS message_budget (
  month_start date PRIMARY KEY,
  chargeable_sends integer NOT NULL DEFAULT 0 CHECK (chargeable_sends >= 0),
  monthly_hard_limit integer NOT NULL CHECK (monthly_hard_limit > 0),
  proactive_day date NOT NULL,
  proactive_day_sends integer NOT NULL DEFAULT 0 CHECK (proactive_day_sends >= 0),
  daily_hard_limit integer NOT NULL CHECK (daily_hard_limit > 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);