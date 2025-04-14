import fs from 'fs';
import path from 'path';

// Placeholder utility using passed log object
const ensureDirectoryExists = (dirPath, log) => {
    // REMOVED Redundant logger redefinition
    // const effectiveLog = (level, ...args) => log && typeof log[level] === 'function' ? log[level](...args) : console.log(`[${level.toUpperCase()}]`, ...args);
    
    if (!fs.existsSync(dirPath)) {
        try {
            fs.mkdirSync(dirPath, { recursive: true });
            // Use passed log directly
            if (log && typeof log.debug === 'function') log.debug(`Created directory: ${dirPath}`); 
        } catch (error) {
            if (log && typeof log.error === 'function') log.error(`Failed to create directory ${dirPath}: ${error.message}`);
            throw error; // Rethrow after logging
        }
    }
};

/**
 * Initializes a minimal, language-agnostic skeleton project structure.
 * @param {string} targetDir - The root directory for the project.
 * @param {object} options - Contains projectName.
 * @param {object} log - The logger instance passed from the caller.
 */
export async function initializeProject(
  targetDir,
  options = {}, // Accept options object
  log // Accept log object
) {
  const { projectName = 'new-skeleton-project' } = options; // Destructure options
  // REMOVED Redundant logger redefinition
  // const effectiveLog = (level, ...args) => log && typeof log[level] === 'function' ? log[level](...args) : console.log(`[${level.toUpperCase()}]`, ...args);
  
  // Use passed log directly
  if (log && typeof log.info === 'function') log.info('--- RUNNING SKELETON INITIALIZER ---');

  if (log && typeof log.info === 'function') log.info(`Initializing minimal skeleton structure in: ${targetDir} for ${projectName}`);

  try {
    // Create a basic src directory as a starting point
    const srcDir = path.join(targetDir, 'src');
    // Pass log to the utility
    ensureDirectoryExists(srcDir, log); // Pass the received log object
    if (log && typeof log.info === 'function') log.info('Created basic src/ directory.');

    // TODO: Add any other minimal, language-agnostic files?
    // Maybe a very basic README specific to the skeleton?

    if (log && typeof log.success === 'function') log.success('Minimal skeleton project structure created.');

  } catch (error) {
    if (log && typeof log.error === 'function') log.error(`Skeleton initialization failed: ${error.message}`);
    throw error; // Re-throw the error 
  }
} 