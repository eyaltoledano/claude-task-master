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
		throw new Error('researchStream() must be implemented by subclass');
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
}
