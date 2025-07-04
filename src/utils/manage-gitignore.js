// Utility to manage .gitignore files with task file preferences and template merging
import fs from 'fs';
import path from 'path';

// Constants
const TASK_FILES_COMMENT = '# Task files';
const TASK_JSON_PATTERN = 'tasks.json';
const TASK_DIR_PATTERN = 'tasks/';

/**
 * Normalizes a line by removing comments and trimming whitespace
 * @param {string} line - Line to normalize
 * @returns {string} Normalized line
 */
function normalizeLine(line) {
	return line.trim().replace(/^#/, '').trim();
}

/**
 * Checks if a line is task-related (tasks.json or tasks/)
 * @param {string} line - Line to check
 * @returns {boolean} True if line is task-related
 */
function isTaskLine(line) {
	const normalized = normalizeLine(line);
	return normalized === TASK_JSON_PATTERN || normalized === TASK_DIR_PATTERN;
}

/**
 * Adjusts task-related lines in template based on storage preference
 * @param {string[]} templateLines - Array of template lines
 * @param {boolean} storeTasksInGit - Whether to comment out task lines
 * @returns {string[]} Adjusted template lines
 */
function adjustTaskLinesInTemplate(templateLines, storeTasksInGit) {
	return templateLines.map((line) => {
		if (isTaskLine(line)) {
			const normalized = normalizeLine(line);
			// Preserve original trailing whitespace from the line
			const originalTrailingSpace = line.match(/\s*$/)[0];
			return storeTasksInGit
				? `# ${normalized}${originalTrailingSpace}`
				: `${normalized}${originalTrailingSpace}`;
		}
		return line;
	});
}

/**
 * Removes existing task files section from content
 * @param {string[]} existingLines - Existing file lines
 * @returns {string[]} Lines with task section removed
 */
function removeExistingTaskSection(existingLines) {
	const cleanedLines = [];
	let inTaskSection = false;

	for (const line of existingLines) {
		// Start of task files section
		if (line.trim() === TASK_FILES_COMMENT) {
			inTaskSection = true;
			continue;
		}

		// Task lines (commented or not)
		if (isTaskLine(line)) {
			continue;
		}

		// Empty lines within task section
		if (inTaskSection && !line.trim()) {
			continue;
		}

		// End of task section (any non-empty, non-task line)
		if (inTaskSection && line.trim() && !isTaskLine(line)) {
			inTaskSection = false;
		}

		// Keep all other lines
		if (!inTaskSection) {
			cleanedLines.push(line);
		}
	}

	return cleanedLines;
}

/**
 * Filters template lines to only include new content not already present
 * @param {string[]} templateLines - Template lines
 * @param {Set<string>} existingLinesSet - Set of existing trimmed lines
 * @returns {string[]} New lines to add
 */
function filterNewTemplateLines(templateLines, existingLinesSet) {
	return templateLines.filter((line) => {
		const trimmed = line.trim();
		if (!trimmed) return false;

		// Skip task-related lines (handled separately)
		if (isTaskLine(line) || trimmed === TASK_FILES_COMMENT) {
			return false;
		}

		// Include only if not already present
		return !existingLinesSet.has(trimmed);
	});
}

/**
 * Builds the task files section based on storage preference
 * @param {boolean} storeTasksInGit - Whether to comment out task lines
 * @returns {string[]} Task files section lines
 */
function buildTaskFilesSection(storeTasksInGit) {
	const section = [TASK_FILES_COMMENT];

	if (storeTasksInGit) {
		section.push(`# ${TASK_JSON_PATTERN}`, `# ${TASK_DIR_PATTERN} `);
	} else {
		section.push(TASK_JSON_PATTERN, `${TASK_DIR_PATTERN} `);
	}

	return section;
}

/**
 * Adds a separator line if needed (avoids double spacing)
 * @param {string[]} lines - Current lines array
 */
function addSeparatorIfNeeded(lines) {
	if (lines.some((line) => line.trim())) {
		const lastLine = lines[lines.length - 1];
		if (lastLine && lastLine.trim()) {
			lines.push('');
		}
	}
}

/**
 * Validates input parameters
 * @param {string} targetPath - Path to .gitignore file
 * @param {string} content - Template content
 * @param {boolean} storeTasksInGit - Storage preference
 * @throws {Error} If validation fails
 */
function validateInputs(targetPath, content, storeTasksInGit) {
	if (!targetPath || typeof targetPath !== 'string') {
		throw new Error('targetPath must be a non-empty string');
	}

	if (!targetPath.endsWith('.gitignore')) {
		throw new Error('targetPath must end with .gitignore');
	}

	if (!content || typeof content !== 'string') {
		throw new Error('content must be a non-empty string');
	}

	if (typeof storeTasksInGit !== 'boolean') {
		throw new Error('storeTasksInGit must be a boolean');
	}
}

/**
 * Creates a new .gitignore file from template
 * @param {string} targetPath - Path to create file at
 * @param {string[]} templateLines - Adjusted template lines
 * @param {function} log - Logging function
 */
function createNewGitignoreFile(targetPath, templateLines, log) {
	try {
		fs.writeFileSync(targetPath, templateLines.join('\n') + '\n');
		if (typeof log === 'function') {
			log('success', `Created ${targetPath} with full template`);
		}
	} catch (error) {
		if (typeof log === 'function') {
			log('error', `Failed to create ${targetPath}: ${error.message}`);
		}
		throw error;
	}
}

/**
 * Merges template content with existing .gitignore file
 * @param {string} targetPath - Path to existing file
 * @param {string[]} templateLines - Adjusted template lines
 * @param {boolean} storeTasksInGit - Storage preference
 * @param {function} log - Logging function
 */
function mergeWithExistingFile(
	targetPath,
	templateLines,
	storeTasksInGit,
	log
) {
	try {
		// Read and process existing file
		const existingContent = fs.readFileSync(targetPath, 'utf8');
		const existingLines = existingContent.split('\n');

		// Remove existing task section
		const cleanedExistingLines = removeExistingTaskSection(existingLines);

		// Find new template lines to add
		const existingLinesSet = new Set(
			cleanedExistingLines.map((line) => line.trim()).filter((line) => line)
		);
		const newLines = filterNewTemplateLines(templateLines, existingLinesSet);

		// Build final content
		const finalLines = [...cleanedExistingLines];

		// Add new template content
		if (newLines.length > 0) {
			addSeparatorIfNeeded(finalLines);
			finalLines.push(...newLines);
		}

		// Add task files section
		addSeparatorIfNeeded(finalLines);
		finalLines.push(...buildTaskFilesSection(storeTasksInGit));

		// Write result
		fs.writeFileSync(targetPath, finalLines.join('\n') + '\n');

		if (typeof log === 'function') {
			const hasNewContent =
				newLines.length > 0 ? ' and merged new content' : '';
			log(
				'success',
				`Updated ${targetPath} according to user preference${hasNewContent}`
			);
		}
	} catch (error) {
		if (typeof log === 'function') {
			log(
				'error',
				`Failed to merge content with ${targetPath}: ${error.message}`
			);
		}
		throw error;
	}
}

/**
 * Manages .gitignore file creation and updates with task file preferences
 * @param {string} targetPath - Path to the .gitignore file
 * @param {string} content - Template content for .gitignore
 * @param {boolean} storeTasksInGit - Whether to store tasks in git or not
 * @param {function} log - Logging function (level, message)
 * @throws {Error} If validation or file operations fail
 */
function manageGitignoreFile(
	targetPath,
	content,
	storeTasksInGit = true,
	log = null
) {
	// Validate inputs
	validateInputs(targetPath, content, storeTasksInGit);

	// Process template with task preference
	const templateLines = content.split('\n');
	const adjustedTemplateLines = adjustTaskLinesInTemplate(
		templateLines,
		storeTasksInGit
	);

	// Handle file creation or merging
	if (!fs.existsSync(targetPath)) {
		createNewGitignoreFile(targetPath, adjustedTemplateLines, log);
	} else {
		mergeWithExistingFile(
			targetPath,
			adjustedTemplateLines,
			storeTasksInGit,
			log
		);
	}
}

export default manageGitignoreFile;
export {
	manageGitignoreFile,
	normalizeLine,
	isTaskLine,
	buildTaskFilesSection,
	TASK_FILES_COMMENT,
	TASK_JSON_PATTERN,
	TASK_DIR_PATTERN
};
