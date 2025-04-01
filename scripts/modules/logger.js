/**
 * Centralized logging module for PRD Generator
 * Provides consistent logging across the application
 */

// Log levels with numeric values for comparison
export const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
};

// Default configuration
let logConfig = {
  level: 'info',
  timestamps: true,
  prefix: 'TaskMaster', // Updated prefix
  colorOutput: true,
  logToFile: false,
  logFilePath: './logs/task-master.log' // Updated path
};

// ANSI color codes
const COLORS = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m'
};

/**
 * Configure the logger
 * @param {object} config - Logger configuration
 */
export function configureLogger(config = {}) {
  logConfig = { ...logConfig, ...config };
}

/**
 * Get timestamp string
 * @returns {string} - Formatted timestamp
 */
function getTimestamp() {
  return new Date().toISOString();
}

/**
 * Log a message with specified level
 * @param {string} level - Log level (debug, info, warn, error)
 * @param {string} message - Message to log
 * @param {object} data - Additional data to log
 */
export function log(level, message, data = null) {
  // Check if this level should be logged
  if (LOG_LEVELS[level] < LOG_LEVELS[logConfig.level]) {
    return;
  }
  
  // Prepare log components
  const timestamp = logConfig.timestamps ? `[${getTimestamp()}]` : '';
  const prefix = logConfig.prefix ? `[${logConfig.prefix}]` : '';
  const levelStr = `[${level.toUpperCase()}]`;
  
  // Apply colors if enabled
  let coloredLevel = levelStr;
  let colorStart = '';
  let colorEnd = '';
  
  if (logConfig.colorOutput) {
    switch (level) {
      case 'debug':
        colorStart = COLORS.gray;
        break;
      case 'info':
        colorStart = COLORS.green;
        break;
      case 'warn':
        colorStart = COLORS.yellow;
        break;
      case 'error':
        colorStart = COLORS.red;
        break;
      default:
        colorStart = COLORS.reset;
    }
    colorEnd = COLORS.reset;
    coloredLevel = `${colorStart}${levelStr}${colorEnd}`;
  }
  
  // Build the log message
  const logMsg = `${timestamp} ${prefix} ${coloredLevel} ${message}`;
  
  // Log to console
  switch (level) {
    case 'debug':
    case 'info':
      console.log(logMsg);
      if (data) console.log(data);
      break;
    case 'warn':
      console.warn(logMsg);
      if (data) console.warn(data);
      break;
    case 'error':
      console.error(logMsg);
      if (data) console.error(data);
      break;
  }
  
  // Log to file if enabled
  if (logConfig.logToFile) {
    // In a real implementation, this would write to a file
    // For simplicity, we're not implementing this here
  }
}

// Convenience methods for different log levels
export const debug = (message, data = null) => log('debug', message, data);
export const info = (message, data = null) => log('info', message, data);
export const warn = (message, data = null) => log('warn', message, data);
export const error = (message, data = null) => log('error', message, data);

/**
 * Create a logger instance with a specific context
 * @param {string} context - Context name for this logger
 * @returns {object} - Logger object with context
 */
export function createLogger(context) {
  return {
    debug: (message, data = null) => log('debug', `[${context}] ${message}`, data),
    info: (message, data = null) => log('info', `[${context}] ${message}`, data),
    warn: (message, data = null) => log('warn', `[${context}] ${message}`, data),
    error: (message, data = null) => log('error', `[${context}] ${message}`, data)
  };
}

// Default logger instance
export default {
  configure: configureLogger,
  log,
  debug,
  info,
  warn, 
  error,
  createLogger
}; 