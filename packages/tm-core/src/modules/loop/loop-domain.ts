/**
 * @fileoverview Loop Domain Facade
 * Public API for loop operations following the pattern of other domains
 */

import path from 'node:path';
import { getLogger } from '../../common/logger/index.js';
import type { ConfigManager } from '../config/managers/config-manager.js';
import {
	PRESET_NAMES,
	isPreset as checkIsPreset,
	getPreset
} from './presets/index.js';
import { LoopService } from './services/loop.service.js';
import type { LoopConfig, LoopPreset, LoopResult } from './types.js';

/**
 * Loop Domain - Unified API for loop operations
 * Coordinates LoopService with lazy instantiation
 */
export class LoopDomain {
	private readonly logger = getLogger('LoopDomain');
	private loopService: LoopService | null = null;
	private readonly projectRoot: string;

	constructor(configManager: ConfigManager) {
		this.projectRoot = configManager.getProjectRoot();
	}

	// ========== Sandbox Auth Operations ==========

	/**
	 * Check if Docker sandbox auth is ready
	 * @returns Object with ready status and optional error message
	 */
	checkSandboxAuth(): { ready: boolean; error?: string } {
		const service = new LoopService({ projectRoot: this.projectRoot });
		return service.checkSandboxAuth();
	}

	/**
	 * Run Docker sandbox session for user authentication
	 * Blocks until user completes auth
	 * @returns Object with success status and optional error message
	 */
	runInteractiveAuth(): { success: boolean; error?: string } {
		const service = new LoopService({ projectRoot: this.projectRoot });
		return service.runInteractiveAuth();
	}

	// ========== Loop Operations ==========

	/**
	 * Run a loop with the given configuration
	 * Creates a new LoopService instance and runs it
	 * @param config - Partial loop configuration (defaults will be applied)
	 * @returns Promise resolving to the loop result
	 * @throws Error if a loop is already running
	 */
	async run(config: Partial<LoopConfig>): Promise<LoopResult> {
		// Prevent orphaning a previous running LoopService
		if (this.loopService?.isRunning) {
			try {
				this.loopService.stop();
			} catch (error) {
				// Log but don't block - stopping previous service is best-effort cleanup
				this.logger.warn('Failed to stop previous loop service:', error);
			}
		}

		const fullConfig = this.buildConfig(config);
		this.loopService = new LoopService({ projectRoot: this.projectRoot });
		return this.loopService.run(fullConfig);
	}

	/**
	 * Stop the currently running loop
	 * Signals the loop to stop and nulls the service reference
	 */
	stop(): void {
		if (this.loopService) {
			this.loopService.stop();
			this.loopService = null;
		}
	}

	/**
	 * Check if a loop is currently running
	 */
	getIsRunning(): boolean {
		return this.loopService?.isRunning ?? false;
	}

	// ========== Preset Operations ==========

	/**
	 * Type guard to check if a string is a valid preset name
	 * @param prompt - The string to check
	 * @returns True if the prompt is a valid LoopPreset
	 */
	isPreset(prompt: string): prompt is LoopPreset {
		return checkIsPreset(prompt);
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
		if (checkIsPreset(prompt)) {
			return getPreset(prompt);
		}
		if (!readFile) {
			throw new Error(
				`Custom prompt file requires readFile callback: ${prompt}`
			);
		}
		return readFile(prompt);
	}

	/**
	 * Get all available preset names
	 * @returns Array of available preset names
	 */
	getAvailablePresets(): LoopPreset[] {
		return [...PRESET_NAMES];
	}

	// ========== Iteration Resolution ==========

	/**
	 * Resolve the number of iterations to use based on preset and task count.
	 * Business logic for determining iterations:
	 * - If user provided explicit iterations, use that
	 * - If preset is 'default' and pendingTaskCount > 0, use pending task count
	 * - Otherwise, default to 10
	 *
	 * @param options - Options for resolving iterations
	 * @param options.userIterations - User-provided iterations (takes priority)
	 * @param options.preset - The preset name being used
	 * @param options.pendingTaskCount - Count of pending tasks + subtasks (for default preset)
	 * @returns The resolved number of iterations
	 */
	resolveIterations(options: {
		userIterations?: number;
		preset: string;
		pendingTaskCount?: number;
	}): number {
		const { userIterations, preset, pendingTaskCount } = options;

		// User explicitly provided iterations - use their value
		if (userIterations !== undefined) {
			return userIterations;
		}

		// For default preset, use pending task count if available
		if (
			preset === 'default' &&
			pendingTaskCount !== undefined &&
			pendingTaskCount > 0
		) {
			return pendingTaskCount;
		}

		// Default for non-default presets or when no pending tasks
		return 10;
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
				path.join(this.projectRoot, '.taskmaster', 'progress.txt'),
			sleepSeconds: partial.sleepSeconds ?? 5,
			tag: partial.tag,
			sandbox: partial.sandbox ?? false,
			includeOutput: partial.includeOutput ?? false,
			verbose: partial.verbose ?? false,
			brief: partial.brief,
			callbacks: partial.callbacks
		};
	}
}
