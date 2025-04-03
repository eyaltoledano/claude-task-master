import chalk from "chalk";

// Define log levels
const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  success: 4,
};

// Get log level from environment or default to info
const LOG_LEVEL = process.env.LOG_LEVEL
  ? LOG_LEVELS[process.env.LOG_LEVEL.toLowerCase()]
  : LOG_LEVELS.info;

/**
 * Logs a message with the specified level
 * @param {string} level - The log level (debug, info, warn, error, success)
 * @param  {...any} args - Arguments to log
 */
function log(level, ...args) {
  const icons = {
    debug: chalk.gray("🔍"),
    info: chalk.blue("ℹ️"),
    warn: chalk.yellow("⚠️"),
    error: chalk.red("❌"),
    success: chalk.green("✅"),
  };

  if (LOG_LEVELS[level] >= LOG_LEVEL) {
    const icon = icons[level] || "";

    if (level === "error") {
      console.error(icon, chalk.red(...args));
    } else if (level === "warn") {
      console.warn(icon, chalk.yellow(...args));
    } else if (level === "success") {
      console.log(icon, chalk.green(...args));
    } else if (level === "info") {
      console.log(icon, chalk.blue(...args));
    } else {
      console.log(icon, ...args);
    }
  }
}

/**
 * Create a logger object with methods for different log levels
 * Can be used as a drop-in replacement for existing logger initialization
 * @returns {Object} Logger object with info, error, debug, warn, and success methods
 */
export function createLogger() {
  return {
    debug: (message) => log("debug", message),
    info: (message) => log("info", message),
    warn: (message) => log("warn", message),
    error: (message) => log("error", message),
    success: (message) => log("success", message),
    log: log, // Also expose the raw log function
  };
}

// Export a default logger instance
const logger = createLogger();

export default logger;
export { log, LOG_LEVELS }; 