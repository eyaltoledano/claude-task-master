/**
 * Logger Module
 * 
 * Provides logging functionality with different levels of verbosity
 */

// Log levels with numeric values for comparison
const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
};

// Current log level from environment or default to 'info'
const currentLevel = (process.env.LOG_LEVEL || 'info').toLowerCase();

/**
 * Log a message with the specified level
 * @param {string} level - The log level: 'debug', 'info', 'warn', 'error'
 * @param {string} message - The message to log
 */
export function log(level, message) {
  // Convert to lowercase for case-insensitive comparison
  const requestedLevel = level.toLowerCase();
  
  // Skip logging if the requested level is below the current threshold
  if (LOG_LEVELS[requestedLevel] < LOG_LEVELS[currentLevel]) {
    return;
  }
  
  // Format timestamp
  const timestamp = new Date().toISOString();
  
  // Format log message
  const formattedMessage = `[${timestamp}] ${requestedLevel.toUpperCase()}: ${message}`;
  
  // Choose appropriate console method
  switch (requestedLevel) {
    case 'debug':
      console.debug(formattedMessage);
      break;
    case 'info':
      console.info(formattedMessage);
      break;
    case 'warn':
      console.warn(formattedMessage);
      break;
    case 'error':
      console.error(formattedMessage);
      break;
    default:
      console.log(formattedMessage);
  }
}

/**
 * Debug level log
 * @param {string} message - The message to log
 */
export function debug(message) {
  log('debug', message);
}

/**
 * Info level log
 * @param {string} message - The message to log
 */
export function info(message) {
  log('info', message);
}

/**
 * Warning level log
 * @param {string} message - The message to log
 */
export function warn(message) {
  log('warn', message);
}

/**
 * Error level log
 * @param {string} message - The message to log
 */
export function error(message) {
  log('error', message);
}

// Export the current log level for external checks
export const logLevel = currentLevel; 