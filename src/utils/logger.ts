import { getConfig } from "../config.js";

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  SILENT = 4,
}

const logLevelMap: Record<string, LogLevel> = {
  debug: LogLevel.DEBUG,
  info: LogLevel.INFO,
  warn: LogLevel.WARN,
  error: LogLevel.ERROR,
  silent: LogLevel.SILENT,
};

export class Logger {
  private level: LogLevel;
  private context: string;

  constructor(context: string = "app") {
    this.context = context;
    const config = getConfig();
    this.level = logLevelMap[config.LOG_LEVEL?.toLowerCase() || "info"] || LogLevel.INFO;
  }

  private log(level: LogLevel, message: string, ...args: unknown[]): void {
    if (level < this.level) return;

    const timestamp = new Date().toISOString();
    const levelStr = LogLevel[level];
    const prefix = `[${timestamp}] [${levelStr}] [${this.context}]`;

    switch (level) {
      case LogLevel.DEBUG:
      case LogLevel.INFO:
        console.log(prefix, message, ...args);
        break;
      case LogLevel.WARN:
        console.warn(prefix, message, ...args);
        break;
      case LogLevel.ERROR:
        console.error(prefix, message, ...args);
        break;
    }
  }

  debug(message: string, ...args: unknown[]): void {
    this.log(LogLevel.DEBUG, message, ...args);
  }

  info(message: string, ...args: unknown[]): void {
    this.log(LogLevel.INFO, message, ...args);
  }

  warn(message: string, ...args: unknown[]): void {
    this.log(LogLevel.WARN, message, ...args);
  }

  error(message: string, ...args: unknown[]): void {
    this.log(LogLevel.ERROR, message, ...args);
  }
}

/**
 * Create a logger instance for a specific context
 */
export function createLogger(context: string): Logger {
  return new Logger(context);
}
