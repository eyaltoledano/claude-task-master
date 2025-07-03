/**
 * PR Monitoring Service - Real-time PR status monitoring with intelligent retry logic
 */
import { EventEmitter } from 'events';

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

		console.log(`🔍 PR Monitoring Service initialized (check interval: ${this.checkInterval}ms)`);
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

		console.log(`🔍 Started monitoring PR ${prNumber} (auto-merge: ${monitoringConfig.config.autoMerge})`);
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

		console.log(`🔍 Checking status of ${this.monitoredPRs.size} monitored PRs...`);

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

				console.log(`📊 PR ${prNumber} status changed: ${lastStatus || 'unknown'} → ${currentState}`);

				// Emit status change event
				this.emit('statusChanged', {
					prNumber,
					oldStatus: lastStatus,
					newStatus: currentState,
					prStatus,
					config: config.config
				});

				// Handle specific state transitions
				await this.handleStateTransition(prNumber, currentState, prStatus, config);
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
			const passingChecks = prStatus.checks?.filter(check => 
				requiredChecks.includes(check.name) && check.status === 'success'
			) || [];

			if (passingChecks.length < requiredChecks.length) {
				return 'checks-pending';
			}
		}

		// Check if there are any failing checks
		const failingChecks = prStatus.checks?.filter(check => 
			check.status === 'failure'
		) || [];

		if (failingChecks.length > 0) {
			return 'checks-failed';
		}

		// Check if ready to merge (all checks passing, no conflicts)
		if (prStatus.mergeable !== false && (prStatus.checks?.every(check => 
			check.status === 'success' || check.status === 'skipped'
		) || !prStatus.checks?.length)) {
			return 'ready-to-merge';
		}

		// Default to pending
		return 'pending';
	}

	/**
	 * Handle state transitions
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

			case 'merged':
				this.emit('readyForCleanup', {
					prNumber,
					prStatus,
					config: config.config
				});
				// Stop monitoring merged PRs
				await this.stopMonitoring(prNumber, 'merged');
				break;

			case 'checks-failed':
				this.emit('checksFailed', {
					prNumber,
					prStatus,
					failedChecks: prStatus.checks?.filter(c => c.status === 'failure') || [],
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

			case 'closed':
				// Stop monitoring closed PRs
				await this.stopMonitoring(prNumber, 'closed');
				break;
		}
	}

	/**
	 * Handle monitoring errors with exponential backoff
	 */
	handleMonitoringError(prNumber, error, config) {
		const currentRetries = this.retryAttempts.get(prNumber) || 0;
		
		if (currentRetries < this.maxRetries) {
			// Exponential backoff: 1s, 2s, 4s, 8s, etc.
			const backoffDelay = (2 ** currentRetries) * 1000;
			
			console.log(`⏰ Scheduling retry ${currentRetries + 1}/${this.maxRetries} for PR ${prNumber} in ${backoffDelay}ms`);
			
			setTimeout(() => {
				this.checkPRStatus(prNumber);
			}, backoffDelay);
			
			this.retryAttempts.set(prNumber, currentRetries + 1);
			this.stats.retriesExecuted++;
		} else {
			console.error(`❌ Max retries exceeded for PR ${prNumber}, stopping monitoring`);
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
	 * Shutdown the monitoring service
	 */
	async shutdown() {
		if (this.intervalId) {
			clearInterval(this.intervalId);
			this.intervalId = null;
		}

		console.log(`🛑 PR Monitoring Service shutdown (monitored ${this.monitoredPRs.size} PRs)`);
		return { success: true };
	}
} 