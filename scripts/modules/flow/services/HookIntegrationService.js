import { hookManager, HOOK_EVENTS } from '../hooks/index.js';

/**
 * Hook Integration Service - provides clean interface between Flow components and hooks
 */
export class HookIntegrationService {
	constructor(backend) {
		this.backend = backend;
		this.initialized = false;
		this.activeOperations = new Map();
	}

	/**
	 * Initialize the integration service
	 */
	async initialize() {
		if (this.initialized) return;

		try {
			// Initialize hook manager with project context
			await hookManager.initialize();
			this.initialized = true;
			console.log('🔗 Hook integration service initialized');
		} catch (error) {
			console.error('❌ Failed to initialize hook integration service:', error);
			// Don't throw - allow Flow to continue without hooks
			this.initialized = false;
		}
	}

	/**
	 * Execute hooks for a specific event with error handling
	 */
	async executeHooks(event, context = {}) {
		if (!this.initialized) {
			// Try to initialize if not already done
			await this.initialize();
			if (!this.initialized) {
				// If still not initialized, skip hooks silently
				return { executed: [], skipped: 'initialization-failed' };
			}
		}

		try {
			// Add backend service to context
			const enrichedContext = {
				...context,
				backend: this.backend,
				timestamp: new Date().toISOString()
			};

			const result = await hookManager.executeHooks(event, enrichedContext);
			
			// Log hook execution for debugging
			if (result.executed.length > 0) {
				console.log(`🪝 Executed ${result.executed.length} hooks for ${event}`);
			}

			return result;
		} catch (error) {
			console.error(`❌ Hook execution failed for event ${event}:`, error);
			// Return safe result even on error
			return {
				executed: [],
				skipped: 'execution-failed',
				error: error.message
			};
		}
	}

	/**
	 * Pre-launch validation hooks
	 */
	async validatePreLaunch(config, task, worktree = null) {
		return this.executeHooks(HOOK_EVENTS.PRE_LAUNCH, {
			config,
			task,
			worktree
		});
	}

	/**
	 * Post-worktree creation hooks
	 */
	async notifyWorktreeCreated(worktree, task, config) {
		return this.executeHooks(HOOK_EVENTS.POST_WORKTREE, {
			worktree,
			task,
			config
		});
	}

	/**
	 * Research-related hooks
	 */
	async checkResearchNeeded(task) {
		const result = await this.executeHooks(HOOK_EVENTS.PRE_RESEARCH, {
			task,
			action: 'check-needed'
		});

		// Extract research recommendations from hook results
		const researchRecommendations = result.results
			.filter(r => r.result && r.result.researchStatus)
			.map(r => r.result.researchStatus);

		if (researchRecommendations.length > 0) {
			return researchRecommendations[0]; // Use first recommendation
		}

		return null;
	}

	async notifyResearchCompleted(task, researchResults) {
		return this.executeHooks(HOOK_EVENTS.POST_RESEARCH, {
			task,
			researchResults
		});
	}

	/**
	 * Claude.md preparation hooks
	 */
	async notifyClaudeMdPrepared(worktree, task, claudeMdPath) {
		return this.executeHooks(HOOK_EVENTS.POST_CLAUDE_MD, {
			worktree,
			task,
			claudeMdPath
		});
	}

	/**
	 * Session lifecycle hooks
	 */
	async notifySessionStarted(session, config, task, worktree) {
		// Store operation for tracking
		this.activeOperations.set(session.sessionId || session.operationId, {
			session,
			config,
			task,
			worktree,
			startTime: new Date().toISOString()
		});

		return this.executeHooks(HOOK_EVENTS.SESSION_STARTED, {
			session,
			config,
			task,
			worktree
		});
	}

	async notifySessionMessage(sessionId, message, context = {}) {
		const operation = this.activeOperations.get(sessionId);
		if (operation) {
			return this.executeHooks(HOOK_EVENTS.SESSION_MESSAGE, {
				sessionId,
				message,
				...operation,
				...context
			});
		}

		// If no stored operation, still try to execute hooks with available context
		return this.executeHooks(HOOK_EVENTS.SESSION_MESSAGE, {
			sessionId,
			message,
			...context
		});
	}

	async notifySessionCompleted(sessionId, result, context = {}) {
		const operation = this.activeOperations.get(sessionId);
		
		const hookResult = await this.executeHooks(HOOK_EVENTS.SESSION_COMPLETED, {
			sessionId,
			result,
			...operation,
			...context
		});

		// Clean up stored operation
		this.activeOperations.delete(sessionId);

		return hookResult;
	}

	async notifySessionFailed(sessionId, error, context = {}) {
		const operation = this.activeOperations.get(sessionId);
		
		const hookResult = await this.executeHooks(HOOK_EVENTS.SESSION_FAILED, {
			sessionId,
			error,
			...operation,
			...context
		});

		// Clean up stored operation
		this.activeOperations.delete(sessionId);

		return hookResult;
	}

	/**
	 * PR creation hooks
	 */
	async notifyPRCreated(sessionId, prInfo, context = {}) {
		return this.executeHooks(HOOK_EVENTS.PR_CREATED, {
			sessionId,
			prInfo,
			...context
		});
	}

	/**
	 * Get hook system status
	 */
	getHookStatus() {
		if (!this.initialized) {
			return {
				initialized: false,
				error: 'Hook system not initialized'
			};
		}

		return {
			initialized: true,
			...hookManager.getHookStatus(),
			activeOperations: this.activeOperations.size
		};
	}

	/**
	 * Enable/disable specific hooks
	 */
	async setHookEnabled(hookName, enabled) {
		if (!this.initialized) {
			await this.initialize();
		}

		if (this.initialized) {
			return hookManager.setHookEnabled(hookName, enabled);
		}

		throw new Error('Hook system not available');
	}

	/**
	 * Enable/disable the entire hook system
	 */
	async setSystemEnabled(enabled) {
		if (!this.initialized) {
			await this.initialize();
		}

		if (this.initialized) {
			return hookManager.setSystemEnabled(enabled);
		}

		throw new Error('Hook system not available');
	}

	/**
	 * Get active operations
	 */
	getActiveOperations() {
		return Array.from(this.activeOperations.entries()).map(([id, operation]) => ({
			id,
			...operation
		}));
	}

	/**
	 * Clear completed operations (cleanup)
	 */
	clearCompletedOperations() {
		// This is called by session completed/failed hooks
		// Operations are automatically cleaned up, but this can be called manually
		const beforeCount = this.activeOperations.size;
		
		// Could implement logic to remove old operations based on timestamp
		// For now, operations are cleaned up when sessions complete/fail
		
		return {
			before: beforeCount,
			after: this.activeOperations.size
		};
	}

	/**
	 * Shutdown the service
	 */
	async shutdown() {
		this.activeOperations.clear();
		this.initialized = false;
		console.log('🔗 Hook integration service shut down');
	}
}

// Export singleton instance
export const hookIntegration = new HookIntegrationService(); 