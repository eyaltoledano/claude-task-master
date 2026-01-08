/**
 * @fileoverview Loop prompt generation service
 * Generates full Claude prompts by combining preset content with iteration context
 */

import type { LoopConfig } from '../types.js';
import type { LoopPresetService } from './loop-preset.service.js';

/**
 * Options for generating a loop prompt
 */
export interface PromptGenerationOptions {
	/** Loop configuration */
	config: LoopConfig;
	/** Current iteration number (1-indexed) */
	iteration: number;
	/** Absolute path to the project root */
	projectRoot: string;
}

/**
 * Service for generating loop prompts
 * Combines preset content with iteration context to produce full Claude prompts
 */
export class LoopPromptService {
	private readonly presetService: LoopPresetService;

	/**
	 * Create a new LoopPromptService
	 * @param presetService - Service for loading preset content
	 */
	constructor(presetService: LoopPresetService) {
		this.presetService = presetService;
	}

	/**
	 * Get the preset service instance (used internally)
	 * @internal
	 */
	protected getPresetService(): LoopPresetService {
		return this.presetService;
	}

	/**
	 * Build the context header for a loop iteration
	 * Includes iteration count, file references, and optional tag filter
	 * @param config - Loop configuration
	 * @param iteration - Current iteration number (1-indexed)
	 * @returns Formatted context header string
	 */
	buildContextHeader(config: LoopConfig, iteration: number): string {
		const lines = [
			`# Loop Iteration ${iteration} of ${config.iterations}`,
			``,
			`## Context`,
			`- Progress file: @${config.progressFile}`,
			`- Tasks file: @.taskmaster/tasks/tasks.json`
		];

		if (config.tag) {
			lines.push(`- Tag filter: ${config.tag}`);
		}

		return lines.join('\n');
	}
}
