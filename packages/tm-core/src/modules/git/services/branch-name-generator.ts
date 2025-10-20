/**
 * Branch Name Generator - Generates valid git branch names from patterns
 * @module branch-name-generator
 */

/**
 * Sanitizes a string to be a valid git branch name.
 * Removes invalid characters, converts to lowercase, replaces spaces with hyphens.
 *
 * @param {string} name - Name to sanitize
 * @returns {string} Sanitized branch name
 */
export function sanitizeBranchName(name: string): string {
	if (!name || name.trim() === '') {
		return 'branch';
	}

	return name
		.toLowerCase()
		.replace(/[^a-z0-9-_.\/]/g, '-') // Replace invalid chars with hyphens
		.replace(/\//g, '-') // Replace slashes with hyphens
		.replace(/-+/g, '-') // Remove consecutive hyphens
		.replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
}

/**
 * Generates a branch name from a pattern and variables.
 *
 * @param {Object} options - Generation options
 * @param {string} options.taskId - Task ID to include
 * @param {string} [options.description] - Description to include
 * @param {string} [options.pattern] - Custom pattern (default: 'task-{taskId}-{description}')
 * @param {number} [options.maxLength=50] - Maximum branch name length
 * @returns {string} Generated branch name
 */
export function generateBranchName(options: {
	taskId: string;
	description?: string;
	pattern?: string;
	maxLength?: number;
}): string {
	const maxLength = options.maxLength || 50;
	const pattern = options.pattern || 'task-{taskId}-{description}';

	// Sanitize task ID (replace dots with hyphens)
	const sanitizedTaskId = sanitizeBranchName(
		options.taskId.replace(/\./g, '-')
	);

	// Sanitize description if provided
	const sanitizedDescription = options.description
		? sanitizeBranchName(options.description)
		: sanitizeBranchName(Date.now().toString());

	// Replace pattern variables
	let branchName = pattern
		.replace(/{taskId}/g, sanitizedTaskId)
		.replace(/{description}/g, sanitizedDescription);

	// Sanitize the final result
	branchName = sanitizeBranchName(branchName);

	// Truncate if too long
	if (branchName.length > maxLength) {
		branchName = branchName.substring(0, maxLength).replace(/-+$/, '');
	}

	return branchName;
}
