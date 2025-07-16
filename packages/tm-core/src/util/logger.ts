import { Log } from './log.js'

export interface Logger {
  debug(message?: any, extra?: Record<string, any>): void
  info(message?: any, extra?: Record<string, any>): void
  error(message?: any, extra?: Record<string, any>): void
  warn(message?: any, extra?: Record<string, any>): void
  child(tags: Record<string, any>): Logger
}

class LoggerImpl implements Logger {
  private _logger: Log.Logger

  constructor(logger: Log.Logger) {
    this._logger = logger
  }

  debug(message?: any, extra?: Record<string, any>): void {
    this._logger.debug(message, extra)
  }

  info(message?: any, extra?: Record<string, any>): void {
    this._logger.info(message, extra)
  }

  error(message?: any, extra?: Record<string, any>): void {
    this._logger.error(message, extra)
  }

  warn(message?: any, extra?: Record<string, any>): void {
    this._logger.warn(message, extra)
  }

  child(tags: Record<string, any>): Logger {
    return new LoggerImpl(Log.create(tags))
  }
}

export const logger = new LoggerImpl(Log.Default)
