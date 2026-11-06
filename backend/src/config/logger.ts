// Safe Centralized Logger for PingUp
// Automatically sanitizes sensitive keys (tokens, passwords, secrets, private keys, authorization headers)

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

const SENSITIVE_KEYS = [
  'password',
  'token',
  'authorization',
  'secret',
  'apikey',
  'api_key',
  'private_key',
  'privatekey',
  'refresh_token',
  'idtoken',
  'id_token',
  'cookie',
];

function sanitize(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'string') {
    // Check if looks like a bearer token or secret
    if (obj.length > 50 && (obj.startsWith('ey') || obj.includes('bearer'))) {
      return '[REDACTED_TOKEN]';
    }
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(sanitize);
  }
  if (typeof obj === 'object') {
    const cleaned: Record<string, any> = {};
    for (const [key, val] of Object.entries(obj)) {
      const lower = key.toLowerCase();
      if (SENSITIVE_KEYS.some((sensitive) => lower.includes(sensitive))) {
        cleaned[key] = '[REDACTED]';
      } else {
        cleaned[key] = sanitize(val);
      }
    }
    return cleaned;
  }
  return obj;
}

function formatMessage(level: LogLevel, message: string, meta?: any): string {
  const timestamp = new Date().toISOString();
  const safeMeta = meta !== undefined ? ` ${JSON.stringify(sanitize(meta))}` : '';
  return `[${timestamp}] [${level.toUpperCase()}] [Atti]: ${message}${safeMeta}`;
}

export const logger = {
  info: (message: string, meta?: any) => {
    console.log(formatMessage('info', message, meta));
  },
  warn: (message: string, meta?: any) => {
    console.warn(formatMessage('warn', message, meta));
  },
  error: (message: string, meta?: any) => {
    console.error(formatMessage('error', message, meta));
  },
  debug: (message: string, meta?: any) => {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(formatMessage('debug', message, meta));
    }
  },
};

