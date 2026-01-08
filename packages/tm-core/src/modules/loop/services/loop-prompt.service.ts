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
}
