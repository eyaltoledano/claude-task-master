/**
 * Backend interface for Task Master Flow TUI
 * Defines the contract that both CLI and MCP backends must implement
 */

export class FlowBackend {
	constructor(options = {}) {
		this.options = options;
		this.telemetryData = null;
	}

	/**
	 * Initialize the backend (e.g., connect to MCP server, verify CLI path)
	 */
	async initialize() {
		throw new Error('initialize() must be implemented by subclass');
	}

	/**
	 * Check if tasks.json file exists
	 * @returns {Promise<boolean>}
	 */
	async hasTasksFile() {
		throw new Error('hasTasksFile() must be implemented by subclass');
	}

	/**
	 * Get all tasks for the current tag
	 * @returns {Promise<{tasks: Array, tag: string}>}
	 */
	async listTasks(options = {}) {
		throw new Error('listTasks() must be implemented by subclass');
	}

	/**
	 * Get the next task to work on
	 * @returns {Promise<{task: Object, suggestions: Array}>}
	 */
	async nextTask() {
		throw new Error('nextTask() must be implemented by subclass');
	}

	/**
	 * Get detailed information about a specific task
	 * @param {string} taskId
	 * @returns {Promise<Object>}
	 */
	async getTask(taskId) {
		throw new Error('getTask() must be implemented by subclass');
	}

	/**
	 * Update task status
	 * @param {string} taskId
	 * @param {string} status
	 * @returns {Promise<Object>}
	 */
	async setTaskStatus(taskId, status) {
		throw new Error('setTaskStatus() must be implemented by subclass');
	}

	/**
	 * Expand a task into subtasks
	 * @param {string} taskId
	 * @param {Object} options
	 * @returns {Promise<Object>}
	 */
	async expandTask(taskId, options = {}) {
		throw new Error('expandTask() must be implemented by subclass');
	}

	/**
	 * Add a new task
	 * @param {Object} taskData
	 * @returns {Promise<Object>}
	 */
	async addTask(taskData) {
		throw new Error('addTask() must be implemented by subclass');
	}

	/**
	 * Run research with streaming output
	 * @param {string} query
	 * @param {Object} options
	 * @returns {AsyncIterator<string>}
	 */
	async *researchStream(query, options = {}) {
		yield* []; // Satisfy linter
		throw new Error('researchStream() must be implemented by subclass');
	}

	/**
	 * Run research (non-streaming)
	 * @param {Object} options
	 * @returns {Promise<Object>}
	 */
	async research(options = {}) {
		throw new Error('research() must be implemented by subclass');
	}

	/**
	 * Update a subtask
	 * @param {Object} options
	 * @returns {Promise<Object>}
	 */
	async updateSubtask(options = {}) {
		throw new Error('updateSubtask() must be implemented by subclass');
	}

	/**
	 * List available tags
	 * @returns {Promise<Array>}
	 */
	async listTags() {
		throw new Error('listTags() must be implemented by subclass');
	}

	/**
	 * Switch to a different tag
	 * @param {string} tagName
	 * @returns {Promise<Object>}
	 */
	async useTag(tagName) {
		throw new Error('useTag() must be implemented by subclass');
	}

	/**
	 * Get current telemetry data (cost, tokens, etc.)
	 * @returns {Object|null}
	 */
	getTelemetry() {
		return this.telemetryData;
	}

	/**
	 * Update telemetry data from a response
	 * @param {Object} response
	 */
	updateTelemetry(response) {
		if (response?.telemetryData) {
			if (!this.telemetryData) {
				this.telemetryData = {
					totalCost: 0,
					totalTokens: 0,
					calls: []
				};
			}
			this.telemetryData.totalCost += response.telemetryData.totalCost || 0;
			this.telemetryData.totalTokens += response.telemetryData.totalTokens || 0;
			this.telemetryData.calls.push(response.telemetryData);
		}
	}

	/**
	 * Get or create a worktree for a subtask
	 * @param {string} taskId
	 * @param {string} subtaskId
	 * @param {Object} options
	 * @returns {Promise<{exists: boolean, worktree: Object, created: boolean}>}
	 */
	async getOrCreateWorktreeForSubtask(taskId, subtaskId, options = {}) {
		throw new Error(
			'getOrCreateWorktreeForSubtask() must be implemented by subclass'
		);
	}

	/**
	 * Get worktree for a specific subtask
	 * @param {string} taskId
	 * @param {string} subtaskId
	 * @returns {Promise<Object|null>}
	 */
	async getWorktreeForSubtask(taskId, subtaskId) {
		throw new Error('getWorktreeForSubtask() must be implemented by subclass');
	}

	/**
	 * Get all worktrees
	 * @returns {Promise<Array>}
	 */
	async getAllWorktrees() {
		throw new Error('getAllWorktrees() must be implemented by subclass');
	}

	/**
	 * Complete a subtask and optionally create PR
	 * @param {string} worktreeName
	 * @param {Object} options
	 * @returns {Promise<Object>}
	 */
	async completeSubtaskWorktree(worktreeName, options = {}) {
		throw new Error(
			'completeSubtaskWorktree() must be implemented by subclass'
		);
	}

	/**
	 * Update worktree configuration
	 * @param {Object} updates
	 * @returns {Promise<void>}
	 */
	async updateWorktreeConfig(updates) {
		throw new Error('updateWorktreeConfig() must be implemented by subclass');
	}

	/**
	 * Get worktrees linked to a task (including subtasks)
	 * @param {string} taskId
	 * @returns {Promise<Array>}
	 */
	async getTaskWorktrees(taskId) {
		throw new Error('getTaskWorktrees() must be implemented by subclass');
	}

	/**
	 * Get complexity report for current tag
	 * @param {string} tag
	 * @returns {Promise<Object>}
	 */
	async getComplexityReport(tag) {
		throw new Error('getComplexityReport() must be implemented by subclass');
	}

	/**
	 * Save Claude session data to a JSON file
	 * @param {Object} sessionData - The session data to save
	 * @returns {Promise<string>} - Path to the saved file
	 */
	async saveClaudeSessionData(sessionData) {
		throw new Error('saveClaudeSessionData must be implemented');
	}

	async completeSubtaskWithPR(worktreeName, options = {}) {
		throw new Error('completeSubtaskWithPR must be implemented');
	}
}
