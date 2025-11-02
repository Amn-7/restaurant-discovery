type LogLevel = 'info' | 'warn' | 'error';

interface LogMeta {
  [key: string]: unknown;
}

function baseLog(level: LogLevel, message: string, meta?: LogMeta) {
  const payload = {
    level,
    message,
    ...meta,
    timestamp: new Date().toISOString()
  };

  if (level === 'error') {
    console.error(JSON.stringify(payload));
  } else if (level === 'warn') {
    console.warn(JSON.stringify(payload));
  } else {
    console.log(JSON.stringify(payload));
  }
}

export function logInfo(message: string, meta?: LogMeta) {
  baseLog('info', message, meta);
}

export function logWarn(message: string, meta?: LogMeta) {
  baseLog('warn', message, meta);
}

export function logError(message: string, meta?: LogMeta) {
  baseLog('error', message, meta);
}
