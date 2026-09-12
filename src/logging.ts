export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

type LoggerOptions = {
  secrets?: readonly string[];
  write?: (line: string) => void;
};

type Logger = Record<LogLevel, (message: string, context?: unknown) => void>;

function redactString(value: string, secrets: readonly string[]): string {
  return secrets
    .filter((secret) => secret.length > 0)
    .reduce((result, secret) => result.split(secret).join('[REDACTED]'), value);
}

export function redactSecrets(value: unknown, secrets: readonly string[]): unknown {
  if (typeof value === 'string') return redactString(value, secrets);
  if (Array.isArray(value)) return value.map((item) => redactSecrets(item, secrets));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, redactSecrets(item, secrets)]),
    );
  }
  return value;
}

export function createLogger(options: LoggerOptions = {}): Logger {
  const secrets = options.secrets ?? [];
  const write = options.write ?? ((line: string) => process.stdout.write(`${line}\n`));

  const log = (level: LogLevel, message: string, context?: unknown) => {
    const record = { timestamp: new Date().toISOString(), level, message, context };
    write(JSON.stringify(redactSecrets(record, secrets)));
  };

  return {
    debug: (message, context) => log('debug', message, context),
    info: (message, context) => log('info', message, context),
    warn: (message, context) => log('warn', message, context),
    error: (message, context) => log('error', message, context),
  };
}
