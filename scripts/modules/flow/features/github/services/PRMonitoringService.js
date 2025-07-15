/**
 * PR Monitoring Service - Real-time PR status monitoring with intelligent retry logic
 * Phase 3 Enhancement: Comprehensive task status updates and worktree cleanup
 */
import { EventEmitter } from 'events';
import {
	getNextTaskService,
	isNextTaskServiceInitialized
} from '../../tasks/services/NextTaskService.js';

export class PRMonitoringService extends EventEmitter {
	constructor(backend, options = {}) {
		super();
		this.backend = backend;
		this.checkInterval = options.checkInterval || 30000; // 30 seconds
		this.maxRetries = options.maxRetries || 3;
		this.timeoutMs = options.timeoutMs || 300000; // 5 minutes

		// Monitoring state
		this.monitoredPRs = new Map();
		this.intervalId = null;
		this.retryAttempts = new Map();
		this.lastStatusCache = new Map();

		// Performance tracking
		this.stats = {
			checksPerformed: 0,
			statusChangesDetected: 0,
			retriesExecuted: 0,
			errorsEncountered: 0
		};
	}

	/**
	 * Initialize the monitoring service
	 */
	async initialize() {
		if (this.intervalId) {
			clearInterval(this.intervalId);
		}

		// Start monitoring loop
		this.intervalId = setInterval(() => {
			this.performMonitoringCheck();
		}, this.checkInterval);

		console.log(
			`🔍 PR Monitoring Service initialized (check interval: ${this.checkInterval}ms)`
		);
		return { success: true };
	}

	/**
	 * Start monitoring a specific PR
	 */
	async startMonitoring(prNumber, config = {}) {
		const monitoringConfig = {
			prNumber,
			startTime: Date.now(),
			config: {
				autoMerge: config.autoMerge || false,
				requiredChecks: config.requiredChecks || [],
				cleanupAfterMerge: config.cleanupAfterMerge !== false,
				notifyOnStatusChange: config.notifyOnStatusChange !== false,
				taskId: config.taskId,
				worktreeName: config.worktreeName,
				...config
			},
			status: 'monitoring',
			lastCheck: null,
			checkCount: 0
		};

		this.monitoredPRs.set(prNumber, monitoringConfig);
		this.retryAttempts.set(prNumber, 0);

		// Perform initial check
		await this.checkPRStatus(prNumber);

		console.log(
			`🔍 Started monitoring PR ${prNumber} (auto-merge: ${monitoringConfig.config.autoMerge})`
		);
		return monitoringConfig;
	}

	/**
	 * Stop monitoring a specific PR
	 */
	async stopMonitoring(prNumber, reason = 'manual') {
		const config = this.monitoredPRs.get(prNumber);
		if (!config) {
			return { success: false, error: 'PR not being monitored' };
		}

		this.monitoredPRs.delete(prNumber);
		this.retryAttempts.delete(prNumber);
		this.lastStatusCache.delete(prNumber);

		console.log(`🛑 Stopped monitoring PR ${prNumber} (reason: ${reason})`);
		return {
			success: true,
			monitoredFor: Date.now() - config.startTime,
			checkCount: config.checkCount
		};
	}

	/**
	 * Perform monitoring check for all PRs
	 */
	async performMonitoringCheck() {
		if (this.monitoredPRs.size === 0) {
			return;
		}

		console.log(
			`🔍 Checking status of ${this.monitoredPRs.size} monitored PRs...`
		);

		for (const [prNumber, config] of this.monitoredPRs) {
			try {
				await this.checkPRStatus(prNumber);
			} catch (error) {
				console.error(`Error checking PR ${prNumber}:`, error.message);
				this.stats.errorsEncountered++;

				// Emit monitoring error
				this.emit('monitoringFailed', {
					prNumber,
					error: error.message,
					config
				});
			}
		}
	}

	/**
	 * Check status of a specific PR
	 */
	async checkPRStatus(prNumber) {
		const config = this.monitoredPRs.get(prNumber);
		if (!config) {
			return;
		}

		this.stats.checksPerformed++;
		config.checkCount++;
		config.lastCheck = Date.now();

		try {
			// Get current PR status
			const prStatus = await this.backend.getPRStatus(prNumber);
			const lastStatus = this.lastStatusCache.get(prNumber);

			// Determine current state
			const currentState = this.determinePRState(prStatus, config);

			// Check if status changed
			if (lastStatus !== currentState) {
				this.stats.statusChangesDetected++;
				this.lastStatusCache.set(prNumber, currentState);

				console.log(
					`📊 PR ${prNumber} status changed: ${lastStatus || 'unknown'} → ${currentState}`
				);

				// Emit status change event
				this.emit('statusChanged', {
					prNumber,
					oldStatus: lastStatus,
					newStatus: currentState,
					prStatus,
					config: config.config
				});

				// Handle specific state transitions
				await this.handleStateTransition(
					prNumber,
					currentState,
					prStatus,
					config
				);
			}

			// Update monitoring config
			config.lastStatus = currentState;
			config.lastPRStatus = prStatus;
		} catch (error) {
			console.error(`Failed to check PR ${prNumber} status:`, error.message);
			this.handleMonitoringError(prNumber, error, config);
		}
	}

	/**
	 * Determine PR state from GitHub status
	 */
	determinePRState(prStatus, config) {
		// Check if PR is merged
		if (prStatus.state === 'MERGED') {
			return 'merged';
		}

		// Check if PR is closed
		if (prStatus.state === 'CLOSED') {
			return 'closed';
		}

		// Check if PR is draft
		if (prStatus.draft) {
			return 'draft';
		}

		// Check for merge conflicts
		if (prStatus.mergeable === false) {
			return 'conflicts';
		}

		// Check if all required checks are passing
		const requiredChecks = config.config.requiredChecks || [];
		if (requiredChecks.length > 0) {
			const passingChecks =
				prStatus.checks?.filter(
					(check) =>
						requiredChecks.includes(check.name) && check.status === 'success'
				) || [];

			if (passingChecks.length < requiredChecks.length) {
				return 'checks-pending';
			}
		}

		// Check if there are any failing checks
		const failingChecks =
			prStatus.checks?.filter((check) => check.status === 'failure') || [];

		if (failingChecks.length > 0) {
			return 'checks-failed';
		}

		// Check if ready to merge (all checks passing, no conflicts)
		if (
			prStatus.mergeable !== false &&
			(prStatus.checks?.every(
				(check) => check.status === 'success' || check.status === 'skipped'
			) ||
				!prStatus.checks?.length)
		) {
			return 'ready-to-merge';
		}

		// Default to pending
		return 'pending';
	}

	/**
	 * Handle state transitions
	 * Phase 3: Enhanced with task status updates and cleanup
	 */
	async handleStateTransition(prNumber, newState, prStatus, config) {
		switch (newState) {
			case 'ready-to-merge':
				this.emit('readyForAutoMerge', {
					prNumber,
					prStatus,
					config: config.config
				});
				break;

			case 'merged': {
				console.log(
					`🎉 PR ${prNumber} merged successfully! Starting cleanup and task completion...`
				);

				// Execute comprehensive merge completion workflow
				const mergeResult = await this.handlePRMergeComplete(
					prNumber,
					prStatus,
					config
				);

				this.emit('mergeComplete', {
					prNumber,
					prStatus,
					config: config.config,
					mergeResult
				});

				// Stop monitoring merged PRs
				await this.stopMonitoring(prNumber, 'merged');
				break;
			}

			case 'checks-failed':
				this.emit('checksFailed', {
					prNumber,
					prStatus,
					failedChecks:
						prStatus.checks?.filter((c) => c.status === 'failure') || [],
					config: config.config
				});
				break;

			case 'conflicts':
				this.emit('conflictsDetected', {
					prNumber,
					prStatus,
					config: config.config
				});
				break;

			case 'closed': {
				console.log(
					`🔒 PR ${prNumber} closed without merging. Handling cleanup...`
				);

				// Handle closed PR (no merge)
				const closeResult = await this.handlePRClosed(
					prNumber,
					prStatus,
					config
				);

				this.emit('prClosed', {
					prNumber,
					prStatus,
					config: config.config,
					closeResult
				});

				// Stop monitoring closed PRs
				await this.stopMonitoring(prNumber, 'closed');
				break;
			}
		}
	}

	/**
	 * Handle monitoring errors with exponential backoff
	 */
	handleMonitoringError(prNumber, error, config) {
		const currentRetries = this.retryAttempts.get(prNumber) || 0;

		if (currentRetries < this.maxRetries) {
			// Exponential backoff: 1s, 2s, 4s, 8s, etc.
			const backoffDelay = 2 ** currentRetries * 1000;

			console.log(
				`⏰ Scheduling retry ${currentRetries + 1}/${this.maxRetries} for PR ${prNumber} in ${backoffDelay}ms`
			);

			setTimeout(() => {
				this.checkPRStatus(prNumber);
			}, backoffDelay);

			this.retryAttempts.set(prNumber, currentRetries + 1);
			this.stats.retriesExecuted++;
		} else {
			console.error(
				`❌ Max retries exceeded for PR ${prNumber}, stopping monitoring`
			);
			this.stopMonitoring(prNumber, 'max-retries-exceeded');
		}
	}

	/**
	 * Schedule a retry for a failed merge
	 */
	async scheduleRetry(prNumber, retryInfo) {
		const config = this.monitoredPRs.get(prNumber);
		if (!config) {
			return { success: false, error: 'PR not being monitored' };
		}

		// Store retry information
		config.pendingRetry = retryInfo;

		// Schedule the retry
		setTimeout(() => {
			this.emit('retryMerge', {
				prNumber,
				retryInfo,
				config: config.config
			});
		}, retryInfo.retryDelay || 60000);

		return { success: true, retryInfo };
	}

	/**
	 * Resume monitoring for a specific PR
	 */
	async resumeMonitoring(prNumber) {
		const config = this.monitoredPRs.get(prNumber);
		if (!config) {
			return { success: false, error: 'PR not being monitored' };
		}

		// Reset retry attempts
		this.retryAttempts.set(prNumber, 0);

		// Perform immediate check
		await this.checkPRStatus(prNumber);

		console.log(`🔄 Resumed monitoring for PR ${prNumber}`);
		return { success: true };
	}

	/**
	 * Get monitoring statistics
	 */
	getStats() {
		return {
			...this.stats,
			activePRs: this.monitoredPRs.size,
			uptime: this.intervalId ? Date.now() - (this.startTime || Date.now()) : 0
		};
	}

	/**
	 * Phase 3: Handle complete PR merge workflow
	 * - Update task status to 'done'
	 * - Clean up worktrees and branches
	 * - Handle parent task completion (for subtasks)
	 * - Trigger next task progression
	 */
	async handlePRMergeComplete(prNumber, prStatus, config) {
		const results = {
			success: true,
			steps: {},
			workflowType: 'pr-merged',
			prNumber,
			prUrl: prStatus.url
		};

		try {
			// Step 1: Update task status to 'done'
			if (config.config.taskId) {
				console.log(
					`📝 Updating task ${config.config.taskId} status to 'done'...`
				);
				try {
					const statusResult = await this.backend.setTaskStatus({
						id: config.config.taskId,
						status: 'done'
					});

					results.steps.taskStatus = {
						success: statusResult?.success || true,
						taskId: config.config.taskId,
						previousStatus: 'in-progress',
						newStatus: 'done'
					};

					console.log(`  ✅ Task ${config.config.taskId} marked as done`);
				} catch (error) {
					console.error(`  ❌ Failed to update task status: ${error.message}`);
					results.steps.taskStatus = {
						success: false,
						error: error.message,
						taskId: config.config.taskId
					};
				}
			}

			// Step 2: Clean up worktree and branch
			if (
				config.config.worktreeName &&
				config.config.cleanupAfterMerge !== false
			) {
				console.log(
					`🧹 Cleaning up worktree: ${config.config.worktreeName}...`
				);
				try {
					const cleanupResult = await this.cleanupWorktreeAfterMerge(
						config.config.worktreeName,
						prStatus,
						config.config
					);

					results.steps.cleanup = cleanupResult;
					console.log(`  ✅ Worktree cleanup completed`);
				} catch (error) {
					console.error(`  ❌ Worktree cleanup failed: ${error.message}`);
					results.steps.cleanup = {
						success: false,
						error: error.message,
						worktreeName: config.config.worktreeName
					};
				}
			}

			// Step 3: Handle parent task completion (for subtasks)
			if (config.config.taskId && String(config.config.taskId).includes('.')) {
				console.log(
					`👨‍👩‍👧‍👦 Checking parent task completion for subtask ${config.config.taskId}...`
				);
				try {
					const parentResult = await this.checkAndUpdateParentTaskCompletion(
						config.config.taskId
					);
					results.steps.parentTaskCheck = parentResult;

					if (parentResult.parentCompleted) {
						console.log(
							`  ✅ Parent task ${parentResult.parentTaskId} marked as done`
						);
					}
				} catch (error) {
					console.error(`  ❌ Parent task check failed: ${error.message}`);
					results.steps.parentTaskCheck = {
						success: false,
						error: error.message
					};
				}
			}

			// Step 4: Trigger next task progression (if enabled)
			if (
				isNextTaskServiceInitialized() &&
				config.config.autoProgressToNext !== false
			) {
				console.log(`🎯 Triggering next task progression...`);
				try {
					const nextTaskService = getNextTaskService();
					const nextResult = await nextTaskService.progressToNextTask({
						completedTaskId: config.config.taskId,
						completionType: 'pr-merged',
						context: { prNumber, prUrl: prStatus.url }
					});

					results.steps.nextTask = nextResult;

					if (nextResult.success && nextResult.nextTask) {
						console.log(`  ✅ Next task identified: ${nextResult.nextTask.id}`);
					} else {
						console.log(`  ℹ️ No next task available or progression skipped`);
					}
				} catch (error) {
					console.error(`  ❌ Next task progression failed: ${error.message}`);
					results.steps.nextTask = {
						success: false,
						error: error.message
					};
				}
			}

			console.log(
				`🎉 PR merge completion workflow finished for PR ${prNumber}`
			);
			return results;
		} catch (error) {
			console.error(`❌ PR merge completion workflow failed: ${error.message}`);
			results.success = false;
			results.error = error.message;
			return results;
		}
	}

	/**
	 * Phase 3: Handle PR closed without merge
	 * - Reset task status back to 'pending' or 'in-progress'
	 * - Preserve worktree for potential retry
	 * - Log closure reason
	 */
	async handlePRClosed(prNumber, prStatus, config) {
		const results = {
			success: true,
			steps: {},
			workflowType: 'pr-closed',
			prNumber,
			prUrl: prStatus.url
		};

		try {
			// Step 1: Reset task status
			if (config.config.taskId) {
				console.log(
					`📝 Resetting task ${config.config.taskId} status (PR closed without merge)...`
				);
				try {
					const statusResult = await this.backend.setTaskStatus({
						id: config.config.taskId,
						status: 'pending' // Reset to pending for potential retry
					});

					results.steps.taskStatus = {
						success: statusResult?.success || true,
						taskId: config.config.taskId,
						previousStatus: 'in-progress',
						newStatus: 'pending',
						reason: 'pr-closed-without-merge'
					};

					console.log(`  ✅ Task ${config.config.taskId} reset to pending`);
				} catch (error) {
					console.error(`  ❌ Failed to reset task status: ${error.message}`);
					results.steps.taskStatus = {
						success: false,
						error: error.message,
						taskId: config.config.taskId
					};
				}
			}

			// Step 2: Preserve worktree (don't clean up)
			if (config.config.worktreeName) {
				console.log(
					`📁 Preserving worktree ${config.config.worktreeName} for potential retry...`
				);
				results.steps.worktreePreserved = {
					success: true,
					worktreeName: config.config.worktreeName,
					reason: 'pr-closed-preserve-for-retry'
				};
			}

			console.log(
				`🔒 PR ${prNumber} closure handled, task available for retry`
			);
			return results;
		} catch (error) {
			console.error(`❌ PR closure handling failed: ${error.message}`);
			results.success = false;
			results.error = error.message;
			return results;
		}
	}

	/**
	 * Clean up worktree and branch after successful PR merge
	 */
	async cleanupWorktreeAfterMerge(worktreeName, prStatus, config) {
		try {
			// Use backend's worktree cleanup if available
			if (this.backend?.cleanupWorktree) {
				return await this.backend.cleanupWorktree(worktreeName, {
					reason: 'pr-merged',
					prUrl: prStatus.url,
					preserveBranch: config.preserveBranchAfterMerge || false
				});
			}

			// Fallback cleanup (basic implementation)
			console.log(
				`🧹 Performing basic worktree cleanup for ${worktreeName}...`
			);
			return {
				success: true,
				worktreeName,
				cleanupType: 'basic',
				message: 'Worktree cleanup deferred to manual process'
			};
		} catch (error) {
			return {
				success: false,
				error: error.message,
				worktreeName
			};
		}
	}

	/**
	 * Check if all subtasks of a parent task are complete, and mark parent as done if so
	 */
	async checkAndUpdateParentTaskCompletion(subtaskId) {
		try {
			const parentTaskId = String(subtaskId).split('.')[0];

			// Get parent task and all its subtasks
			const parentTask = await this.backend.getTask({ id: parentTaskId });

			if (!parentTask?.success || !parentTask.data?.subtasks?.length) {
				return {
					success: true,
					parentTaskId,
					parentCompleted: false,
					reason: 'no-subtasks-or-parent-not-found'
				};
			}

			// Check if all subtasks are done
			const subtasks = parentTask.data.subtasks;
			const completedSubtasks = subtasks.filter((st) => st.status === 'done');
			const allSubtasksComplete = completedSubtasks.length === subtasks.length;

			if (allSubtasksComplete) {
				console.log(
					`🎯 All subtasks complete for parent task ${parentTaskId}, marking as done...`
				);

				const statusResult = await this.backend.setTaskStatus({
					id: parentTaskId,
					status: 'done'
				});

				return {
					success: true,
					parentTaskId,
					parentCompleted: true,
					totalSubtasks: subtasks.length,
					completedSubtasks: completedSubtasks.length,
					statusUpdate: statusResult
				};
			} else {
				return {
					success: true,
					parentTaskId,
					parentCompleted: false,
					totalSubtasks: subtasks.length,
					completedSubtasks: completedSubtasks.length,
					reason: 'subtasks-still-pending'
				};
			}
		} catch (error) {
			return {
				success: false,
				error: error.message,
				subtaskId
			};
		}
	}

	/**
	 * Shutdown the monitoring service
	 */
	async shutdown() {
		if (this.intervalId) {
			clearInterval(this.intervalId);
			this.intervalId = null;
		}

		console.log(
			`🛑 PR Monitoring Service shutdown (monitored ${this.monitoredPRs.size} PRs)`
		);
		return { success: true };
	}
}

// Singleton management for PRMonitoringService
let prMonitoringServiceInstance = null;

/**
 * Initialize the PR monitoring singleton with a backend
 */
export async function initializePRMonitoringService(backend, options = {}) {
	if (!prMonitoringServiceInstance) {
		prMonitoringServiceInstance = new PRMonitoringService(backend, {
			checkInterval: options.prMergeCheckInterval || 30000, // 30 seconds
			maxRetries: options.maxRetries || 3,
			timeoutMs: options.timeoutMs || 300000, // 5 minutes
			...options
		});
		await prMonitoringServiceInstance.initialize();
	}
	return prMonitoringServiceInstance;
}

/**
 * Get the PR monitoring singleton instance
 */
export function getPRMonitoringService() {
	return prMonitoringServiceInstance;
}

/**
 * Check if PR monitoring service is initialized
 */
export function isPRMonitoringServiceInitialized() {
	return (
		prMonitoringServiceInstance !== null &&
		prMonitoringServiceInstance.intervalId !== null
	);
}
