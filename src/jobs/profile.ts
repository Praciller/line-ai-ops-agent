export const ROLE_RULES = [
  { label: 'AI Engineer', pattern: /\b(ai engineer|applied ai)\b/i, score: 40 },
  { label: 'ML Engineer', pattern: /\b(machine learning|ml) engineer\b/i, score: 36 },
  { label: 'Data Engineer', pattern: /\bdata engineer\b/i, score: 34 },
  { label: 'MLOps', pattern: /\b(mlops|ml platform|ai[- /]?ml)\b/i, score: 32 },
  { label: 'Data Platform', pattern: /\bdata platform\b/i, score: 24 },
] as const;

export const SKILL_GROUPS = [
  { label: 'Python', pattern: /\bpython\b/i },
  { label: 'SQL', pattern: /\bsql\b/i },
  { label: 'LLM/Agents', pattern: /\b(llm|agent|rag|genai|generative ai)\b/i },
  { label: 'Data pipelines', pattern: /\b(etl|elt|pipeline|airflow|dbt)\b/i },
  { label: 'Streaming', pattern: /\b(kafka|flink|streaming)\b/i },
  { label: 'Containers/CI', pattern: /\b(docker|kubernetes|ci\/cd|github actions)\b/i },
  { label: 'MLOps', pattern: /\b(mlops|model serving|model deployment)\b/i },
  { label: 'Observability', pattern: /\b(observability|monitoring|prometheus|grafana)\b/i },
  { label: 'Cloud/Data', pattern: /\b(aws|gcp|azure|cloud|snowflake|databricks)\b/i },
] as const;

export const THAILAND_PATTERN = /\b(thailand|bangkok|nakhon ratchasima|korat)\b/i;
export const WORLDWIDE_PATTERN = /\b(worldwide|anywhere|global|work from anywhere)\b/i;
export const APAC_PATTERN = /\b(apac|asia|asia[- ]pacific)\b/i;
export const INCOMPATIBLE_ONLY_PATTERN = /\b(us|usa|united states|canada|uk|united kingdom|europe|eu)\s*(only)?\b/i;
