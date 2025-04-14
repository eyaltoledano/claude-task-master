import path from 'path';
import fs from 'fs';

/**
 * Initializes specific configurations for the 'jira' task provider.
 * This might involve adding Jira-specific variables to .env.example,
 * creating a sample Jira configuration file, etc.
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

	effectiveLog.info(`Running Jira provider initialization in ${targetDir}...`);

	// Example: Add Jira specific variables to .env.example if it exists
	const envExamplePath = path.join(targetDir, '.env.example');
	if (fs.existsSync(envExamplePath)) {
		try {
			let content = fs.readFileSync(envExamplePath, 'utf8');
			const jiraVars = `
# --- JIRA Configuration ---
# Your Jira instance URL (e.g., https://your-domain.atlassian.net)
JIRA_HOST=
# Your Jira username or email
JIRA_USERNAME=
# Your Jira API token (generate from Atlassian account settings)
JIRA_API_TOKEN=
# Default Jira project key to use (e.g., PROJ)
JIRA_PROJECT_KEY=
# Default issue type for new tasks (e.g., Task, Story, Bug)
JIRA_ISSUE_TYPE=Task
# Optional: Path to store downloaded attachments (defaults to OS temp dir)
# ATTACHMENT_DIR=/absolute/path/to/attachments_dir
`;
			if (!content.includes('# --- JIRA Configuration ---')) {
				content += jiraVars;
				fs.writeFileSync(envExamplePath, content);
				effectiveLog.info(`Added Jira configuration variables to ${envExamplePath}`);
			} else {
				effectiveLog.debug(`Jira configuration variables already present in ${envExamplePath}`);
			}
		} catch (error) {
			effectiveLog.warn(`Could not update ${envExamplePath} for Jira config: ${error.message}`);
		}
	} else {
		effectiveLog.warn(`${envExamplePath} not found. Skipping Jira variable addition.`);
	}

	// Add any other 'jira' provider specific setup here.

	effectiveLog.success(`Jira provider initialization complete.`);
	effectiveLog.warn(`Remember to configure your Jira credentials and project key in the .env file!`);
} 