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
		queryPromise.catch((error) => {
			console.error(
				`Background Claude Code operation ${operationId} failed:`,
				error
			);
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
			let result;

			// Check if this is a worktree-based operation that needs CLAUDE.md preparation
			const metadata = options.metadata || {};
			const worktreePath = metadata.worktreePath;
			const isTaskImplementation =
				metadata.type &&
				(metadata.type === 'subtask-implementation' ||
					metadata.type === 'task-implementation');

			if (worktreePath && isTaskImplementation) {
				// This is a task/subtask implementation in a worktree - use headless launch
				console.log(
					'🏗️ [BackgroundClaudeCode] Using headless launch for worktree-based session'
				);

				// Build worktree object from metadata
				const worktree = {
					path: worktreePath,
					name: metadata.worktreeName || 'unknown',
					branch: metadata.branch
				};

				// Build tasks array from metadata
				const tasks = [];
				if (metadata.taskData) {
					// Use the complete task data passed from the modal
					tasks.push(metadata.taskData);
				} else if (metadata.taskId) {
					// Fallback: try to get full task details from backend
					try {
						const task = await this.backend.getTask(metadata.taskId);
						if (task) {
							tasks.push(task);
						} else {
							// Fallback with minimal task info
							tasks.push({
								id: metadata.taskId,
								title: `Task ${metadata.taskId}`,
								isSubtask: metadata.subtaskId !== null,
								description: 'Auto-generated from background session'
							});
						}
					} catch (error) {
						console.warn(
							'Could not load task details, using minimal task info:',
							error
						);
						tasks.push({
							id: metadata.taskId,
							title: `Task ${metadata.taskId}`,
							isSubtask: metadata.subtaskId !== null,
							description: 'Auto-generated from background session'
						});
					}
				}

				// Use launchClaudeHeadless which properly prepares CLAUDE.md
				result = await this.backend.launchClaudeHeadless(
					worktree,
					tasks,
					prompt,
					{
						persona: metadata.persona || options.persona,
						maxTurns: metadata.maxTurns || 10,
						permissionMode: 'acceptEdits',
						allowedTools: metadata.allowedTools,
						captureOutput: true,
						abortController: options.abortController,
						onProgress: (message) => {
							// Add message to the operation
							backgroundOperations.addMessage(operationId, message);

							// Call the original callback if provided
							if (options.onMessage) {
								options.onMessage(message);
							}
						}
					}
				);
			} else {
				// Fallback to raw claudeCodeQuery for non-worktree operations
				console.log(
					'📝 [BackgroundClaudeCode] Using raw query for non-worktree session'
				);
				result = await this.backend.claudeCodeQuery(prompt, {
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
			}

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

				// Trigger Claude Code Stop hook for automatic PR creation
				await this.triggerClaudeCodeStopHook(result, options.metadata);

				backgroundOperations.completeOperation(operationId, {
					success: true,
					sessionId: result.sessionId,
					...result
				});
			} else {
				// Trigger hook for session failure
				await this.triggerClaudeCodeStopHook(result, options.metadata, true);

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

		queryPromise.catch((error) => {
			console.error(
				`Background Claude Code continue ${operationId} failed:`,
				error
			);
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

		queryPromise.catch((error) => {
			console.error(
				`Background Claude Code resume ${operationId} failed:`,
				error
			);
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
		return backgroundOperations
			.getRunningOperations()
			.filter(
				(op) =>
					op.operation.type && op.operation.type.startsWith('claude-code-')
			);
	}

	/**
	 * Abort a specific operation
	 */
	abortOperation(operationId) {
		return backgroundOperations.abortOperation(operationId);
	}

	/**
	 * Trigger Claude Code Stop hook for automatic PR creation
	 */
	async triggerClaudeCodeStopHook(result, metadata, isFailure = false) {
		try {
			// Only trigger for worktree-based operations with task data
			if (!metadata || !metadata.worktreePath || !metadata.taskData) {
				console.log('🔄 [BackgroundClaudeCode] Skipping hook trigger - no worktree/task metadata');
				return;
			}

			// Import hook integration service
			const { hookIntegration } = await import('./HookIntegrationService.js');
			
			if (!hookIntegration.initialized) {
				console.log('🔄 [BackgroundClaudeCode] Hook integration not initialized, skipping');
				return;
			}

			// Build context for hook
			const worktree = {
				path: metadata.worktreePath,
				name: metadata.worktreeName || 'unknown',
				branch: metadata.branch,
				sourceBranch: metadata.sourceBranch || 'main'
			};

			const task = metadata.taskData;
			const session = {
				sessionId: result.sessionId,
				metadata: {
					safetyMode: metadata.safetyMode || 'standard',
					operationType: metadata.type,
					autoGenerated: true
				}
			};

			const config = {
				claudeCodeStop: {
					defaultSafetyMode: metadata.safetyMode || 'standard',
					enableAutoCommit: true,
					enableAutoPR: true
				}
			};

			if (isFailure) {
				// Trigger session failed hook
				console.log(`🔄 [BackgroundClaudeCode] Triggering session failure hook for task ${task.id}`);
				await hookIntegration.notifySessionFailed(session, result.error, task, worktree);
			} else {
				// Trigger session completion hook
				console.log(`🔄 [BackgroundClaudeCode] Triggering session completion hook for task ${task.id}`);
				await hookIntegration.notifySessionCompleted(session, task, worktree, config);
			}

		} catch (error) {
			console.error('❌ [BackgroundClaudeCode] Error triggering Claude Code Stop hook:', error);
			// Don't throw - this shouldn't break the main operation
		}
	}
}
