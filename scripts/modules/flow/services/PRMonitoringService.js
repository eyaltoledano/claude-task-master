import fs from 'fs/promises';
import path from 'path';
import { EventEmitter } from 'events';

/**
 * PR Monitoring Service - Tracks PR status and manages automation lifecycle
 */
export class PRMonitoringService extends EventEmitter {
	constructor(backend, options = {}) {
		super();
		this.backend = backend;
		this.options = {
			checkInterval: options.checkInterval || 30000, // 30 seconds
			maxRetries: options.maxRetries || 3,
			timeoutMs: options.timeoutMs || 300000, // 5 minutes
			...options
		};
		
		this.activePRs = new Map();
		this.timers = new Map();
		this.stateFile = null;
		this.initialized = false;
		this.eventLogs = new Map(); // Add event log storage
	}

	/**
	 * Initialize the monitoring service
	 */
	async initialize() {
		if (this.initialized) return;

		try {
			// Set up state file path
			this.stateFile = path.join(
				this.backend.projectRoot,
				'.taskmaster',
				'state',
				'pr-monitoring.json'
			);

			// Ensure state directory exists
			await fs.mkdir(path.dirname(this.stateFile), { recursive: true });

			// Load existing state
			await this.loadState();

			// Resume monitoring for any active PRs
			await this.resumeActiveMonitoring();

			this.initialized = true;
			this.emit('initialized');
		} catch (error) {
			console.error('Failed to initialize PR monitoring service:', error);
			throw error;
		}
	}

	/**
	 * Start monitoring a PR
	 */
	async startMonitoring(prNumber, config = {}) {
		if (!this.initialized) {
			await this.initialize();
		}

		// Initialize event log for this PR
		this.eventLogs.set(prNumber, []);
		this.logEvent(prNumber, 'monitoringStarted', { config });

		const monitoringConfig = {
			prNumber,
			taskId: config.taskId,
			worktreeName: config.worktreeName,
			autoMerge: config.autoMerge || false,
			requiredChecks: config.requiredChecks || [],
			cleanupAfterMerge: config.cleanupAfterMerge || true,
			notifyOnStatusChange: config.notifyOnStatusChange || true,
			created: new Date().toISOString(),
			status: 'monitoring',
			lastChecked: null,
			retryCount: 0
		};

		// Store monitoring config
		this.activePRs.set(prNumber, monitoringConfig);
		await this.saveState();

		// Start monitoring timer
		this.startMonitoringTimer(prNumber);

		// Emit event
		this.emit('monitoringStarted', { prNumber, config: monitoringConfig });

		return monitoringConfig;
	}

	/**
	 * Stop monitoring a PR
	 */
	async stopMonitoring(prNumber, reason = 'manual') {
		if (!this.activePRs.has(prNumber)) {
			return false;
		}

		// Log stop event
		this.logEvent(prNumber, 'monitoringStopped', { reason });

		// Clear timer
		if (this.timers.has(prNumber)) {
			clearInterval(this.timers.get(prNumber));
			this.timers.delete(prNumber);
		}

		// Get config before removing
		const config = this.activePRs.get(prNumber);

		// Remove from active monitoring
		this.activePRs.delete(prNumber);
		await this.saveState();

		// Emit event
		this.emit('monitoringStopped', { prNumber, reason, config });

		return true;
	}

	/**
	 * Pause monitoring for a PR
	 */
	async pauseMonitoring(prNumber) {
		if (!this.activePRs.has(prNumber)) {
			return false;
		}

		const config = this.activePRs.get(prNumber);
		config.status = 'paused';
		config.lastChecked = new Date().toISOString();
		await this.saveState();

		this.logEvent(prNumber, 'monitoringPaused');
		this.emit('monitoringPaused', { prNumber, config });

		return true;
	}

	/**
	 * Resume monitoring for a PR
	 */
	async resumeMonitoring(prNumber) {
		if (!this.activePRs.has(prNumber)) {
			return false;
		}

		const config = this.activePRs.get(prNumber);
		config.status = 'monitoring'; // Reset to monitoring
		config.lastChecked = new Date().toISOString();
		await this.saveState();
		
		// Immediately trigger a check
		await this.checkPRStatus(prNumber);

		this.logEvent(prNumber, 'monitoringResumed');
		this.emit('monitoringResumed', { prNumber, config });

		return true;
	}

	/**
	 * Check PR status and handle state changes
	 */
	async checkPRStatus(prNumber) {
		const config = this.activePRs.get(prNumber);
		if (!config || config.status === 'paused') {
			return null;
		}

		try {
			// Get current PR status from backend
			const prStatus = await this.backend.getPRStatus(prNumber);
			const oldStatus = config.status;

			// Update last checked time
			config.lastChecked = new Date().toISOString();
			config.retryCount = 0; // Reset retry count on successful check

			// Determine new status
			const newStatus = this.determinePRStatus(prStatus);
			
			// Update config if status changed
			if (newStatus !== oldStatus) {
				config.status = newStatus;
				await this.saveState();

				// Log the status change event
				this.logEvent(prNumber, 'statusChanged', { oldStatus, newStatus, prStatus });

				// Emit status change event
				this.emit('statusChanged', {
					prNumber,
					oldStatus,
					newStatus,
					prStatus,
					config
				});

				// Handle specific status transitions
				await this.handleStatusTransition(prNumber, oldStatus, newStatus, prStatus);
			}

			// Add a periodic check-in event
			this.logEvent(prNumber, 'statusChecked', { status: newStatus, checks: prStatus.checks?.length || 0 });

			return {
				prNumber,
				status: newStatus,
				prStatus,
				config
			};

		} catch (error) {
			console.error(`Error checking PR ${prNumber} status:`, error);
			
			// Increment retry count
			config.retryCount = (config.retryCount || 0) + 1;
			
			// Stop monitoring if max retries exceeded
			if (config.retryCount >= this.options.maxRetries) {
				await this.stopMonitoring(prNumber, 'max-retries-exceeded');
				this.emit('monitoringFailed', { prNumber, error, config });
			}

			throw error;
		}
	}

	/**
	 * Get all active PR monitoring configs
	 */
	getActivePRs() {
		return Array.from(this.activePRs.entries()).map(([prNumber, config]) => ({
			prNumber,
			...config
		}));
	}

	/**
	 * Get monitoring config for a specific PR
	 */
	getMonitoringConfig(prNumber) {
		return this.activePRs.get(prNumber);
	}

	/**
	 * Check if a PR is being monitored
	 */
	isMonitoring(prNumber) {
		return this.activePRs.has(prNumber);
	}

	/**
	 * Get monitoring statistics
	 */
	getMonitoringStats() {
		const activePRs = this.getActivePRs();
		const statusCounts = {};
		
		activePRs.forEach(pr => {
			statusCounts[pr.status] = (statusCounts[pr.status] || 0) + 1;
		});

		return {
			totalActive: activePRs.length,
			statusCounts,
			oldestPR: activePRs.length > 0 ? 
				activePRs.reduce((oldest, pr) => 
					new Date(pr.created) < new Date(oldest.created) ? pr : oldest
				) : null
		};
	}

	/**
	 * Private: Start monitoring timer for a PR
	 */
	startMonitoringTimer(prNumber) {
		if (this.timers.has(prNumber)) {
			clearInterval(this.timers.get(prNumber));
		}

		const timer = setInterval(async () => {
			try {
				await this.checkPRStatus(prNumber);
			} catch (error) {
				console.error(`Monitoring timer error for PR ${prNumber}:`, error);
			}
		}, this.options.checkInterval);

		this.timers.set(prNumber, timer);
	}

	/**
	 * Private: Determine PR status from GitHub API response
	 */
	determinePRStatus(prStatus) {
		if (prStatus.merged) {
			return 'merged';
		}
		
		if (prStatus.closed) {
			return 'closed';
		}

		if (prStatus.draft) {
			return 'draft';
		}

		// Check if ready to merge
		if (this.isReadyToMerge(prStatus)) {
			return 'ready-to-merge';
		}

		// Check if there are issues
		if (prStatus.checks && prStatus.checks.some(check => check.status === 'failure')) {
			return 'checks-failed';
		}

		if (prStatus.reviewRequired && !prStatus.approved) {
			return 'pending-review';
		}

		return 'pending';
	}

	/**
	 * Private: Check if PR is ready to merge
	 */
	isReadyToMerge(prStatus) {
		// All checks must pass
		const checksPass = !prStatus.checks || 
			prStatus.checks.every(check => check.status === 'success');

		// Required reviews must be approved
		const reviewsApproved = !prStatus.reviewRequired || prStatus.approved;

		// No merge conflicts
		const noConflicts = prStatus.mergeable !== false;

		// Not draft
		const notDraft = !prStatus.draft;

		return checksPass && reviewsApproved && noConflicts && notDraft;
	}

	/**
	 * Private: Handle status transitions
	 */
	async handleStatusTransition(prNumber, oldStatus, newStatus, prStatus) {
		const config = this.activePRs.get(prNumber);

		switch (newStatus) {
			case 'ready-to-merge':
				if (config.autoMerge) {
					this.emit('readyForAutoMerge', { prNumber, prStatus, config });
				}
				break;

			case 'merged':
				if (config.cleanupAfterMerge) {
					this.emit('readyForCleanup', { prNumber, prStatus, config });
				}
				// Stop monitoring merged PRs
				await this.stopMonitoring(prNumber, 'merged');
				break;

			case 'closed':
				// Stop monitoring closed PRs
				await this.stopMonitoring(prNumber, 'closed');
				break;

			case 'checks-failed':
				this.emit('checksFailed', { prNumber, prStatus, config });
				break;
		}
	}

	/**
	 * Private: Load state from file
	 */
	async loadState() {
		try {
			const data = await fs.readFile(this.stateFile, 'utf8');
			const state = JSON.parse(data);
			
			// Restore active PRs
			if (state.activePRs) {
				for (const [prNumber, config] of Object.entries(state.activePRs)) {
					this.activePRs.set(parseInt(prNumber), config);
				}
			}

			// Restore event logs from state
			if (state.eventLogs) {
				for (const [prNumber, log] of Object.entries(state.eventLogs)) {
					this.eventLogs.set(parseInt(prNumber), log);
				}
			}
		} catch (error) {
			if (error.code !== 'ENOENT') {
				console.error('Error loading PR monitoring state:', error);
			}
			// File doesn't exist or is invalid, start with empty state
		}
	}

	/**
	 * Private: Save state to file
	 */
	async saveState() {
		try {
			const state = {
				lastUpdated: new Date().toISOString(),
				activePRs: Object.fromEntries(this.activePRs),
				eventLogs: Object.fromEntries(this.eventLogs) // Save event logs
			};

			await fs.writeFile(this.stateFile, JSON.stringify(state, null, 2));
		} catch (error) {
			console.error('Error saving PR monitoring state:', error);
		}
	}

	/**
	 * Private: Resume monitoring for active PRs after restart
	 */
	async resumeActiveMonitoring() {
		for (const [prNumber] of this.activePRs) {
			this.startMonitoringTimer(prNumber);
			// Ensure event log exists for resumed PRs
			if (!this.eventLogs.has(prNumber)) {
				this.eventLogs.set(prNumber, []);
			}
			this.logEvent(prNumber, 'monitoringResumed');
		}

		if (this.activePRs.size > 0) {
			console.log(`Resumed monitoring for ${this.activePRs.size} active PRs`);
		}
	}

	/**
	 * Cleanup - stop all monitoring
	 */
	async cleanup() {
		// Clear all timers
		for (const timer of this.timers.values()) {
			clearInterval(timer);
		}
		this.timers.clear();

		// Save final state
		await this.saveState();

		this.emit('cleanup');
	}

	/**
	 * Private: Log an event for a specific PR
	 */
	logEvent(prNumber, eventName, details = {}) {
		if (!this.eventLogs.has(prNumber)) {
			this.eventLogs.set(prNumber, []);
		}
		const log = this.eventLogs.get(prNumber);
		log.push({
			timestamp: new Date().toISOString(),
			event: eventName,
			details
		});
		// Optional: Limit log size
		if (log.length > 100) {
			log.shift();
		}
	}

	/**
	 * Get all monitored PRs with their summary status for the dashboard
	 */
	async getAllMonitoredPRs() {
		if (!this.initialized) {
			await this.initialize();
		}

		const prs = this.getActivePRs();
		return prs.map(pr => ({
			prNumber: pr.prNumber,
			status: pr.status,
			autoMerge: pr.autoMerge,
			createdAt: pr.created,
			lastChecked: pr.lastChecked,
			taskId: pr.taskId
		}));
	}

	/**
	 * Get detailed information for a single PR for the dashboard
	 */
	async getPRDetails(prNumber) {
		if (!this.activePRs.has(prNumber)) {
			return null;
		}
	
		const config = this.getMonitoringConfig(prNumber);
		const prStatus = await this.backend.getPRStatus(prNumber).catch(() => null);
		const eventLog = this.getEventLog(prNumber);
	
		return {
			config,
			prStatus,
			eventLog
		};
	}

	/**
	 * Get the event log for a specific PR
	 */
	getEventLog(prNumber) {
		return this.eventLogs.get(prNumber) || [];
	}
}

export default PRMonitoringService; 