/**
 * Configuration classes and schemas for PRD parsing
 */

import { z } from 'zod';
import { TASK_PRIORITY_OPTIONS } from '../../../../src/constants/task-priority.js';
import { getCurrentTag, isSilentMode, log } from '../../utils.js';
import { Duration } from '../../../../src/utils/timeout-manager.js';
import { hasCodebaseAnalysis } from '../../config-manager.js';

// ============================================================================
// SCHEMAS
// ============================================================================

// Define the Zod schema for a SINGLE task object
export const prdSingleTaskSchema = z.object({
	id: z.number(),
	title: z.string().min(1),
	description: z.string().min(1),
	details: z.string(),
	testStrategy: z.string(),
	priority: z.enum(TASK_PRIORITY_OPTIONS),
	dependencies: z.array(z.number()),
	status: z.string()
});

// Define the Zod schema for the ENTIRE expected AI response object
export const prdResponseSchema = z.object({
	tasks: z.array(prdSingleTaskSchema),
	metadata: z.object({
		projectName: z.string(),
		totalTasks: z.number(),
		sourceFile: z.string(),
		generatedAt: z.string()
	})
});

// ============================================================================
// CONFIGURATION CLASSES
// ============================================================================

/**
 * Configuration object for PRD parsing
 */
export class PrdParseConfig {
	constructor(prdPath, tasksPath, numTasks, options = {}) {
		this.prdPath = prdPath;
		this.tasksPath = tasksPath;
		this.numTasks = numTasks;
		this.force = options.force || false;
		this.append = options.append || false;
		this.research = options.research || false;
		this.reportProgress = options.reportProgress;
		this.mcpLog = options.mcpLog;
		this.session = options.session;
		this.projectRoot = options.projectRoot;
		this.tag = options.tag;
		this.streamingTimeout =
			options.streamingTimeout || Duration.seconds(180).milliseconds;

		// Derived values
		this.targetTag = this.tag || getCurrentTag(this.projectRoot) || 'master';
		this.isMCP = !!this.mcpLog;
		this.outputFormat = this.isMCP && !this.reportProgress ? 'json' : 'text';

		// Feature flag: Temporarily disable streaming, use generateObject instead
		// TODO: Re-enable streaming once issues are resolved
		const ENABLE_STREAMING = false;

		this.useStreaming =
			ENABLE_STREAMING &&
			(typeof this.reportProgress === 'function' ||
				this.outputFormat === 'text');
	}

	/**
	 * Check if codebase analysis is available (Claude Code or Gemini CLI)
	 */
	hasCodebaseAnalysis() {
		return hasCodebaseAnalysis(this.research, this.projectRoot, this.session);
	}
}

/**
 * Logging configuration and utilities
 */
export class LoggingConfig {
	constructor(mcpLog, reportProgress) {
		this.isMCP = !!mcpLog;
		this.outputFormat = this.isMCP && !reportProgress ? 'json' : 'text';

		this.logFn = mcpLog || {
			info: (...args) => log('info', ...args),
			warn: (...args) => log('warn', ...args),
			error: (...args) => log('error', ...args),
			debug: (...args) => log('debug', ...args),
			success: (...args) => log('success', ...args)
		};
	}

	report(message, level = 'info') {
		if (this.logFn && typeof this.logFn[level] === 'function') {
			this.logFn[level](message);
		} else if (!isSilentMode() && this.outputFormat === 'text') {
			log(level, message);
		}
	}
}
