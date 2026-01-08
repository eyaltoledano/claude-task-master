/**
 * @fileoverview Loop Service - Main orchestrator for loop execution
 * Coordinates preset resolution, prompt generation, execution, progress tracking, and completion detection
 */

import type { LoopConfig, LoopIteration, LoopResult } from '../types.js';
import { LoopCompletionService } from './loop-completion.service.js';
import { LoopExecutorService } from './loop-executor.service.js';
import { LoopPresetService } from './loop-preset.service.js';
import { LoopProgressService } from './loop-progress.service.js';
import { LoopPromptService } from './loop-prompt.service.js';

/**
 * Options for LoopService constructor
 */
export interface LoopServiceOptions {
	/** Absolute path to the project root directory */
	projectRoot: string;
}

/**
 * LoopService - Main orchestrator for loop execution
 * Coordinates all sub-services to run task completion loops
 */
export class LoopService {
	private readonly projectRoot: string;
	private readonly presetService: LoopPresetService;
	private readonly progressService: LoopProgressService;
	private readonly completionService: LoopCompletionService;
	private readonly promptService: LoopPromptService;
	private readonly executorService: LoopExecutorService;
	private isRunning = false;

	/**
	 * Create a new LoopService
	 * @param options - Service configuration options
	 */
	constructor(options: LoopServiceOptions) {
		this.projectRoot = options.projectRoot;

		// Instantiate services with no parameters
		this.presetService = new LoopPresetService();
		this.completionService = new LoopCompletionService();

		// Instantiate service with projectRoot
		this.progressService = new LoopProgressService(options.projectRoot);

		// Instantiate services with DI
		this.promptService = new LoopPromptService(this.presetService);
		this.executorService = new LoopExecutorService(this.completionService);
	}

	/**
	 * Get the project root directory
	 */
	getProjectRoot(): string {
		return this.projectRoot;
	}

	/**
	 * Get the preset service instance
	 * @internal Used for testing and advanced use cases
	 */
	getPresetService(): LoopPresetService {
		return this.presetService;
	}

	/**
	 * Get the progress service instance
	 * @internal Used for testing and advanced use cases
	 */
	getProgressService(): LoopProgressService {
		return this.progressService;
	}

	/**
	 * Get the completion service instance
	 * @internal Used for testing and advanced use cases
	 */
	getCompletionService(): LoopCompletionService {
		return this.completionService;
	}

	/**
	 * Get the prompt service instance
	 * @internal Used for testing and advanced use cases
	 */
	getPromptService(): LoopPromptService {
		return this.promptService;
	}

	/**
	 * Get the executor service instance
	 * @internal Used for testing and advanced use cases
	 */
	getExecutorService(): LoopExecutorService {
		return this.executorService;
	}

	/**
	 * Check if a loop is currently running
	 */
	getIsRunning(): boolean {
		return this.isRunning;
	}

	/**
	 * Run a loop with the given configuration
	 * @param config - Loop configuration
	 * @returns Promise resolving to the loop result
	 */
	async run(config: LoopConfig): Promise<LoopResult> {
		this.isRunning = true;
		const iterations: LoopIteration[] = [];
		let tasksCompleted = 0;

		// Initialize progress file
		await this.progressService.initializeProgressFile(config.progressFile, {
			preset: config.prompt,
			iterations: config.iterations,
			tag: config.tag
		});

		for (let i = 1; i <= config.iterations && this.isRunning; i++) {
			// Generate prompt for this iteration
			const prompt = await this.promptService.generatePrompt({
				config,
				iteration: i,
				projectRoot: this.projectRoot
			});

			// Execute iteration
			const result = await this.executorService.executeIteration(
				prompt,
				i,
				this.projectRoot
			);

			iterations.push(result.iteration);

			// Log progress
			await this.progressService.appendProgress(config.progressFile, {
				timestamp: new Date().toISOString(),
				iteration: i,
				taskId: result.iteration.taskId,
				note: result.iteration.message || 'Iteration completed'
			});

			// Check for completion
			if (result.completionCheck.isComplete) {
				this.isRunning = false;
				return this.buildResult(iterations, tasksCompleted + 1, 'all_complete');
			}

			if (result.completionCheck.isBlocked) {
				this.isRunning = false;
				return this.buildResult(iterations, tasksCompleted, 'blocked');
			}

			if (result.iteration.status === 'success') {
				tasksCompleted++;
			}

			// Sleep between iterations (except last)
			if (i < config.iterations && config.sleepSeconds > 0) {
				await this.sleep(config.sleepSeconds * 1000);
			}
		}

		this.isRunning = false;
		return this.buildResult(iterations, tasksCompleted, 'max_iterations');
	}

	/**
	 * Stop the currently running loop
	 * Signals the loop to stop after the current iteration completes
	 */
	async stop(): Promise<void> {
		this.isRunning = false;
		await this.executorService.stop();
	}

	/**
	 * Build a LoopResult from iterations and status
	 */
	private buildResult(
		iterations: LoopIteration[],
		tasksCompleted: number,
		finalStatus: LoopResult['finalStatus']
	): LoopResult {
		return {
			iterations,
			totalIterations: iterations.length,
			tasksCompleted,
			finalStatus
		};
	}

	/**
	 * Sleep for the specified duration
	 * @param ms - Duration in milliseconds
	 */
	private sleep(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}
}
