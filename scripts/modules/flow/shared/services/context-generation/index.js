/**
 * Context Generation Services
 *
 * Unified export of all context generation services for creating
 * comprehensive context for Claude Code and VibeKit agents.
 */

export { ProjectDetector } from './project-detector.js';
export { TaskEnhancer } from './task-enhancer.js';
export { GitContextGenerator } from './git-context-generator.js';
export { ProjectStructureAnalyzer } from '../../features/ast/services/project-structure-analyzer.js';
export { MarkdownFormatter } from './markdown-formatter.js';
export { TaskContextGenerator } from '../../features/ast/services/task-context-generator.js';

// Convenience factory function
export async function createTaskContextGenerator(options = {}) {
	const { TaskContextGenerator } = await import(
		'../../features/ast/services/task-context-generator.js'
	);
	return new TaskContextGenerator(options);
}

// Version info
export const VERSION = '1.0.0';
export const DESCRIPTION =
	'TaskMaster Flow Context Generation Services - Phase 1';
