/**
 * @fileoverview Utility functions for the tm-core package
 * This file exports all utility functions and helper classes
 */

// Export ID generation utilities
export {
	generateTaskId as generateId, // Alias for backward compatibility
	generateTaskId,
	generateSubtaskId,
	isValidTaskId,
	isValidSubtaskId,
	getParentTaskId
} from './id-generator.js';

// Export git utilities
export {
	isGitRepository,
	isGitRepositorySync,
	getCurrentBranch,
	getCurrentBranchSync,
	getLocalBranches,
	getRemoteBranches,
	isGhCliAvailable,
	getGitHubRepoInfo,
	getGitRepositoryRoot,
	getDefaultBranch,
	isOnDefaultBranch,
	insideGitWorkTree,
	sanitizeBranchNameForTag,
	isValidBranchForTag,
	type GitHubRepoInfo
} from './git-utils.js';

// Export path normalization utilities
export {
	normalizeProjectPath,
	denormalizeProjectPath,
	isValidNormalizedPath
} from './path-normalizer.js';

// Export run ID generation utilities
export {
	generateRunId,
	isValidRunId,
	parseRunId,
	compareRunIds
} from './run-id-generator.js';

// Additional utility exports

/**
 * Formats a date for task timestamps
 * @deprecated This is a placeholder function that will be properly implemented in later tasks
 */
export function formatDate(date: Date = new Date()): string {
	return date.toISOString();
}

/**
 * Deep clones an object
 * @deprecated This is a placeholder function that will be properly implemented in later tasks
 */
export function deepClone<T>(obj: T): T {
	return JSON.parse(JSON.stringify(obj));
}
