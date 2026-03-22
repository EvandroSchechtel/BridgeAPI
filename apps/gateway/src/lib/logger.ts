/**
 * BridgeAPI Gateway — Structured Logger
 */

type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const currentLevel = (process.env.LOG_LEVEL as LogLevel) || "info";

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel];
}

function formatLog(level: LogLevel, message: string, data?: Record<string, unknown>): string {
  return JSON.stringify({
    level,
    message,
    timestamp: new Date().toISOString(),
    ...data,
  });
}

export const logger = {
  debug(message: string, data?: Record<string, unknown>) {
    if (shouldLog("debug")) console.log(formatLog("debug", message, data));
  },
  info(message: string, data?: Record<string, unknown>) {
    if (shouldLog("info")) console.log(formatLog("info", message, data));
  },
  warn(message: string, data?: Record<string, unknown>) {
    if (shouldLog("warn")) console.warn(formatLog("warn", message, data));
  },
  error(message: string, data?: Record<string, unknown>) {
    if (shouldLog("error")) console.error(formatLog("error", message, data));
  },
};
