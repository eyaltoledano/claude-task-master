/**
 * Execution Service for Flow TUI
 * Provides execution management functionality
 */

class ExecutionService {
	constructor() {
		// Mock execution data for now
		this.executions = [
			{
				id: 'exec-001',
				taskId: 'Task 5',
				status: 'running',
				progress: 0.65,
				provider: 'vibekit',
				agent: 'claude-code',
				startTime: new Date(Date.now() - 300000).toISOString(),
				logs: [
					{ timestamp: new Date().toISOString(), level: 'info', message: 'Execution started' },
					{ timestamp: new Date().toISOString(), level: 'info', message: 'Processing task...' }
				]
			},
			{
				id: 'exec-002',
				taskId: 'Task 3',
				status: 'completed',
				progress: 1.0,
				provider: 'vibekit',
				agent: 'gemini-cli',
				startTime: new Date(Date.now() - 600000).toISOString(),
				endTime: new Date(Date.now() - 120000).toISOString(),
				logs: [
					{ timestamp: new Date().toISOString(), level: 'info', message: 'Execution completed successfully' }
				]
			},
			{
				id: 'exec-003',
				taskId: 'Task 8',
				status: 'failed',
				progress: 0.3,
				provider: 'vibekit',
				agent: 'codex',
				startTime: new Date(Date.now() - 900000).toISOString(),
				endTime: new Date(Date.now() - 800000).toISOString(),
				error: 'API rate limit exceeded',
				logs: [
					{ timestamp: new Date().toISOString(), level: 'error', message: 'Execution failed: API rate limit' }
				]
			}
		];
	}

	/**
	 * List executions with optional filtering
	 * @param {Object} filters - Optional filters (status, provider, etc.)
	 * @returns {Array} Array of execution objects
	 */
	listExecutions(filters = {}) {
		let filtered = [...this.executions];

		if (filters.status) {
			filtered = filtered.filter(exec => exec.status === filters.status);
		}

		if (filters.provider) {
			filtered = filtered.filter(exec => exec.provider === filters.provider);
		}

		if (filters.agent) {
			filtered = filtered.filter(exec => exec.agent === filters.agent);
		}

		return filtered;
	}

	/**
	 * Get a specific execution by ID
	 * @param {string} executionId - The execution ID
	 * @returns {Object|null} The execution object or null if not found
	 */
	getExecution(executionId) {
		return this.executions.find(exec => exec.id === executionId) || null;
	}

	/**
	 * Start a new execution
	 * @param {Object} options - Execution options
	 * @returns {Object} The created execution object
	 */
	startExecution(options = {}) {
		const newExecution = {
			id: `exec-${Date.now()}`,
			taskId: options.taskId || 'Unknown',
			status: 'pending',
			progress: 0,
			provider: options.provider || 'vibekit',
			agent: options.agent || 'claude-code',
			startTime: new Date().toISOString(),
			logs: [
				{ timestamp: new Date().toISOString(), level: 'info', message: 'Execution queued' }
			]
		};

		this.executions.unshift(newExecution);

		// Simulate execution progression
		setTimeout(() => this.simulateProgress(newExecution.id), 1000);

		return newExecution;
	}

	/**
	 * Stop an execution
	 * @param {string} executionId - The execution ID
	 * @returns {boolean} True if stopped, false if not found
	 */
	stopExecution(executionId) {
		const execution = this.getExecution(executionId);
		if (!execution) return false;

		if (execution.status === 'running' || execution.status === 'pending') {
			execution.status = 'cancelled';
			execution.endTime = new Date().toISOString();
			execution.logs.push({
				timestamp: new Date().toISOString(),
				level: 'warning',
				message: 'Execution cancelled by user'
			});
		}

		return true;
	}

	/**
	 * Simulate execution progress (for demo purposes)
	 * @private
	 */
	simulateProgress(executionId) {
		const execution = this.getExecution(executionId);
		if (!execution || execution.status !== 'pending') return;

		execution.status = 'running';
		execution.logs.push({
			timestamp: new Date().toISOString(),
			level: 'info',
			message: 'Execution started'
		});

		const progressInterval = setInterval(() => {
			if (execution.status !== 'running') {
				clearInterval(progressInterval);
				return;
			}

			execution.progress += Math.random() * 0.1;
			
			if (execution.progress >= 1.0) {
				execution.progress = 1.0;
				execution.status = 'completed';
				execution.endTime = new Date().toISOString();
				execution.logs.push({
					timestamp: new Date().toISOString(),
					level: 'info',
					message: 'Execution completed successfully'
				});
				clearInterval(progressInterval);
			} else {
				execution.logs.push({
					timestamp: new Date().toISOString(),
					level: 'info',
					message: `Progress: ${Math.round(execution.progress * 100)}%`
				});
			}
		}, 2000);
	}

	/**
	 * Get execution statistics
	 * @returns {Object} Statistics object
	 */
	getStatistics() {
		const total = this.executions.length;
		const running = this.executions.filter(e => e.status === 'running').length;
		const completed = this.executions.filter(e => e.status === 'completed').length;
		const failed = this.executions.filter(e => e.status === 'failed').length;
		const pending = this.executions.filter(e => e.status === 'pending').length;

		return {
			total,
			running,
			completed,
			failed,
			pending,
			activeCount: running + pending
		};
	}
}

// Create and export singleton instance
export const executionService = new ExecutionService();

// Export class for testing
export { ExecutionService }; 