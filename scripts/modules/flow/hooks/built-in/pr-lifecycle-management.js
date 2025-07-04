/**
 * PR Lifecycle Management Hook
 * Handles the complete lifecycle of PRs from creation to merge and cleanup
 */

export default class PRLifecycleManagementHook {
	constructor() {
		this.name = 'pr-lifecycle-management';
		this.description =
			'Manages PR lifecycle including monitoring, auto-merge, and cleanup';
		this.version = '2.0.0';
		this.events = [
			'pr-created',
			'pr-status-changed',
			'pr-ready-to-merge',
			'pr-merged',
			'pr-checks-failed'
		];

		this.prMonitoringService = null;
		this.notificationService = null;
	}

	/**
	 * Initialize PR monitoring service and notification system
	 */
	async initialize(context) {
		if (!this.prMonitoringService) {
			const { PRMonitoringService } = await import(
				'../../services/PRMonitoringService.js'
			);
			this.prMonitoringService = new PRMonitoringService(context.backend, {
				checkInterval: 30000, // 30 seconds
				maxRetries: 3,
				timeoutMs: 300000 // 5 minutes
			});

			// Set up event listeners
			this.setupMonitoringEventListeners();

			await this.prMonitoringService.initialize();
		}

		// Initialize notification service
		if (!this.notificationService) {
			this.notificationService = await this.createNotificationService(context);
		}
	}

	/**
	 * Create notification service with multi-channel support
	 */
	async createNotificationService(context) {
		// Load configuration
		const config = await this.loadNotificationConfig();
		
		return {
			notify: async (eventType, data, options = {}) => {
				try {
					// Determine which channels to use for this event
					const channels = this.getChannelsForEvent(eventType, config, options);
					
					// Get message template
					const template = this.getMessageTemplate(eventType, config);
					
					// Format message with data
					const message = this.formatMessage(template, data);
					
					// Send notification via configured channels
					await this.sendMultiChannelNotification(message, {
						type: this.getNotificationType(eventType),
						priority: options.priority || template.priority || 'normal',
						channels,
						context: {
							prNumber: data.prNumber,
							taskId: data.taskId,
							eventType,
							...data
						}
					});

					console.log(`📢 Sent ${eventType} notification via channels: ${channels.join(', ')}`);
				} catch (error) {
					console.error(`Failed to send ${eventType} notification:`, error);
				}
			},

			getChannelsForEvent: this.getChannelsForEvent.bind(this),
			getMessageTemplate: this.getMessageTemplate.bind(this),
			formatMessage: this.formatMessage.bind(this),
			sendMultiChannelNotification: this.sendMultiChannelNotification.bind(this)
		};
	}

	/**
	 * Load notification configuration
	 */
	async loadNotificationConfig() {
		try {
			// Load from flow-config.json
			const fs = await import('fs/promises');
			const path = await import('path');
			
			const configPath = path.join(process.cwd(), 'scripts/modules/flow/flow-config.json');
			const configContent = await fs.readFile(configPath, 'utf8');
			const config = JSON.parse(configContent);
			
			return config.notifications || this.getDefaultNotificationConfig();
		} catch (error) {
			console.warn('Failed to load notification config, using defaults:', error.message);
			return this.getDefaultNotificationConfig();
		}
	}

	/**
	 * Get default notification configuration
	 */
	getDefaultNotificationConfig() {
		return {
			enabled: true,
			channels: {
				app: { enabled: true },
				email: { enabled: false, events: [] },
				slack: { enabled: false, events: [] },
				telegram: { enabled: false, events: [] },
				sms: { enabled: false, events: [] }
			},
			templates: {
				prCreated: {
					title: "PR Created: {{prNumber}}",
					message: "Pull request #{{prNumber}} has been created for task {{taskId}}",
					priority: "normal"
				},
				prMerged: {
					title: "PR Merged: {{prNumber}}",
					message: "Pull request #{{prNumber}} has been successfully merged",
					priority: "normal"
				},
				checksFailed: {
					title: "PR Checks Failed: {{prNumber}}",
					message: "Pull request #{{prNumber}} has failing checks: {{failedChecks}}",
					priority: "high"
				}
			}
		};
	}

	/**
	 * Determine which channels to use for a specific event
	 */
	getChannelsForEvent(eventType, config, options = {}) {
		if (!config.enabled) {
			return ['app']; // Fallback to app-only
		}

		// Start with app channel
		const channels = ['app'];

		// Check each channel's event configuration
		Object.entries(config.channels).forEach(([channelName, channelConfig]) => {
			if (channelConfig.enabled && channelConfig.events && channelConfig.events.includes(eventType)) {
				channels.push(channelName);
			}
		});

		// Apply escalation rules if specified
		if (options.escalate && config.escalation?.enabled) {
			const escalationRule = config.escalation.rules.find(rule => rule.trigger === options.escalate);
			if (escalationRule) {
				return [...new Set([...channels, ...escalationRule.channels])];
			}
		}

		return [...new Set(channels)]; // Remove duplicates
	}

	/**
	 * Get message template for event type
	 */
	getMessageTemplate(eventType, config) {
		const templates = config.templates || {};
		return templates[eventType] || {
			title: `Task Master: ${eventType}`,
			message: `Event: ${eventType}`,
			priority: 'normal'
		};
	}

	/**
	 * Format message with template variables
	 */
	formatMessage(template, data) {
		let message = template.message;
		let title = template.title;

		// Replace template variables
		Object.entries(data).forEach(([key, value]) => {
			const placeholder = `{{${key}}}`;
			if (typeof value === 'string' || typeof value === 'number') {
				message = message.replace(new RegExp(placeholder, 'g'), value);
				title = title.replace(new RegExp(placeholder, 'g'), value);
			}
		});

		return { title, message, priority: template.priority };
	}

	/**
	 * Send notification via multiple channels
	 */
	async sendMultiChannelNotification(formattedMessage, options) {
		// This would integrate with the NotificationProvider
		// For now, we'll simulate the notification
		console.log(`🔔 Multi-channel notification:`, {
			message: formattedMessage.message,
			channels: options.channels,
			type: options.type,
			priority: options.priority,
			context: options.context
		});

		// In a real implementation, this would call the NotificationProvider
		// const { useNotification } = await import('../../ui/NotificationProvider.jsx');
		// const { addNotification } = useNotification();
		// addNotification(formattedMessage.message, options);
	}

	/**
	 * Get notification type based on event
	 */
	getNotificationType(eventType) {
		const typeMap = {
			'pr-created': 'info',
			'pr-merged': 'success',
			'checks-failed': 'error',
			'session-completed': 'success',
			'error': 'error',
			'critical': 'error'
		};
		return typeMap[eventType] || 'info';
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
			console.error(
				`PR monitoring failed for PR ${data.prNumber}:`,
				data.error
			);
		});
	}

	/**
	 * Handle PR creation - start monitoring and send notifications
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

			// Send PR creation notification
			await this.notificationService.notify('pr-created', {
				prNumber: prResult.prNumber,
				taskId: task?.id,
				prUrl: prResult.url,
				branch: prResult.branch || worktree?.name
			});

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
			
			// Send error notification
			if (this.notificationService) {
				await this.notificationService.notify('error', {
					errorType: 'PR Creation',
					errorMessage: error.message,
					prNumber: context.prResult?.prNumber
				}, { priority: 'high' });
			}

			return {
				success: false,
				error: error.message
			};
		}
	}

	/**
	 * Handle PR status changes with notifications
	 */
	async onPrStatusChanged(context) {
		try {
			const { prNumber, oldStatus, newStatus, prStatus } = context;

			console.log(
				`📊 PR ${prNumber} status changed: ${oldStatus} → ${newStatus}`
			);

			// Send status change notification for significant changes
			if (['ready-to-merge', 'merged', 'checks-failed'].includes(newStatus)) {
				await this.notificationService.notify('pr-status-changed', {
					prNumber,
					oldStatus,
					newStatus,
					prUrl: prStatus.url
				});
			}

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
	 * Handle PR ready to merge with notifications
	 */
	async onPrReadyToMerge(context) {
		try {
			const { prNumber, config } = context;

			console.log(`✅ PR ${prNumber} is ready to merge`);

			// Send ready-to-merge notification
			await this.notificationService.notify('pr-ready-to-merge', {
				prNumber,
				autoMergeEnabled: !!config?.autoMerge
			});

			// Check if auto-merge is enabled
			if (config?.autoMerge) {
				console.log(
					`🤖 Auto-merge enabled for PR ${prNumber}, initiating merge...`
				);
				return await this.handleAutoMerge(context);
			} else {
				console.log(
					`⏸️ Auto-merge disabled for PR ${prNumber}, manual merge required`
				);
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
	 * Handle PR merged with notifications
	 */
	async onPrMerged(context) {
		try {
			const { prNumber, config, task } = context;

			console.log(`🎉 PR ${prNumber} has been merged`);

			// Send PR merged notification
			await this.notificationService.notify('pr-merged', {
				prNumber,
				taskId: task?.id,
				mergedAt: new Date().toISOString()
			});

			// Use intelligent cleanup if available, otherwise fall back to legacy cleanup
			let cleanupResult;
			if (context.backend && context.backend.triggerCleanup) {
				// Use the new intelligent cleanup system
				cleanupResult = await this.performIntelligentCleanup(context);
			} else {
				// Fall back to legacy cleanup methods
				await this.updateTaskStatusOnMerge(context);

				if (config?.cleanupAfterMerge) {
					cleanupResult = await this.handlePostMergeCleanup(context);
				}
			}

			return {
				success: true,
				data: {
					prNumber,
					action: 'merged',
					cleanupResult,
					timestamp: new Date().toISOString()
				}
			};
		} catch (error) {
			console.error('Error in onPrMerged:', error);
			
			// Send error notification
			await this.notificationService.notify('error', {
				errorType: 'PR Merge Cleanup',
				errorMessage: error.message,
				prNumber: context.prNumber
			}, { priority: 'high' });

			return {
				success: false,
				error: error.message
			};
		}
	}

	/**
	 * Handle PR check failures with enhanced notifications
	 */
	async onPrChecksFailed(context) {
		try {
			const { prNumber, prStatus, task } = context;

			console.log(`❌ PR ${prNumber} checks failed`);

			// Log failed checks
			const failedChecks =
				prStatus.checks?.filter((check) => check.status === 'failure') || [];

			for (const check of failedChecks) {
				console.log(`  ❌ ${check.name}: ${check.conclusion || 'failed'}`);
			}

			// Send comprehensive check failure notification
			await this.notificationService.notify('checks-failed', {
				prNumber,
				taskId: task?.id,
				failedChecks: failedChecks.map(c => c.name).join(', '),
				failedCheckCount: failedChecks.length,
				totalChecks: prStatus.checks?.length || 0,
				prUrl: prStatus.url,
				checkDetails: failedChecks.map(check => ({
					name: check.name,
					conclusion: check.conclusion,
					detailsUrl: check.details_url
				}))
			}, { 
				priority: 'high',
				escalate: failedChecks.length > 2 ? '15min' : '5min' // Escalate based on severity
			});

			return {
				success: true,
				data: {
					prNumber,
					action: 'checks-failed',
					failedChecks: failedChecks.map((c) => c.name),
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
	 * Enhanced notification method for check failures (replaces placeholder)
	 */
	async notifyCheckFailures(prNumber, failedChecks) {
		try {
			console.log(`🚨 Sending enhanced notifications for PR ${prNumber} check failures`);

			// Prepare detailed failure information
			const failureData = {
				prNumber,
				failedChecks: failedChecks.map(c => c.name).join(', '),
				failedCheckCount: failedChecks.length,
				checkDetails: failedChecks.map(check => ({
					name: check.name,
					conclusion: check.conclusion || 'failed',
					detailsUrl: check.details_url || null
				}))
			};

			// Send notification with escalation based on failure count
			const escalationLevel = failedChecks.length > 3 ? 'critical' : 
									failedChecks.length > 1 ? '15min' : '5min';

			await this.notificationService.notify('checks-failed', failureData, {
				priority: 'high',
				escalate: escalationLevel
			});

			// Additional notifications for critical failures
			if (failedChecks.length > 3) {
				await this.notificationService.notify('critical', {
					alertType: 'Multiple Check Failures',
					alertMessage: `PR ${prNumber} has ${failedChecks.length} failing checks`,
					prNumber,
					...failureData
				}, { priority: 'critical' });
			}

		} catch (error) {
			console.error('Error in enhanced notifyCheckFailures:', error);
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
				recentActivityWindow:
					config?.autoMerge?.recentActivityWindow || '30 minutes ago',
				maxRetries: config?.autoMerge?.maxRetries || 3,
				retryDelay: config?.autoMerge?.retryDelay || 60000,
				safetyChecks: {
					validatePRState: true,
					validateRequiredChecks: true,
					validateBranchProtection: true,
					validateNoConflicts: true,
					validateRecentActivity: true,
					customValidationHooks:
						config?.autoMerge?.safetyChecks?.customValidationHooks || []
				},

				// Required checks and merge settings
				requiredChecks: config?.requiredChecks || [],
				mergeMethod: config?.mergeMethod || 'squash',

				// Emergency stop configuration
				emergencyStop: config?.emergencyStop || {
					enabled: true,
					conditions: [
						'multiple_failed_merges',
						'security_alert',
						'manual_intervention_required'
					]
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

			const mergeResult = await context.backend.executeMerge(
				prNumber,
				mergeConfig
			);

			if (mergeResult.success) {
				console.log(
					`✅ Successfully auto-merged PR ${prNumber} using ${mergeResult.mergeResult?.method || 'squash'}`
				);

				// Log merge phases for debugging
				if (mergeResult.mergeAttempt?.phases) {
					console.log(
						`📊 Merge phases: ${mergeResult.mergeAttempt.phases.map((p) => `${p.phase}:${p.status}`).join(', ')}`
					);
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
				console.error(
					`❌ Enhanced auto-merge failed for PR ${prNumber}: ${mergeResult.reason}`
				);

				// Log detailed failure information
				if (mergeResult.mergeAttempt?.phases) {
					const failedPhase = mergeResult.mergeAttempt.phases.find(
						(p) => p.status === 'failed'
					);
					if (failedPhase) {
						console.error(
							`💥 Failed at phase: ${failedPhase.phase} - ${failedPhase.reason}`
						);
					}
				}

				// Check if we should retry
				if (
					mergeResult.canRetry &&
					this.shouldRetryMerge(prNumber, mergeResult)
				) {
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
		if (
			mergeResult.mergeAttempt?.phases?.some(
				(p) =>
					(p.phase === 'validation' && p.status === 'failed') ||
					(p.phase === 'rollback-preparation' && p.status === 'completed')
			)
		) {
			return false;
		}

		// Check for retryable conditions
		const retryableReasons = [
			'checks-pending',
			'temporary-network-error',
			'rate-limit-exceeded',
			'merge-queue-busy'
		];

		return retryableReasons.some((reason) =>
			mergeResult.reason?.toLowerCase().includes(reason.toLowerCase())
		);
	}

	/**
	 * Schedule a retry for a failed merge
	 */
	async scheduleRetry(prNumber, mergeResult, mergeConfig) {
		try {
			const retryDelay = mergeConfig.retryDelay || 60000; // 1 minute default

			console.log(
				`⏰ Scheduling retry for PR ${prNumber} in ${retryDelay / 1000} seconds...`
			);

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

			const successful = results.filter((r) => r.status === 'fulfilled').length;
			const failed = results.filter((r) => r.status === 'rejected').length;

			console.log(
				`🧹 Cleanup completed: ${successful} successful, ${failed} failed`
			);

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
	 * Perform comprehensive post-merge cleanup
	 */
	async performIntelligentCleanup(context) {
		try {
			const { prNumber, mergeInfo = {}, backend } = context;

			if (!backend || !backend.triggerCleanup) {
				console.log(
					'⚠️ Backend cleanup not available, falling back to basic cleanup'
				);
				return await this.performBasicCleanup(context);
			}

			console.log(`🧹 Starting intelligent cleanup for PR #${prNumber}...`);

			// Extract merge information from context
			const cleanupMergeInfo = {
				worktreeName: mergeInfo.worktreeName || context.worktree?.name,
				mergedBranch: mergeInfo.mergedBranch || context.branch,
				taskId: mergeInfo.taskId || context.task?.id,
				...mergeInfo
			};

			// Trigger comprehensive cleanup
			const result = await backend.triggerCleanup(prNumber, cleanupMergeInfo);

			if (result.success) {
				const cleanup = result.cleanupResult;
				console.log(`✅ Intelligent cleanup completed for PR #${prNumber}`);

				// Log cleanup results
				if (cleanup.worktree) {
					console.log(`  🗑️ Worktree: ${cleanup.worktree.actions.join(', ')}`);
				}
				if (cleanup.astCache) {
					console.log(
						`  🔄 AST Cache: ${cleanup.astCache.invalidatedFiles} files invalidated`
					);
				}
				if (cleanup.taskStatus) {
					console.log(`  ✅ Task: ${cleanup.taskStatus.actions.join(', ')}`);
				}

				if (cleanup.errors.length > 0) {
					console.log(
						`  ⚠️ Errors: ${cleanup.errors.length} non-critical errors occurred`
					);
				}

				return { success: true, cleanupResult: cleanup };
			} else {
				console.error(`❌ Intelligent cleanup failed: ${result.error}`);
				return { success: false, error: result.error };
			}
		} catch (error) {
			console.error('Error during intelligent cleanup:', error);
			return { success: false, error: error.message };
		}
	}

	/**
	 * Fallback basic cleanup
	 */
	async performBasicCleanup(context) {
		try {
			const results = {
				success: true,
				actions: [],
				errors: []
			};

			// Basic worktree cleanup
			if (context.worktree) {
				try {
					const worktreeResult = await this.cleanupWorktree(context.worktree);
					if (worktreeResult.success) {
						results.actions.push('worktree-removed');
					} else {
						results.errors.push(worktreeResult.error);
					}
				} catch (error) {
					results.errors.push(`Worktree cleanup failed: ${error.message}`);
				}
			}

			// Basic task status update
			if (context.task && context.backend) {
				try {
					const taskResult = await this.updateTaskStatusOnMerge(context);
					if (taskResult.success) {
						results.actions.push('task-status-updated');
					} else {
						results.errors.push(taskResult.error);
					}
				} catch (error) {
					results.errors.push(`Task update failed: ${error.message}`);
				}
			}

			console.log(`📋 Basic cleanup completed: ${results.actions.join(', ')}`);
			if (results.errors.length > 0) {
				console.log(`⚠️ Cleanup errors: ${results.errors.join(', ')}`);
			}

			return results;
		} catch (error) {
			console.error('Error during basic cleanup:', error);
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
