/**
 * @fileoverview Git operations layer for the tm-core package
 * This file exports all git-related classes and interfaces
 */

// Export GitAdapter
export { GitAdapter } from './adapters/git-adapter.js';

// Export branch name utilities
export {
	generateBranchName,
	sanitizeBranchName
} from './services/branch-name-generator.js';
