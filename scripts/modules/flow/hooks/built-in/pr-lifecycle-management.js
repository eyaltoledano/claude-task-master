/**
 * PR Lifecycle Management Hook
 * Handles the complete lifecycle of PRs from creation to merge and cleanup
 */

export default class PRLifecycleManagementHook {
	constructor() {
		this.name = 'pr-lifecycle-management';
		this.description = 'Manages PR lifecycle including monitoring, auto-merge, and cleanup';
		this.version = '1.0.0';
		this.events = [
			'pr-created',
			'pr-status-changed',
			'pr-ready-to-merge',
			'pr-merged',
			'pr-checks-failed'
		];
		
		this.prMonitoringService = null;
	}

	/**
	 * Initialize PR monitoring service
	 */
	async initialize(context) {
		if (!this.prMonitoringService) {
			const { PRMonitoringService } = await import('../../services/PRMonitoringService.js');
			this.prMonitoringService = new PRMonitoringService(context.backend, {
				checkInterval: 30000, // 30 seconds
				maxRetries: 3,
				timeoutMs: 300000 // 5 minutes
			});

			// Set up event listeners
			this.setupMonitoringEventListeners();

			await this.prMonitoringService.initialize();
		}
	}

	/**
	 * Set up event listeners for the monitoring service
	 */
	setupMonitoringEventListeners() {
		// Handle status changes
		this.prMonitoringService.on('statusChanged', async (data) => {
			await this.handlePRStatusChange(data);
		});

		// Handle ready for auto-merge
		this.prMonitoringService.on('readyForAutoMerge', async (data) => {
			await this.handleAutoMerge(data);
		});

		// Handle ready for cleanup
		this.prMonitoringService.on('readyForCleanup', async (data) => {
			await this.handlePostMergeCleanup(data);
		});

		// Handle check failures
		this.prMonitoringService.on('checksFailed', async (data) => {
			await this.handleCheckFailures(data);
		});

		// Handle monitoring failures
		this.prMonitoringService.on('monitoringFailed', async (data) => {
			console.error(`PR monitoring failed for PR ${data.prNumber}:`, data.error);
		});
	}

	/**
	 * Handle PR creation - start monitoring
	 */
	async onPrCreated(context) {
		try {
			await this.initialize(context);

			const { prResult, config, task, worktree } = context;
			
			if (!prResult || !prResult.prNumber) {
				return {
					success: false,
					error: 'No PR number provided'
				};
			}

			// Start monitoring the PR
			const monitoringConfig = await this.prMonitoringService.startMonitoring(
				prResult.prNumber,
				{
					taskId: task?.id,
					worktreeName: worktree?.name,
					autoMerge: config?.globalPRSetting && config?.autoMerge !== false,
					requiredChecks: config?.requiredChecks || [],
					cleanupAfterMerge: config?.cleanupAfterMerge !== false,
					notifyOnStatusChange: true
				}
			);

			console.log(`🔍 Started monitoring PR ${prResult.prNumber}`);

			return {
				success: true,
				data: {
					prNumber: prResult.prNumber,
					monitoring: monitoringConfig,
					message: `Started monitoring PR ${prResult.prNumber}`
				}
			};
		} catch (error) {
			console.error('Error in onPrCreated:', error);
			return {
				success: false,
				error: error.message
			};
		}
	}

	/**
	 * Handle PR status changes
	 */
	async onPrStatusChanged(context) {
		try {
			const { prNumber, oldStatus, newStatus, prStatus } = context;

			console.log(`📊 PR ${prNumber} status changed: ${oldStatus} → ${newStatus}`);

			// Log status change
			await this.logStatusChange(prNumber, oldStatus, newStatus, prStatus);

			// Trigger appropriate actions based on new status
			switch (newStatus) {
				case 'ready-to-merge':
					await this.onPrReadyToMerge(context);
					break;
				case 'merged':
					await this.onPrMerged(context);
					break;
				case 'checks-failed':
					await this.onPrChecksFailed(context);
					break;
			}

			return {
				success: true,
				data: {
					prNumber,
					statusChange: { from: oldStatus, to: newStatus },
					timestamp: new Date().toISOString()
				}
			};
		} catch (error) {
			console.error('Error in onPrStatusChanged:', error);
			return {
				success: false,
				error: error.message
			};
		}
	}

	/**
	 * Handle PR ready to merge
	 */
	async onPrReadyToMerge(context) {
		try {
			const { prNumber, config } = context;

			console.log(`✅ PR ${prNumber} is ready to merge`);

			// Check if auto-merge is enabled
			if (config?.autoMerge) {
				console.log(`🤖 Auto-merge enabled for PR ${prNumber}, initiating merge...`);
				return await this.handleAutoMerge(context);
			} else {
				console.log(`⏸️ Auto-merge disabled for PR ${prNumber}, manual merge required`);
				return {
					success: true,
					data: {
						prNumber,
						action: 'manual-merge-required',
						message: `PR ${prNumber} is ready but requires manual merge`
					}
				};
			}
		} catch (error) {
			console.error('Error in onPrReadyToMerge:', error);
			return {
				success: false,
				error: error.message
			};
		}
	}

	/**
	 * Handle PR merged
	 */
	async onPrMerged(context) {
		try {
			const { prNumber, config } = context;

			console.log(`🎉 PR ${prNumber} has been merged`);

			// Update task status if applicable
			await this.updateTaskStatusOnMerge(context);

			// Trigger cleanup if enabled
			if (config?.cleanupAfterMerge) {
				await this.handlePostMergeCleanup(context);
			}

			return {
				success: true,
				data: {
					prNumber,
					action: 'merged',
					timestamp: new Date().toISOString()
				}
			};
		} catch (error) {
			console.error('Error in onPrMerged:', error);
			return {
				success: false,
				error: error.message
			};
		}
	}

	/**
	 * Handle PR check failures
	 */
	async onPrChecksFailed(context) {
		try {
			const { prNumber, prStatus } = context;

			console.log(`❌ PR ${prNumber} checks failed`);

			// Log failed checks
			const failedChecks = prStatus.checks?.filter(check => check.status === 'failure') || [];
			
			for (const check of failedChecks) {
				console.log(`  ❌ ${check.name}: ${check.conclusion || 'failed'}`);
			}

			// Notify about failures
			await this.notifyCheckFailures(prNumber, failedChecks);

			return {
				success: true,
				data: {
					prNumber,
					action: 'checks-failed',
					failedChecks: failedChecks.map(c => c.name),
					timestamp: new Date().toISOString()
				}
			};
		} catch (error) {
			console.error('Error in onPrChecksFailed:', error);
			return {
				success: false,
				error: error.message
			};
		}
	}

	/**
	 * Handle auto-merge process with enhanced safety checks and rollback capability
	 */
	async handleAutoMerge(context) {
		try {
			const { prNumber, prStatus, config } = context;

			console.log(`🔄 Attempting enhanced auto-merge for PR ${prNumber}...`);

			// Use the enhanced merge execution with comprehensive safety checks
			const mergeConfig = {
				// Auto-merge configuration
				enabled: true,
				strictMode: config?.autoMerge?.strictMode || false,
				recentActivityWindow: config?.autoMerge?.recentActivityWindow || '30 minutes ago',
				maxRetries: config?.autoMerge?.maxRetries || 3,
				retryDelay: config?.autoMerge?.retryDelay || 60000,
				safetyChecks: {
					validatePRState: true,
					validateRequiredChecks: true,
					validateBranchProtection: true,
					validateNoConflicts: true,
					validateRecentActivity: true,
					customValidationHooks: config?.autoMerge?.safetyChecks?.customValidationHooks || []
				},
				
				// Required checks and merge settings
				requiredChecks: config?.requiredChecks || [],
				mergeMethod: config?.mergeMethod || 'squash',
				
				// Emergency stop configuration
				emergencyStop: config?.emergencyStop || {
					enabled: true,
					conditions: ['multiple_failed_merges', 'security_alert', 'manual_intervention_required']
				},
				
				// Rollback configuration
				rollback: config?.rollback || {
					enabled: true,
					createIncidentReport: true,
					notifyStakeholders: false,
					preserveEvidence: true
				},
				
				// Cleanup configuration
				cleanupWorktree: config?.cleanupWorktree !== false,
				updateASTCache: config?.updateASTCache !== false,
				updateTaskStatus: config?.updateTaskStatus !== false,
				archiveSession: config?.archiveSession !== false
			};

			const mergeResult = await context.backend.executeMerge(prNumber, mergeConfig);

			if (mergeResult.success) {
				console.log(`✅ Successfully auto-merged PR ${prNumber} using ${mergeResult.mergeResult?.method || 'squash'}`);
				
				// Log merge phases for debugging
				if (mergeResult.mergeAttempt?.phases) {
					console.log(`📊 Merge phases: ${mergeResult.mergeAttempt.phases.map(p => `${p.phase}:${p.status}`).join(', ')}`);
				}
				
				// Stop monitoring since PR is merged
				await this.prMonitoringService.stopMonitoring(prNumber, 'auto-merged');
				
				return {
					success: true,
					data: {
						prNumber,
						action: 'auto-merged',
						mergeResult,
						mergeAttempt: mergeResult.mergeAttempt,
						cleanupResult: mergeResult.cleanupResult,
						timestamp: new Date().toISOString()
					}
				};
			} else {
				console.error(`❌ Enhanced auto-merge failed for PR ${prNumber}: ${mergeResult.reason}`);
				
				// Log detailed failure information
				if (mergeResult.mergeAttempt?.phases) {
					const failedPhase = mergeResult.mergeAttempt.phases.find(p => p.status === 'failed');
					if (failedPhase) {
						console.error(`💥 Failed at phase: ${failedPhase.phase} - ${failedPhase.reason}`);
					}
				}
				
				// Check if we should retry
				if (mergeResult.canRetry && this.shouldRetryMerge(prNumber, mergeResult)) {
					console.log(`🔄 Scheduling retry for PR ${prNumber}...`);
					await this.scheduleRetry(prNumber, mergeResult, mergeConfig);
				}
				
				return {
					success: false,
					error: `Enhanced auto-merge failed: ${mergeResult.reason}`,
					details: {
						mergeAttempt: mergeResult.mergeAttempt,
						canRetry: mergeResult.canRetry,
						phases: mergeResult.mergeAttempt?.phases
					}
				};
			}
		} catch (error) {
			console.error('Error in handleAutoMerge:', error);
			return {
				success: false,
				error: error.message
			};
		}
	}

	/**
	 * Check if a merge should be retried
	 */
	shouldRetryMerge(prNumber, mergeResult) {
		// Don't retry if it's a validation failure or rollback occurred
		if (mergeResult.mergeAttempt?.phases?.some(p => 
			p.phase === 'validation' && p.status === 'failed' ||
			p.phase === 'rollback-preparation' && p.status === 'completed'
		)) {
			return false;
		}

		// Check for retryable conditions
		const retryableReasons = [
			'checks-pending',
			'temporary-network-error',
			'rate-limit-exceeded',
			'merge-queue-busy'
		];

		return retryableReasons.some(reason => 
			mergeResult.reason?.toLowerCase().includes(reason.toLowerCase())
		);
	}

	/**
	 * Schedule a retry for a failed merge
	 */
	async scheduleRetry(prNumber, mergeResult, mergeConfig) {
		try {
			const retryDelay = mergeConfig.retryDelay || 60000; // 1 minute default
			
			console.log(`⏰ Scheduling retry for PR ${prNumber} in ${retryDelay / 1000} seconds...`);
			
			// Store retry information for monitoring service
			const retryInfo = {
				prNumber,
				originalAttempt: mergeResult.mergeAttempt,
				retryConfig: mergeConfig,
				scheduledAt: new Date().toISOString(),
				retryAt: new Date(Date.now() + retryDelay).toISOString()
			};

			// The monitoring service will handle the actual retry
			await this.prMonitoringService.scheduleRetry(prNumber, retryInfo);
			
			return { success: true, retryInfo };
		} catch (error) {
			console.error(`Failed to schedule retry for PR ${prNumber}:`, error);
			return { success: false, error: error.message };
		}
	}

	/**
	 * Execute the actual merge (legacy method for backward compatibility)
	 */
	async executeMerge(prNumber, config = {}) {
		try {
			const { execSync } = await import('child_process');

			// Use GitHub CLI to merge the PR
			const mergeMethod = config.mergeMethod || 'squash';
			const command = `gh pr merge ${prNumber} --${mergeMethod} --delete-branch`;

			const result = execSync(command, {
				encoding: 'utf8',
				cwd: config.backend?.projectRoot || process.cwd()
			});

			return {
				success: true,
				result: result.trim(),
				method: mergeMethod
			};
		} catch (error) {
			return {
				success: false,
				error: error.message
			};
		}
	}

	/**
	 * Handle post-merge cleanup
	 */
	async handlePostMergeCleanup(context) {
		try {
			const { prNumber, config, worktree } = context;

			console.log(`🧹 Starting post-merge cleanup for PR ${prNumber}...`);

			const cleanupTasks = [];

			// 1. Clean up worktree if specified
			if (worktree && config?.cleanupWorktree !== false) {
				cleanupTasks.push(this.cleanupWorktree(worktree));
			}

			// 2. Update AST cache
			if (config?.updateASTCache !== false) {
				cleanupTasks.push(this.updateASTCache(context));
			}

			// 3. Update task status
			if (config?.updateTaskStatus !== false) {
				cleanupTasks.push(this.updateTaskStatusOnMerge(context));
			}

			// 4. Archive session data
			if (config?.archiveSession !== false) {
				cleanupTasks.push(this.archiveSessionData(context));
			}

			// Execute cleanup tasks
			const results = await Promise.allSettled(cleanupTasks);

			const successful = results.filter(r => r.status === 'fulfilled').length;
			const failed = results.filter(r => r.status === 'rejected').length;

			console.log(`🧹 Cleanup completed: ${successful} successful, ${failed} failed`);

			return {
				success: failed === 0,
				data: {
					prNumber,
					action: 'cleanup-completed',
					successful,
					failed,
					timestamp: new Date().toISOString()
				}
			};
		} catch (error) {
			console.error('Error in handlePostMergeCleanup:', error);
			return {
				success: false,
				error: error.message
			};
		}
	}

	/**
	 * Clean up worktree after merge
	 */
	async cleanupWorktree(worktree) {
		try {
			// Remove worktree directory
			const { execSync } = await import('child_process');
			
			execSync(`git worktree remove ${worktree.path} --force`, {
				cwd: worktree.projectRoot || process.cwd()
			});

			console.log(`🗑️ Removed worktree: ${worktree.name}`);
			return { success: true };
		} catch (error) {
			console.error('Error cleaning up worktree:', error);
			return { success: false, error: error.message };
		}
	}

	/**
	 * Update AST cache after merge
	 */
	async updateASTCache(context) {
		try {
			// Trigger AST cache refresh for the main codebase
			// This would integrate with the existing AST system
			console.log('🔄 Updating AST cache...');
			
			// Placeholder for AST cache update
			// In a real implementation, this would call the AST refresh methods
			
			return { success: true };
		} catch (error) {
			console.error('Error updating AST cache:', error);
			return { success: false, error: error.message };
		}
	}

	/**
	 * Update task status when PR is merged
	 */
	async updateTaskStatusOnMerge(context) {
		try {
			const { config, task } = context;

			if (!task?.id) {
				return { success: true, skipped: 'No task ID' };
			}

			// Mark task as completed
			await context.backend.setTaskStatus(task.id, 'done');
			
			console.log(`✅ Marked task ${task.id} as completed`);
			
			return { success: true };
		} catch (error) {
			console.error('Error updating task status:', error);
			return { success: false, error: error.message };
		}
	}

	/**
	 * Archive session data after merge
	 */
	async archiveSessionData(context) {
		try {
			// Archive Claude session data for historical reference
			console.log('📦 Archiving session data...');
			
			// Placeholder for session archival
			// In a real implementation, this would move session files to archive
			
			return { success: true };
		} catch (error) {
			console.error('Error archiving session data:', error);
			return { success: false, error: error.message };
		}
	}

	/**
	 * Log status change to storage
	 */
	async logStatusChange(prNumber, oldStatus, newStatus, prStatus) {
		try {
			const logEntry = {
				prNumber,
				statusChange: { from: oldStatus, to: newStatus },
				prStatus,
				timestamp: new Date().toISOString()
			};

			// Store in hook storage for historical tracking
			// This would use the hook storage system
			
			console.log(`📝 Logged status change for PR ${prNumber}`);
		} catch (error) {
			console.error('Error logging status change:', error);
		}
	}

	/**
	 * Notify about check failures
	 */
	async notifyCheckFailures(prNumber, failedChecks) {
		try {
			console.log(`🚨 Notifying about check failures for PR ${prNumber}`);
			
			// In a real implementation, this could:
			// - Send notifications
			// - Update task comments
			// - Create issues for failed checks
			
		} catch (error) {
			console.error('Error notifying about check failures:', error);
		}
	}

	/**
	 * Get monitoring statistics
	 */
	async getMonitoringStats() {
		if (!this.prMonitoringService) {
			return { error: 'Monitoring service not initialized' };
		}

		return this.prMonitoringService.getMonitoringStats();
	}

	/**
	 * Stop monitoring a specific PR
	 */
	async stopMonitoring(prNumber, reason = 'manual') {
		if (!this.prMonitoringService) {
			return { error: 'Monitoring service not initialized' };
		}

		return await this.prMonitoringService.stopMonitoring(prNumber, reason);
	}

	/**
	 * Cleanup hook resources
	 */
	async cleanup() {
		if (this.prMonitoringService) {
			await this.prMonitoringService.cleanup();
		}
	}
} 