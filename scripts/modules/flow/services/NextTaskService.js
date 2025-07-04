/**
 * NextTaskService - Handles automatic progression to the next available task
 * Integrates with Task Master backends to orchestrate task workflow
 */

export class NextTaskService {
	constructor(backend, config = {}) {
		this.backend = backend;
		this.config = {
			autoProgressToNext: config.autoProgressToNext ?? true,
			progressDelay: config.progressDelay ?? 2000, // 2 second delay before next task
			requireCleanWorktree: config.requireCleanWorktree ?? true,
			maxRetries: config.maxRetries ?? 3,
			retryDelay: config.retryDelay ?? 5000,
			...config
		};
		this.retryCount = 0;
	}

	/**
	 * Get the next available task from Task Master
	 * @returns {Promise<Object>} Next task result with task, suggestions, and metadata
	 */
	async getNextTask() {
		try {
			console.log('🔍 [NextTaskService] Getting next available task...');
			
			if (!this.backend?.nextTask) {
				throw new Error('Backend does not support nextTask operation');
			}

			const result = await this.backend.nextTask();
			
			if (!result?.task) {
				console.log('📝 [NextTaskService] No more tasks available');
				return {
					success: true,
					hasNextTask: false,
					message: 'All tasks completed or no available tasks',
					suggestions: result?.suggestions || []
				};
			}

			console.log(`📋 [NextTaskService] Found next task: ${result.task.id} - ${result.task.title}`);
			
			return {
				success: true,
				hasNextTask: true,
				task: result.task,
				suggestions: result.suggestions || [],
				telemetryData: result.telemetryData
			};

		} catch (error) {
			console.error('❌ [NextTaskService] Failed to get next task:', error.message);
			return {
				success: false,
				error: error.message,
				hasNextTask: false
			};
		}
	}

	/**
	 * Validate if the system is ready to start the next task
	 * @param {Object} currentWorktree - Current worktree information
	 * @param {Object} nextTask - Next task to validate
	 * @returns {Promise<Object>} Validation result
	 */
	async validateReadyForNextTask(currentWorktree, nextTask) {
		const validationResult = {
			success: true,
			checks: {},
			warnings: [],
			errors: []
		};

		try {
			// Check 1: Verify task dependencies are met
			console.log('🔍 [NextTaskService] Checking task dependencies...');
			validationResult.checks.dependencies = await this.validateTaskDependencies(nextTask);
			
			if (!validationResult.checks.dependencies.success) {
				validationResult.errors.push('Task dependencies not satisfied');
				validationResult.success = false;
			}

			// Check 2: Clean worktree state (if required)
			if (this.config.requireCleanWorktree && currentWorktree) {
				console.log('🔍 [NextTaskService] Checking worktree state...');
				validationResult.checks.worktreeState = await this.validateWorktreeState(currentWorktree);
				
				if (!validationResult.checks.worktreeState.success) {
					validationResult.warnings.push('Worktree has uncommitted changes');
					// Don't fail validation, just warn
				}
			}

			// Check 3: Verify task is ready for implementation
			console.log('🔍 [NextTaskService] Checking task readiness...');
			validationResult.checks.taskReadiness = await this.validateTaskReadiness(nextTask);
			
			if (!validationResult.checks.taskReadiness.success) {
				validationResult.warnings.push('Task may need additional preparation');
			}

			// Check 4: Backend connectivity
			validationResult.checks.backend = await this.validateBackendConnectivity();
			
			if (!validationResult.checks.backend.success) {
				validationResult.errors.push('Backend connectivity issues');
				validationResult.success = false;
			}

			return validationResult;

		} catch (error) {
			console.error('❌ [NextTaskService] Validation failed:', error.message);
			return {
				success: false,
				error: error.message,
				checks: validationResult.checks
			};
		}
	}

	/**
	 * Start the next task workflow
	 * @param {Object} nextTask - Task to start
	 * @param {Object} options - Options for starting the task
	 * @returns {Promise<Object>} Start task result
	 */
	async startNextTask(nextTask, options = {}) {
		try {
			console.log(`🚀 [NextTaskService] Starting task ${nextTask.id}: ${nextTask.title}`);

			// Step 1: Set task status to in-progress
			const statusResult = await this.updateTaskStatus(nextTask.id, 'in-progress');
			
			if (!statusResult.success) {
				throw new Error(`Failed to update task status: ${statusResult.error}`);
			}

			// Step 2: Create or get worktree for the task
			const worktreeResult = await this.prepareWorktreeForTask(nextTask, options);
			
			if (!worktreeResult.success) {
				// Rollback status change
				await this.updateTaskStatus(nextTask.id, 'pending');
				throw new Error(`Failed to prepare worktree: ${worktreeResult.error}`);
			}

			// Step 3: Setup task context (optional)
			const contextResult = await this.setupTaskContext(nextTask, worktreeResult.worktree, options);
			
			if (!contextResult.success) {
				console.warn('⚠️ [NextTaskService] Task context setup had issues:', contextResult.error);
				// Don't fail, just warn
			}

			console.log(`✅ [NextTaskService] Successfully started task ${nextTask.id}`);
			
			return {
				success: true,
				task: nextTask,
				worktree: worktreeResult.worktree,
				statusUpdated: statusResult.success,
				contextSetup: contextResult.success,
				message: `Task ${nextTask.id} is ready for implementation`
			};

		} catch (error) {
			console.error(`❌ [NextTaskService] Failed to start task ${nextTask.id}:`, error.message);
			return {
				success: false,
				error: error.message,
				task: nextTask
			};
		}
	}

	/**
	 * Execute the complete next task progression workflow
	 * @param {Object} currentContext - Current workflow context (worktree, task, etc.)
	 * @param {Object} options - Options for progression
	 * @returns {Promise<Object>} Complete progression result
	 */
	async executeNextTaskProgression(currentContext = {}, options = {}) {
		const progressionResult = {
			success: false,
			phase: 'initialization',
			results: {}
		};

		try {
			// Phase 1: Check if auto-progression is enabled
			progressionResult.phase = 'configuration-check';
			
			if (!this.config.autoProgressToNext && !options.forceProgression) {
				console.log('⏭️ [NextTaskService] Auto-progression disabled, skipping next task');
				return {
					success: true,
					skipped: true,
					reason: 'Auto-progression disabled',
					message: 'Ready for manual task selection'
				};
			}

			// Phase 2: Apply delay before progression (if configured)
			progressionResult.phase = 'delay';
			
			if (this.config.progressDelay > 0 && !options.skipDelay) {
				console.log(`⏱️ [NextTaskService] Waiting ${this.config.progressDelay}ms before next task...`);
				await this.delay(this.config.progressDelay);
			}

			// Phase 3: Get next task
			progressionResult.phase = 'get-next-task';
			progressionResult.results.nextTask = await this.getNextTask();
			
			if (!progressionResult.results.nextTask.success) {
				throw new Error(`Failed to get next task: ${progressionResult.results.nextTask.error}`);
			}

			if (!progressionResult.results.nextTask.hasNextTask) {
				console.log('🎉 [NextTaskService] No more tasks available - project complete!');
				return {
					success: true,
					completed: true,
					message: 'All tasks completed! 🎉',
					suggestions: progressionResult.results.nextTask.suggestions
				};
			}

			const nextTask = progressionResult.results.nextTask.task;

			// Phase 4: Validate readiness for next task
			progressionResult.phase = 'validation';
			progressionResult.results.validation = await this.validateReadyForNextTask(
				currentContext.worktree, 
				nextTask
			);

			if (!progressionResult.results.validation.success) {
				console.warn('⚠️ [NextTaskService] Validation issues detected:', 
					progressionResult.results.validation.errors);
				
				// If there are critical errors, don't proceed
				if (progressionResult.results.validation.errors.length > 0) {
					return {
						success: false,
						error: 'Validation failed',
						validationResult: progressionResult.results.validation,
						nextTask: nextTask,
						requiresManualIntervention: true
					};
				}
			}

			// Phase 5: Start the next task
			progressionResult.phase = 'start-task';
			progressionResult.results.startTask = await this.startNextTask(nextTask, options);

			if (!progressionResult.results.startTask.success) {
				throw new Error(`Failed to start next task: ${progressionResult.results.startTask.error}`);
			}

			// Phase 6: Success!
			progressionResult.phase = 'completed';
			progressionResult.success = true;

			console.log(`🎯 [NextTaskService] Successfully progressed to task ${nextTask.id}`);

			return {
				success: true,
				nextTask: nextTask,
				worktree: progressionResult.results.startTask.worktree,
				validationResult: progressionResult.results.validation,
				message: `Now working on: ${nextTask.id} - ${nextTask.title}`,
				telemetryData: progressionResult.results.nextTask.telemetryData
			};

		} catch (error) {
			console.error(`❌ [NextTaskService] Progression failed at ${progressionResult.phase}:`, error.message);
			
			// Attempt retry if configured
			if (this.retryCount < this.config.maxRetries && options.enableRetries !== false) {
				this.retryCount++;
				console.log(`🔄 [NextTaskService] Retrying progression (attempt ${this.retryCount}/${this.config.maxRetries})...`);
				
				await this.delay(this.config.retryDelay);
				return await this.executeNextTaskProgression(currentContext, { ...options, enableRetries: false });
			}

			return {
				success: false,
				error: error.message,
				phase: progressionResult.phase,
				results: progressionResult.results,
				retryCount: this.retryCount
			};
		}
	}

	// === HELPER METHODS ===

	/**
	 * Validate task dependencies are satisfied
	 */
	async validateTaskDependencies(task) {
		try {
			if (!task.dependencies || task.dependencies.length === 0) {
				return { success: true, message: 'No dependencies to check' };
			}

			// Check if all dependency tasks are completed
			for (const depId of task.dependencies) {
				const depTask = await this.backend.getTask(depId);
				
				if (!depTask || depTask.status !== 'done') {
					return { 
						success: false, 
						error: `Dependency task ${depId} is not completed (status: ${depTask?.status || 'not found'})` 
					};
				}
			}

			return { success: true, message: 'All dependencies satisfied' };

		} catch (error) {
			return { success: false, error: error.message };
		}
	}

	/**
	 * Validate worktree state is clean
	 */
	async validateWorktreeState(worktree) {
		try {
			if (!this.backend.getWorktreeGitStatus) {
				return { success: true, warning: 'Cannot check worktree status - method not available' };
			}

			const status = await this.backend.getWorktreeGitStatus(worktree.path);
			
			if (status.hasUncommittedChanges) {
				return { 
					success: false, 
					warning: 'Worktree has uncommitted changes',
					details: status
				};
			}

			return { success: true, message: 'Worktree is clean' };

		} catch (error) {
			return { success: false, error: error.message };
		}
	}

	/**
	 * Validate task is ready for implementation
	 */
	async validateTaskReadiness(task) {
		try {
			// Check if task has sufficient detail for implementation
			const hasTitle = task.title && task.title.trim().length > 0;
			const hasDescription = task.description && task.description.trim().length > 0;
			const hasDetails = task.details && task.details.trim().length > 0;

			if (!hasTitle) {
				return { success: false, error: 'Task missing title' };
			}

			if (!hasDescription && !hasDetails) {
				return { 
					success: false, 
					warning: 'Task may need more detail for implementation' 
				};
			}

			// Check for subtasks - if they exist, validate they're properly structured
			if (task.subtasks && task.subtasks.length > 0) {
				const pendingSubtasks = task.subtasks.filter(st => st.status === 'pending').length;
				const totalSubtasks = task.subtasks.length;

				if (pendingSubtasks === 0) {
					return { 
						success: false, 
						error: 'Task has subtasks but none are pending' 
					};
				}

				return { 
					success: true, 
					message: `Task ready with ${pendingSubtasks}/${totalSubtasks} pending subtasks` 
				};
			}

			return { success: true, message: 'Task ready for implementation' };

		} catch (error) {
			return { success: false, error: error.message };
		}
	}

	/**
	 * Validate backend connectivity
	 */
	async validateBackendConnectivity() {
		try {
			if (!this.backend) {
				return { success: false, error: 'No backend available' };
			}

			// Test with a simple operation
			if (this.backend.listTasks) {
				await this.backend.listTasks({ status: 'pending' });
			}

			return { success: true, message: 'Backend connectivity OK' };

		} catch (error) {
			return { success: false, error: `Backend connectivity issue: ${error.message}` };
		}
	}

	/**
	 * Update task status via backend
	 */
	async updateTaskStatus(taskId, status) {
		try {
			if (!this.backend.setTaskStatus) {
				throw new Error('Backend does not support setTaskStatus');
			}

			const result = await this.backend.setTaskStatus(taskId, status);
			
			if (result && !result.success) {
				throw new Error(result.error || 'Failed to update task status');
			}

			return { success: true, taskId, status };

		} catch (error) {
			return { success: false, error: error.message };
		}
	}

	/**
	 * Prepare worktree for the next task
	 */
	async prepareWorktreeForTask(task, options = {}) {
		try {
			// If backend has worktree management, use it
			if (this.backend.getOrCreateWorktreeForTask) {
				const worktree = await this.backend.getOrCreateWorktreeForTask(task.id, options);
				return { success: true, worktree };
			}

			// Otherwise, assume current worktree is fine
			return { 
				success: true, 
				worktree: options.currentWorktree || { path: process.cwd(), name: 'main' },
				warning: 'Using current directory as worktree'
			};

		} catch (error) {
			return { success: false, error: error.message };
		}
	}

	/**
	 * Setup context for task implementation
	 */
	async setupTaskContext(task, worktree, options = {}) {
		try {
			// This could expand to include:
			// - Setting up development environment
			// - Preparing necessary files
			// - Running setup scripts
			// - Configuring IDE/editor context

			return { 
				success: true, 
				message: 'Task context ready',
				task, 
				worktree 
			};

		} catch (error) {
			return { success: false, error: error.message };
		}
	}

	/**
	 * Simple delay utility
	 */
	async delay(ms) {
		return new Promise(resolve => setTimeout(resolve, ms));
	}

	/**
	 * Reset retry counter
	 */
	resetRetryCount() {
		this.retryCount = 0;
	}

	/**
	 * Update configuration
	 */
	updateConfig(newConfig) {
		this.config = { ...this.config, ...newConfig };
	}

	/**
	 * Get current configuration
	 */
	getConfig() {
		return { ...this.config };
	}
}

// Export singleton instance factory
let nextTaskServiceInstance = null;

/**
 * Initialize the NextTaskService singleton
 */
export function initializeNextTaskService(backend, config = {}) {
	nextTaskServiceInstance = new NextTaskService(backend, config);
	return nextTaskServiceInstance;
}

/**
 * Get the NextTaskService singleton instance
 */
export function getNextTaskService() {
	return nextTaskServiceInstance;
}

/**
 * Check if NextTaskService is initialized
 */
export function isNextTaskServiceInitialized() {
	return nextTaskServiceInstance !== null;
} 