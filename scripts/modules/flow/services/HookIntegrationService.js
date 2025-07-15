import { getHookManager, HOOK_EVENTS } from '../shared/hooks/index.js';

/**
 * Hook Integration Service - Clean interface between Flow components and hooks
 */
export class HookIntegrationService {
	constructor(backend) {
		this.backend = backend;
		this.hookManager = null;
		this.activeOperations = new Map();
		this.initialized = false;
	}

	/**
	 * Initialize the service
	 */
	async initialize() {
		if (this.initialized) return;

		try {
			this.hookManager = getHookManager(this.backend);
			await this.hookManager.initialize();
			this.initialized = true;
			console.log('🔗 Hook Integration Service initialized');
		} catch (error) {
			console.error('Failed to initialize Hook Integration Service:', error);
			// Don't throw - continue without hooks if they fail
		}
	}

	/**
	 * Check if research is needed for a task
	 */
	async checkResearchNeeded(task) {
		if (!this.initialized || !this.hookManager) {
			return null;
		}

		try {
			const operationId = this.generateOperationId();
			this.activeOperations.set(operationId, {
				type: 'research-check',
				task: task.id,
				startTime: Date.now()
			});

			const context = {
				task,
				operationId,
				type: 'research-check',
				action: 'check-needed',
				backend: this.backend,
				config: {
					autoDetectExisting: true,
					confidenceThreshold: 0.4,
					maxSuggestedQueries: 3
				}
			};

			const result = await this.hookManager.executeHooks(
				HOOK_EVENTS.PRE_RESEARCH,
				context
			);

			// Extract research status from hook results
			let researchStatus = null;
			for (const hookResult of result.results) {
				if (hookResult.success && hookResult.result?.researchStatus) {
					researchStatus = hookResult.result.researchStatus;
					break;
				}
			}

			this.activeOperations.delete(operationId);

			return {
				success: result.success,
				researchStatus,
				hookResults: result.results
			};
		} catch (error) {
			console.error('Error checking research needs:', error);
			return {
				success: false,
				error: error.message,
				researchStatus: {
					needed: false,
					reason: 'error',
					error: error.message,
					confidence: 0
				}
			};
		}
	}

	/**
	 * Validate pre-launch configuration
	 */
	async validatePreLaunch(config, task, worktree) {
		if (!this.initialized || !this.hookManager) {
			return { success: true, validation: { passed: true } };
		}

		try {
			const operationId = this.generateOperationId();
			this.activeOperations.set(operationId, {
				type: 'pre-launch-validation',
				task: task.id,
				startTime: Date.now()
			});

			const context = {
				config: {
					...config,
					checkGitStatus: true,
					validateDependencies: true,
					checkConflicts: true
				},
				task,
				worktree,
				operationId,
				type: 'pre-launch-validation'
			};

			const result = await this.hookManager.executeHooks(
				HOOK_EVENTS.PRE_LAUNCH,
				context
			);

			// Extract validation results
			const validation = { passed: true, warnings: [], errors: [] };
			for (const hookResult of result.results) {
				if (hookResult.success && hookResult.result?.validation) {
					const hookValidation = hookResult.result.validation;
					if (!hookValidation.passed) {
						validation.passed = false;
					}
					validation.warnings.push(...(hookValidation.warnings || []));
					validation.errors.push(...(hookValidation.errors || []));
				}
			}

			this.activeOperations.delete(operationId);

			return {
				success: result.success,
				validation,
				hookResults: result.results
			};
		} catch (error) {
			console.error('Error validating pre-launch:', error);
			return {
				success: false,
				error: error.message,
				validation: {
					passed: false,
					errors: [`Validation failed: ${error.message}`],
					warnings: []
				}
			};
		}
	}

	/**
	 * Notify hooks about worktree creation
	 */
	async notifyWorktreeCreated(worktree, task, config) {
		if (!this.initialized || !this.hookManager) {
			return { success: true };
		}

		try {
			const operationId = this.generateOperationId();
			this.activeOperations.set(operationId, {
				type: 'worktree-created',
				task: task.id,
				startTime: Date.now()
			});

			const context = {
				worktree,
				task,
				config,
				operationId,
				type: 'worktree-created'
			};

			const result = await this.hookManager.executeHooks(
				HOOK_EVENTS.POST_WORKTREE,
				context
			);
			this.activeOperations.delete(operationId);

			return {
				success: result.success,
				hookResults: result.results
			};
		} catch (error) {
			console.error('Error notifying worktree creation:', error);
			return {
				success: false,
				error: error.message
			};
		}
	}

	/**
	 * Notify hooks about research completion
	 */
	async notifyResearchCompleted(task, researchResults) {
		if (!this.initialized || !this.hookManager) {
			return { success: true };
		}

		try {
			const operationId = this.generateOperationId();
			this.activeOperations.set(operationId, {
				type: 'research-completed',
				task: task.id,
				startTime: Date.now()
			});

			const context = {
				task,
				researchResults,
				operationId,
				type: 'research-completed'
			};

			const result = await this.hookManager.executeHooks(
				HOOK_EVENTS.POST_RESEARCH,
				context
			);
			this.activeOperations.delete(operationId);

			return {
				success: result.success,
				hookResults: result.results
			};
		} catch (error) {
			console.error('Error notifying research completion:', error);
			return {
				success: false,
				error: error.message
			};
		}
	}

	/**
	 * Notify hooks about CLAUDE.md preparation
	 */
	async notifyClaudeMdPrepared(worktree, task, claudeMdPath) {
		if (!this.initialized || !this.hookManager) {
			return { success: true };
		}

		try {
			const operationId = this.generateOperationId();
			this.activeOperations.set(operationId, {
				type: 'claude-md-prepared',
				task: task.id,
				startTime: Date.now()
			});

			const context = {
				worktree,
				task,
				claudeMdPath,
				operationId,
				type: 'claude-md-prepared'
			};

			const result = await this.hookManager.executeHooks(
				HOOK_EVENTS.POST_CLAUDE_MD,
				context
			);
			this.activeOperations.delete(operationId);

			return {
				success: result.success,
				hookResults: result.results
			};
		} catch (error) {
			console.error('Error notifying CLAUDE.md preparation:', error);
			return {
				success: false,
				error: error.message
			};
		}
	}

	/**
	 * Notify hooks about session start
	 */
	async notifySessionStarted(session, config, task, worktree) {
		if (!this.initialized || !this.hookManager) {
			return { success: true };
		}

		try {
			const operationId = this.generateOperationId();
			this.activeOperations.set(operationId, {
				type: 'session-started',
				task: task.id,
				startTime: Date.now()
			});

			const context = {
				session,
				config,
				task,
				worktree,
				operationId,
				type: 'session-started'
			};

			const result = await this.hookManager.executeHooks(
				HOOK_EVENTS.SESSION_STARTED,
				context
			);
			this.activeOperations.delete(operationId);

			return {
				success: result.success,
				hookResults: result.results
			};
		} catch (error) {
			console.error('Error notifying session start:', error);
			return {
				success: false,
				error: error.message
			};
		}
	}

	/**
	 * Notify hooks about session completion
	 */
	async notifySessionCompleted(session, task, worktree, config = {}) {
		if (!this.initialized || !this.hookManager) {
			return { success: true };
		}

		try {
			const operationId = this.generateOperationId();
			this.activeOperations.set(operationId, {
				type: 'session-completed',
				task: task.id,
				startTime: Date.now()
			});

			const context = {
				session,
				task,
				worktree,
				services: config.services || { backend: this.backend },
				config: {
					collectStatistics: true,
					autoUpdateTaskStatus: true,
					generateSummary: true,
					autoCreatePR: config.autoCreatePR || false,
					globalPRSetting: config.globalPRSetting || false,
					...config
				},
				operationId,
				type: 'session-completed'
			};

			const result = await this.hookManager.executeHooks(
				HOOK_EVENTS.SESSION_COMPLETED,
				context
			);
			this.activeOperations.delete(operationId);

			return {
				success: result.success,
				hookResults: result.results
			};
		} catch (error) {
			console.error('Error notifying session completion:', error);
			return {
				success: false,
				error: error.message
			};
		}
	}

	/**
	 * Notify hooks about session failure
	 */
	async notifySessionFailed(session, error, task, worktree) {
		if (!this.initialized || !this.hookManager) {
			return { success: true };
		}

		try {
			const operationId = this.generateOperationId();
			this.activeOperations.set(operationId, {
				type: 'session-failed',
				task: task.id,
				startTime: Date.now()
			});

			const context = {
				session,
				error,
				task,
				worktree,
				operationId,
				type: 'session-failed'
			};

			const result = await this.hookManager.executeHooks(
				HOOK_EVENTS.SESSION_FAILED,
				context
			);
			this.activeOperations.delete(operationId);

			return {
				success: result.success,
				hookResults: result.results
			};
		} catch (hookError) {
			console.error('Error notifying session failure:', hookError);
			return {
				success: false,
				error: hookError.message
			};
		}
	}

	/**
	 * Validate PR creation
	 */
	async validatePRCreation(session, task, worktree, config) {
		if (!this.initialized || !this.hookManager) {
			return { success: true, canProceed: true };
		}

		try {
			const operationId = this.generateOperationId();
			this.activeOperations.set(operationId, {
				type: 'pr-validation',
				task: task.id,
				startTime: Date.now()
			});

			const context = {
				session,
				task,
				worktree,
				config,
				operationId,
				type: 'pr-validation'
			};

			const result = await this.hookManager.executeHooks(
				HOOK_EVENTS.PRE_PR,
				context
			);

			// Extract validation results
			let canProceed = true;
			const validation = { warnings: [], errors: [] };

			for (const hookResult of result.results) {
				if (hookResult.success && hookResult.result?.validation) {
					const hookValidation = hookResult.result.validation;
					if (!hookValidation.canCreatePR) {
						canProceed = false;
					}
					validation.warnings.push(...(hookValidation.warnings || []));
					validation.errors.push(...(hookValidation.errors || []));
				}
			}

			this.activeOperations.delete(operationId);

			return {
				success: result.success,
				canProceed,
				validation,
				hookResults: result.results
			};
		} catch (error) {
			console.error('Error validating PR creation:', error);
			return {
				success: false,
				error: error.message,
				canProceed: false
			};
		}
	}

	/**
	 * Notify hooks about PR creation
	 */
	async notifyPRCreated(prResult, session, task, worktree) {
		if (!this.initialized || !this.hookManager) {
			return { success: true };
		}

		try {
			const operationId = this.generateOperationId();
			this.activeOperations.set(operationId, {
				type: 'pr-created',
				task: task.id,
				startTime: Date.now()
			});

			const context = {
				prResult,
				session,
				task,
				worktree,
				operationId,
				type: 'pr-created'
			};

			const result = await this.hookManager.executeHooks(
				HOOK_EVENTS.PR_CREATED,
				context
			);
			this.activeOperations.delete(operationId);

			return {
				success: result.success,
				hookResults: result.results
			};
		} catch (error) {
			console.error('Error notifying PR creation:', error);
			return {
				success: false,
				error: error.message
			};
		}
	}

	/**
	 * Get hook system status
	 */
	getHookStatus() {
		if (!this.initialized || !this.hookManager) {
			return {
				initialized: false,
				available: false,
				error: 'Hook system not initialized'
			};
		}

		return {
			initialized: true,
			available: true,
			...this.hookManager.getHookStatus(),
			activeOperations: this.activeOperations.size
		};
	}

	/**
	 * Get active operations
	 */
	getActiveOperations() {
		const operations = [];
		for (const [id, operation] of this.activeOperations) {
			operations.push({
				id,
				...operation,
				duration: Date.now() - operation.startTime
			});
		}
		return operations;
	}

	/**
	 * Enable/disable a specific hook
	 */
	async setHookEnabled(hookName, enabled) {
		if (!this.initialized || !this.hookManager) {
			throw new Error('Hook system not initialized');
		}

		return await this.hookManager.setHookEnabled(hookName, enabled);
	}

	/**
	 * Get hook execution history
	 */
	async getHookHistory(hookName, event = null) {
		if (!this.initialized || !this.hookManager) {
			return [];
		}

		return await this.hookManager.getHookHistory(hookName, event);
	}

	/**
	 * Clear hook storage
	 */
	async clearHookStorage() {
		if (!this.initialized || !this.hookManager) {
			return false;
		}

		return await this.hookManager.clearHookStorage();
	}

	/**
	 * Get available hook events
	 */
	getAvailableEvents() {
		return Object.values(HOOK_EVENTS);
	}

	/**
	 * Generate unique operation ID
	 */
	generateOperationId() {
		return `hook-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
	}

	/**
	 * Cleanup service
	 */
	async cleanup() {
		if (this.hookManager) {
			await this.hookManager.cleanup();
		}

		this.activeOperations.clear();
		this.initialized = false;

		console.log('🔗 Hook Integration Service cleaned up');
	}
}

// Export singleton instance
let hookIntegrationInstance = null;

/**
 * Initialize the hook integration singleton with a backend
 */
export async function initializeHookIntegration(backend) {
	if (!hookIntegrationInstance) {
		hookIntegrationInstance = new HookIntegrationService(backend);
		await hookIntegrationInstance.initialize();
	}
	return hookIntegrationInstance;
}

/**
 * Get the hook integration singleton instance
 */
export function getHookIntegration() {
	return hookIntegrationInstance;
}

// Legacy export for backward compatibility
export const hookIntegration = {
	get initialized() {
		return hookIntegrationInstance?.initialized || false;
	},
	async notifySessionCompleted(...args) {
		if (hookIntegrationInstance) {
			return await hookIntegrationInstance.notifySessionCompleted(...args);
		}
		return { success: true };
	},
	async notifySessionFailed(...args) {
		if (hookIntegrationInstance) {
			return await hookIntegrationInstance.notifySessionFailed(...args);
		}
		return { success: true };
	}
};
