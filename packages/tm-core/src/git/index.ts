/**
 * @fileoverview Git operations layer for the tm-core package
 * This file exports all git-related classes and interfaces
 */

// Export GitAdapter
export { GitAdapter } from './git-adapter.js';

// Export branch name utilities
export {
	generateBranchName,
	sanitizeBranchName
} from './branch-name-generator.js';
