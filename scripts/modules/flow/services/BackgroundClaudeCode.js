import { backgroundOperations } from './BackgroundOperationsManager.js';
import { v4 as uuidv4 } from 'uuid';

export class BackgroundClaudeCode {
	constructor(backend) {
		this.backend = backend;
	}

	/**
	 * Start a Claude Code query in the background
	 * @param {string} prompt - The prompt for Claude
	 * @param {Object} options - Query options
	 * @param {Function} options.onMessage - Callback for messages (optional)
	 * @param {Object} options.metadata - Additional metadata for the operation
	 * @returns {Object} Operation info including operationId
	 */
	async startQuery(prompt, options = {}) {
		const operationId = uuidv4();
		const abortController = new AbortController();

		// Create a promise that will run the Claude Code query
		const queryPromise = this.runQuery(operationId, prompt, {
			...options,
			abortController
		});

		// Register the operation
		backgroundOperations.registerOperation(operationId, {
			type: 'claude-code-query',
			prompt,
			abortController,
			metadata: options.metadata || {},
			promise: queryPromise
		});

		// Start the query without awaiting it
		queryPromise.catch(error => {
			console.error(`Background Claude Code operation ${operationId} failed:`, error);
		});

		return {
			operationId,
			abortController,
			promise: queryPromise
		};
	}

	/**
	 * Run the actual Claude Code query
	 */
	async runQuery(operationId, prompt, options) {
		try {
			const result = await this.backend.claudeCodeQuery(prompt, {
				...options,
				onMessage: (message) => {
					// Add message to the operation
					backgroundOperations.addMessage(operationId, message);
					
					// Call the original callback if provided
					if (options.onMessage) {
						options.onMessage(message);
					}
				}
			});

			if (result.success && result.sessionId) {
				// Save session if backend supports it
				if (this.backend.saveClaudeCodeSession) {
					await this.backend.saveClaudeCodeSession({
						sessionId: result.sessionId,
						prompt,
						lastUpdated: new Date().toISOString(),
						metadata: options.metadata || {}
					});
				}

				backgroundOperations.completeOperation(operationId, {
					success: true,
					sessionId: result.sessionId,
					...result
				});
			} else {
				backgroundOperations.completeOperation(operationId, {
					success: false,
					error: result.error || 'Operation failed'
				});
			}

			return result;
		} catch (error) {
			// Mark operation as failed
			backgroundOperations.failOperation(operationId, error.message);
			throw error;
		}
	}

	/**
	 * Continue a Claude Code session in the background
	 */
	async continueSession(prompt, options = {}) {
		const operationId = uuidv4();
		const abortController = new AbortController();

		const queryPromise = this.runContinue(operationId, prompt, {
			...options,
			abortController
		});

		backgroundOperations.registerOperation(operationId, {
			type: 'claude-code-continue',
			prompt,
			abortController,
			metadata: options.metadata || {},
			promise: queryPromise
		});

		queryPromise.catch(error => {
			console.error(`Background Claude Code continue ${operationId} failed:`, error);
		});

		return {
			operationId,
			abortController,
			promise: queryPromise
		};
	}

	async runContinue(operationId, prompt, options) {
		try {
			const result = await this.backend.claudeCodeContinue(prompt, {
				onMessage: (message) => {
					backgroundOperations.addMessage(operationId, message);
					if (options.onMessage) {
						options.onMessage(message);
					}
				}
			});

			if (result.success) {
				// Update session if backend supports it
				if (this.backend.saveClaudeCodeSession) {
					await this.backend.saveClaudeCodeSession({
						sessionId: operation.sessionId,
						lastUpdated: new Date().toISOString()
					});
				}

				backgroundOperations.completeOperation(operationId, {
					success: true,
					...result
				});
			} else {
				backgroundOperations.completeOperation(operationId, {
					success: false,
					error: result.error || 'Operation failed'
				});
			}

			return result;
		} catch (error) {
			backgroundOperations.failOperation(operationId, error.message);
			throw error;
		}
	}

	/**
	 * Resume a specific Claude Code session in the background
	 */
	async resumeSession(sessionId, prompt, options = {}) {
		const operationId = uuidv4();
		const abortController = new AbortController();

		const queryPromise = this.runResume(operationId, sessionId, prompt, {
			...options,
			abortController
		});

		backgroundOperations.registerOperation(operationId, {
			type: 'claude-code-resume',
			sessionId,
			prompt,
			abortController,
			metadata: options.metadata || {},
			promise: queryPromise
		});

		queryPromise.catch(error => {
			console.error(`Background Claude Code resume ${operationId} failed:`, error);
		});

		return {
			operationId,
			abortController,
			promise: queryPromise
		};
	}

	async runResume(operationId, sessionId, prompt, options) {
		try {
			const result = await this.backend.claudeCodeResume(sessionId, '', {
				onMessage: (message) => {
					backgroundOperations.addMessage(operationId, message);
					if (options.onMessage) {
						options.onMessage(message);
					}
				}
			});

			if (result.success) {
				// Update session if backend supports it
				if (this.backend.saveClaudeCodeSession) {
					await this.backend.saveClaudeCodeSession({
						sessionId,
						lastUpdated: new Date().toISOString()
					});
				}

				backgroundOperations.completeOperation(operationId, {
					success: true,
					sessionId,
					...result
				});
			} else {
				backgroundOperations.completeOperation(operationId, {
					success: false,
					error: result.error || 'Operation failed'
				});
			}

			return result;
		} catch (error) {
			backgroundOperations.failOperation(operationId, error.message);
			throw error;
		}
	}

	/**
	 * Get the status of a background operation
	 */
	getOperationStatus(operationId) {
		return backgroundOperations.getOperation(operationId);
	}

	/**
	 * Get all running operations
	 */
	getRunningOperations() {
		return backgroundOperations.getRunningOperations()
			.filter(op => op.operation.type && op.operation.type.startsWith('claude-code-'));
	}

	/**
	 * Abort a specific operation
	 */
	abortOperation(operationId) {
		return backgroundOperations.abortOperation(operationId);
	}
} 