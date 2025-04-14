import path from 'path';
import fs from 'fs';

/**
 * Initializes specific configurations for the 'local' task provider.
 * Currently, this might involve ensuring the default tasks directory exists
 * or setting specific environment variables in .env.example if needed.
 *
 * @param {string} targetDir - The root directory of the project being initialized.
 * @param {object} options - Additional options (e.g., projectName).
 * @param {object} log - Logger instance.
 */
export async function initializeProvider(targetDir, options = {}, log) {
	const effectiveLog = {
		info: (msg, ...args) => log && log.info ? log.info(msg, ...args) : console.log("[INFO]", msg, ...args),
		warn: (msg, ...args) => log && log.warn ? log.warn(msg, ...args) : console.warn("[WARN]", msg, ...args),
		error: (msg, ...args) => log && log.error ? log.error(msg, ...args) : console.error("[ERROR]", msg, ...args),
		debug: (msg, ...args) => log && log.debug ? log.debug(msg, ...args) : (process.env.DEBUG === 'true' ? console.log("[DEBUG]", msg, ...args) : null),
		success: (msg, ...args) => log && log.success ? log.success(msg, ...args) : console.log("[SUCCESS]", msg, ...args),
	};

	effectiveLog.info(`Running local provider initialization in ${targetDir}...`);

	// Example: Ensure the default tasks directory exists (might be redundant if common setup does it)
	const tasksDir = path.join(targetDir, 'tasks');
	if (!fs.existsSync(tasksDir)) {
		fs.mkdirSync(tasksDir, { recursive: true });
		effectiveLog.info(`Ensured default tasks directory exists: ${tasksDir}`);
	} else {
		effectiveLog.debug(`Default tasks directory already exists: ${tasksDir}`);
	}

	// Add any 'local' provider specific setup here.
	// For now, it's mostly handled by the common setup.

	effectiveLog.success(`Local provider initialization complete.`);
} 