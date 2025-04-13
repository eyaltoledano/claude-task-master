/**
 * Utility functions for Task Master
 */

import fs from 'fs';
import path from 'path';
import chalk from 'chalk';

// Default log level
let LOG_LEVEL = process.env.LOG_LEVEL || 'info';

// Log level priorities
const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/**
 * Set the current logging level
 * @param {string} level - Log level ('debug', 'info', 'warn', 'error')
 */
export function setLogLevel(level) {
  if (LOG_LEVELS[level] !== undefined) {
    LOG_LEVEL = level;
  } else {
    console.warn(`Invalid log level: ${level}. Using 'info' instead.`);
    LOG_LEVEL = 'info';
  }
}

/**
 * Log a message with a specified level
 * @param {string} level - Log level ('debug', 'info', 'warn', 'error')
 * @param {string} message - Message to log
 */
export function log(level, message) {
  // Skip logging if level is below current LOG_LEVEL
  if (LOG_LEVELS[level] < LOG_LEVELS[LOG_LEVEL]) {
    return;
  }

  const timestamp = new Date().toISOString();
  
  switch (level) {
    case 'debug':
      console.debug(chalk.blue(`[${timestamp}] DEBUG: ${message}`));
      break;
    case 'info':
      console.info(chalk.green(`[${timestamp}] INFO: ${message}`));
      break;
    case 'warn':
      console.warn(chalk.yellow(`[${timestamp}] WARN: ${message}`));
      break;
    case 'error':
      console.error(chalk.red(`[${timestamp}] ERROR: ${message}`));
      break;
    default:
      console.log(`[${timestamp}] ${message}`);
  }
}

/**
 * Read a JSON file
 * @param {string} filePath - Path to the JSON file
 * @returns {Object|null} Parsed JSON content or null on error
 */
export function readJSON(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      return null;
    }
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    log('error', `Error reading JSON file ${filePath}: ${err.message}`);
    return null;
  }
}

/**
 * Write data to a JSON file
 * @param {string} filePath - Path to the JSON file
 * @param {Object} data - Data to write
 * @returns {boolean} True if successful, false otherwise
 */
export function writeJSON(filePath, data) {
  try {
    // Ensure directory exists
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (err) {
    log('error', `Error writing JSON file ${filePath}: ${err.message}`);
    return false;
  }
}

/**
 * Detect camelCase flags in command-line arguments
 * @param {Array<string>} argv - Command-line arguments
 * @returns {Array<Object>} Array of objects with original and kebab-case versions
 */
export function detectCamelCaseFlags(argv) {
  return argv
    .filter(arg => arg.startsWith('--') && /[A-Z]/.test(arg))
    .map(arg => {
      const original = arg.replace(/^--/, '').split('=')[0];
      const kebabCase = original.replace(/([A-Z])/g, '-$1').toLowerCase();
      return { original, kebabCase };
    });
}

/**
 * Retry a function with exponential backoff
 * @param {Function} fn - Function to retry
 * @param {number} maxRetries - Maximum number of retries
 * @param {number} initialDelay - Initial delay in ms
 * @param {number} maxDelay - Maximum delay in ms
 * @param {Object} options - Additional options
 * @param {boolean} options.useRateLimit - Whether to respect rate limit headers
 * @param {boolean} options.fastFail - Fail fast on permanent errors
 * @param {Function} options.onRetry - Callback function when retry happens
 * @returns {Promise<any>} - Result of the function
 */
export async function retryWithExponentialBackoff(
  fn,
  maxRetries = 3,
  initialDelay = 1000,
  maxDelay = 10000,
  options = {}
) {
  const { 
    useRateLimit = true, 
    fastFail = true,
    onRetry = null
  } = options;
  
  let numRetries = 0;
  let delay = initialDelay;

  // Helper to determine if an error is permanent or can be retried
  const isPermanentError = (error) => {
    // List of error types/codes that should not be retried
    const permanentErrorPatterns = [
      'authentication', 
      'authorization',
      'invalid_api_key',
      'billing',
      'payment',
      'access denied',
      'access_denied',
      'forbidden',
      'invalid request',
      'invalid parameter',
      'invalid_parameter'
    ];
    
    // Check if error message matches any permanent error patterns
    if (error && error.message) {
      const errorMessage = error.message.toLowerCase();
      if (permanentErrorPatterns.some(pattern => errorMessage.includes(pattern))) {
        return true;
      }
    }
    
    // Check status code if available
    if (error && error.status) {
      // 4xx errors except 408, 429, and 425 are typically permanent
      return error.status >= 400 && error.status < 500 && 
             ![408, 429, 425].includes(error.status);
    }
    
    return false;
  };
  
  // Helper to get delay from rate limit headers if available
  const getRateLimitDelay = (error) => {
    // Check for rate limit headers from common APIs
    if (error && error.headers) {
      // Anthropic rate limit header
      const retryAfter = error.headers['retry-after'] || 
                          error.headers['x-retry-after'] ||
                          null;
                          
      if (retryAfter) {
        const retrySeconds = parseInt(retryAfter, 10);
        if (!isNaN(retrySeconds)) {
          return retrySeconds * 1000; // Convert to ms
        }
      }
      
      // Check for other rate limit headers
      const resetTime = error.headers['x-rate-limit-reset'] ||
                        error.headers['ratelimit-reset'] ||
                        null;
                        
      if (resetTime) {
        const resetTimestamp = parseInt(resetTime, 10);
        if (!isNaN(resetTimestamp)) {
          const now = Date.now();
          const timeUntilReset = resetTimestamp * 1000 - now;
          if (timeUntilReset > 0) {
            return Math.min(timeUntilReset + 100, maxDelay); // Add small buffer
          }
        }
      }
    }
    
    // Default to regular exponential backoff
    return null;
  };

  while (true) {
    try {
      return await fn();
    } catch (error) {
      numRetries++;
      
      // If fastFail is enabled and this is a permanent error, don't retry
      if (fastFail && isPermanentError(error)) {
        log('error', `Permanent error detected, not retrying: ${error.message}`);
        throw error;
      }
      
      if (numRetries > maxRetries) {
        log('error', `Maximum retries (${maxRetries}) exceeded. Giving up.`);
        throw error;
      }
      
      // Get rate limit delay if available and enabled
      let retryDelay = delay;
      if (useRateLimit) {
        const rateLimitDelay = getRateLimitDelay(error);
        if (rateLimitDelay) {
          retryDelay = rateLimitDelay;
          log('warn', `Rate limit detected. Waiting ${retryDelay}ms before next attempt.`);
        }
      }
      
      log('warn', `Attempt ${numRetries} failed. Retrying in ${retryDelay}ms...`);
      
      // Call onRetry callback if provided
      if (onRetry && typeof onRetry === 'function') {
        try {
          onRetry(numRetries, retryDelay, error);
        } catch (callbackError) {
          // Don't let callback errors interrupt the retry process
          log('warn', `Error in retry callback: ${callbackError.message}`);
        }
      }
      
      await new Promise(resolve => setTimeout(resolve, retryDelay));
      
      // Exponential backoff with jitter
      delay = Math.min(delay * 2, maxDelay) * (0.9 + Math.random() * 0.2);
    }
  }
}

/**
 * Validate and clean file paths
 * @param {string} basePath - Base directory path
 * @param {string} targetPath - Path to validate
 * @returns {string} Validated path
 */
export function validatePath(basePath, targetPath) {
  // Convert to absolute path if relative
  const absPath = path.isAbsolute(targetPath) 
    ? targetPath 
    : path.join(basePath, targetPath);
  
  // Check it doesn't escape the base directory
  const relative = path.relative(basePath, absPath);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Path escapes base directory: ${targetPath}`);
  }
  
  return absPath;
}

/**
 * Archive tasks and PRD files before overwriting
 * @param {string} filePath - Path to the file being overwritten (tasks.json or prd file)
 * @param {boolean} createBackup - Whether to create a backup (defaults to true)
 * @returns {Object} Object containing success status and archive path or error
 */
export function archiveTasksBeforeOverwrite(filePath, createBackup = true) {
  if (!createBackup || !fs.existsSync(filePath)) {
    return { success: true, archived: false };
  }

  try {
    // Create archives directory relative to the tasks directory
    const baseDir = path.dirname(filePath);
    const archiveDir = path.join(baseDir, 'archives');
    
    if (!fs.existsSync(archiveDir)) {
      fs.mkdirSync(archiveDir, { recursive: true });
    }
    
    // Create a unique filename with timestamp
    const fileName = path.basename(filePath);
    const timestamp = new Date().toISOString().replace(/:/g, '-');
    const archivePath = path.join(archiveDir, `${path.parse(fileName).name}-${timestamp}${path.parse(fileName).ext}`);
    
    // Copy the file to the archive
    fs.copyFileSync(filePath, archivePath);
    
    log('info', `Archived ${filePath} to ${archivePath}`);
    return { 
      success: true, 
      archived: true, 
      archivePath 
    };
  } catch (err) {
    log('error', `Error archiving ${filePath}: ${err.message}`);
    return { 
      success: false, 
      error: err.message 
    };
  }
}

/**
 * Restore an archived file to its original location
 * @param {string} archivePath - Path to the archived file
 * @param {string} [destinationPath] - Target path to restore to (optional, will be inferred if not provided)
 * @param {boolean} [createBackup] - Whether to backup existing file at destination (defaults to true)
 * @returns {Object} Object containing success status and destination path or error
 */
export function restoreArchive(archivePath, destinationPath = null, createBackup = true) {
  try {
    if (!fs.existsSync(archivePath)) {
      return { 
        success: false, 
        error: `Archive file not found: ${archivePath}` 
      };
    }

    // Parse the archive path to determine the type and original location if not provided
    const fileName = path.basename(archivePath);
    const archiveDir = path.dirname(archivePath);
    let targetPath = destinationPath;

    if (!targetPath) {
      const baseDir = path.dirname(archiveDir); // Parent directory of archives
      
      // Determine original filename based on archive naming convention
      let originalName;
      if (fileName.startsWith('tasks-')) {
        originalName = 'tasks.json';
      } else if (fileName.startsWith('prd-')) {
        // Extract the original extension if present
        const originalExt = path.extname(fileName);
        originalName = `prd${originalExt}`;
      } else {
        // If not following known pattern, just use the filename without timestamp
        // Extract timestamp portion (assuming ISO format)
        const parts = path.parse(fileName).name.split('-');
        // Remove timestamp parts (last 6 segments from an ISO date)
        const nameWithoutTimestamp = parts.slice(0, parts.length - 6).join('-');
        originalName = `${nameWithoutTimestamp}${path.extname(fileName)}`;
      }
      
      targetPath = path.join(baseDir, originalName);
    }
    
    // Check if destination file exists and archive it if needed
    if (fs.existsSync(targetPath) && createBackup) {
      const backupResult = archiveTasksBeforeOverwrite(targetPath);
      if (!backupResult.success) {
        log('warn', `Could not archive existing file before restore: ${backupResult.error}`);
      } else if (backupResult.archived) {
        log('info', `Existing file has been archived to ${backupResult.archivePath} before restore`);
      }
    }
    
    // Ensure target directory exists
    const targetDir = path.dirname(targetPath);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    
    // Copy the archive to the destination
    fs.copyFileSync(archivePath, targetPath);
    
    log('info', `Restored archive ${archivePath} to ${targetPath}`);
    return { 
      success: true, 
      restoredTo: targetPath 
    };
  } catch (err) {
    log('error', `Error restoring archive: ${err.message}`);
    return { 
      success: false, 
      error: err.message 
    };
  }
}

export default {
  log,
  setLogLevel,
  readJSON,
  writeJSON,
  detectCamelCaseFlags,
  retryWithExponentialBackoff,
  validatePath,
  archiveTasksBeforeOverwrite,
  restoreArchive
};
