/**
 * @fileoverview Loop Domain Facade
 * Public API for loop operations following the pattern of other domains
 */

import type { ConfigManager } from '../config/managers/config-manager.js';
import type { TasksDomain } from '../tasks/tasks-domain.js';
import { LoopService } from './services/loop.service.js';
import { LoopPresetService } from './services/loop-preset.service.js';
import type { LoopConfig, LoopResult, LoopPreset } from './types.js';

/**
 * Loop Domain - Unified API for loop operations
 * Coordinates LoopService with lazy instantiation and provides
 * cross-domain integration with TasksDomain for completion checking
 */
export class LoopDomain {
	private loopService: LoopService | null = null;
	private readonly projectRoot: string;
	private readonly presetService: LoopPresetService;
	private tasksDomain: TasksDomain | null = null;

	constructor(configManager: ConfigManager) {
		this.projectRoot = configManager.getProjectRoot();
		this.presetService = new LoopPresetService();
	}

	/**
	 * Set the TasksDomain for task completion checking
	 * Called by TmCore after TasksDomain is initialized
	 */
	setTasksDomain(tasksDomain: TasksDomain): void {
		this.tasksDomain = tasksDomain;
	}

	// ========== Loop Operations ==========

	/**
	 * Run a loop with the given configuration
	 * Creates a new LoopService instance and runs it
	 * @param config - Partial loop configuration (defaults will be applied)
	 * @returns Promise resolving to the loop result
	 */
	async run(config: Partial<LoopConfig>): Promise<LoopResult> {
		const fullConfig = this.buildConfig(config);
		this.loopService = new LoopService({ projectRoot: this.projectRoot });
		return this.loopService.run(fullConfig);
	}

	/**
	 * Stop the currently running loop
	 * Signals the loop to stop and nulls the service reference
	 */
	async stop(): Promise<void> {
		if (this.loopService) {
			await this.loopService.stop();
			this.loopService = null;
		}
	}

	/**
	 * Check if a loop is currently running
	 */
	isRunning(): boolean {
		return this.loopService?.getIsRunning() ?? false;
	}

	// ========== Preset Operations ==========

	/**
	 * Type guard to check if a string is a valid preset name
	 * @param prompt - The string to check
	 * @returns True if the prompt is a valid LoopPreset
	 */
	isPreset(prompt: string): prompt is LoopPreset {
		return this.presetService.isPreset(prompt);
	}

	/**
	 * Resolve a prompt string to its content
	 * For preset names, returns the inlined content
	 * For file paths, reads the file (requires readFile callback)
	 * @param prompt - Either a preset name or a file path
	 * @param readFile - Optional async function to read file content
	 * @returns Promise resolving to the prompt content string
	 */
	async resolvePrompt(
		prompt: LoopPreset | string,
		readFile?: (path: string) => Promise<string>
	): Promise<string> {
		return this.presetService.resolvePrompt(prompt, readFile);
	}

	/**
	 * Get all available preset names
	 * @returns Array of available preset names
	 */
	getAvailablePresets(): LoopPreset[] {
		return ['default', 'test-coverage', 'linting', 'duplication', 'entropy'];
	}

	// ========== Task Completion Check ==========

	/**
	 * Check if all tasks are complete or cancelled
	 * Useful for loop completion conditions
	 * @param options - Options including optional tag filter
	 * @returns Promise resolving to true if all tasks are done or cancelled
	 * @throws Error if TasksDomain is not set
	 */
	async checkAllTasksComplete(options: { tag?: string } = {}): Promise<boolean> {
		if (!this.tasksDomain) {
			throw new Error('TasksDomain not set. Call setTasksDomain first.');
		}
		const result = await this.tasksDomain.list({ tag: options.tag });
		return result.tasks.every(
			(t) => t.status === 'done' || t.status === 'cancelled'
		);
	}

	// ========== Internal Helpers ==========

	/**
	 * Build a complete LoopConfig from partial input
	 * Applies sensible defaults for any missing fields
	 * @param partial - Partial configuration to merge with defaults
	 * @returns Complete LoopConfig with all required fields
	 */
	private buildConfig(partial: Partial<LoopConfig>): LoopConfig {
		return {
			iterations: partial.iterations ?? 10,
			prompt: partial.prompt ?? 'default',
			progressFile:
				partial.progressFile ??
				`${this.projectRoot}/.taskmaster/loop-progress.txt`,
			sleepSeconds: partial.sleepSeconds ?? 5,
			onComplete: partial.onComplete,
			tag: partial.tag,
			status: partial.status ?? 'pending'
		};
	}
}
