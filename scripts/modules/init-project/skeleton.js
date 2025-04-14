import fs from 'fs';
import path from 'path';

// Placeholder utility using passed log object
const ensureDirectoryExists = (dirPath, log) => {
    // Add check for valid log function
    const effectiveLog = (level, ...args) => log && typeof log[level] === 'function' ? log[level](...args) : console.log(`[${level.toUpperCase()}]`, ...args);
    
    if (!fs.existsSync(dirPath)) {
        try {
            fs.mkdirSync(dirPath, { recursive: true });
            effectiveLog('debug', `Created directory: ${dirPath}`); 
        } catch (error) {
            effectiveLog('error', `Failed to create directory ${dirPath}: ${error.message}`);
            throw error; // Rethrow after logging
        }
    }
};

/**
 * Initializes a minimal, language-agnostic skeleton project structure.
 * @param {string} targetDir - The root directory for the project.
 * @param {string} projectName - The name of the project.
 * @param {object} log - The logger instance passed from the caller.
 */
export async function initializeProject(
  targetDir,
  projectName,
  log // Accept log object
) {
  // Use the passed log object (add validation if needed)
  const effectiveLog = (level, ...args) => log && typeof log[level] === 'function' ? log[level](...args) : console.log(`[${level.toUpperCase()}]`, ...args);
  
  effectiveLog('info', `Initializing minimal skeleton structure in: ${targetDir}`);

  try {
    // Create a basic src directory as a starting point
    const srcDir = path.join(targetDir, 'src');
    // Pass log to the utility
    ensureDirectoryExists(srcDir, log);
    effectiveLog('info', 'Created basic src/ directory.');

    // TODO: Add any other minimal, language-agnostic files?
    // Maybe a very basic README specific to the skeleton?

    effectiveLog('success', 'Minimal skeleton project structure created.');

  } catch (error) {
    effectiveLog('error', `Skeleton initialization failed: ${error.message}`);
    throw error; // Re-throw the error 
  }
} 